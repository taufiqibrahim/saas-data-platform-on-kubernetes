import asyncio
from datetime import datetime, timezone
from dotenv import load_dotenv
import kopf
import logging
import os
import urllib3
from kubernetes import config

from settings import app_settings
from workspace import delete_workspace_cr, fetch_workspace, get_workspace_cr
from workspace_app import (
    cleanup_workspace_app_resources,
    delete_workspace_app_cr,
    get_or_create_workspace_app_cr,
    list_workspace_apps_cr,
    reconcile_workspace_app,
)
from addon_handlers import get_addon
from helpers import create_kubernetes_event

urllib3.disable_warnings()
load_dotenv()

LOCK: asyncio.Lock

# Constants
WORKSPACE_APPLICATIONS = "workspaceapplications"

# Standard Kubernetes labels
STANDARD_LABELS = {
    "app.kubernetes.io/name": "<app-name>",  # Name of the application
    "app.kubernetes.io/instance": "<instance-name>",  # Unique instance identifier
    "app.kubernetes.io/version": "<version>",  # Application version
    "app.kubernetes.io/component": "<component>",  # Component within architecture
    "app.kubernetes.io/part-of": "<workspace-app>",  # Name of higher level application
    "app.kubernetes.io/managed-by": "workspace-controller",  # Tool managing the operation
}

WORKSPACE_LABEL_PREFIX = f"workspace.{app_settings.platform_group}"
WORKSPACE_ID = app_settings.workspace_id
# Custom workspace labels
WORKSPACE_LABELS = {
    f"{WORKSPACE_LABEL_PREFIX}/name": WORKSPACE_ID,  # Parent workspace
    f"{WORKSPACE_LABEL_PREFIX}/managed": "true",  # Managed by controller
    f"{WORKSPACE_LABEL_PREFIX}/type": "<type>",  # Type of workspace app
}

# Resource-specific labels
RESOURCE_LABELS = {
    f"{WORKSPACE_LABEL_PREFIX}/resource-type": "configmap|deployment|service",
    f"{WORKSPACE_LABEL_PREFIX}/owned-by": "<workspace-app-name>",
}

# Load Kubernetes config safely at runtime
try:
    config.load_incluster_config()
except:
    config.load_kube_config()


@kopf.on.startup()  # type: ignore
async def startup_fn(logger, **kwargs):
    global LOCK
    LOCK = asyncio.Lock()


@kopf.on.startup()  # type: ignore
def configure(settings: kopf.OperatorSettings, **_):
    log_level = os.getenv("LOG_LEVEL", "WARNING").upper()
    settings.posting.level = getattr(logging, log_level, logging.WARNING)
    settings.posting.enabled = False
    settings.watching.connect_timeout = 1 * 60
    settings.watching.server_timeout = 10 * 60


@kopf.on.login()  # type: ignore
def login_fn(**kwargs):
    return kopf.login_with_service_account(**kwargs) or kopf.login_with_kubeconfig(
        **kwargs
    )


@kopf.on.cleanup()  # type: ignore
async def cleanup_fn(logger, **kwargs):
    pass


@kopf.on.create(
    app_settings.platform_group, app_settings.platform_version, "workspaces"
)  # type: ignore
async def workspace_on_create(spec, name, namespace, patch, meta, logger, body, **_):
    """Async handler for better concurrency"""
    patch.status["phase"] = "Ready"
    patch.status["lastReconcileTime"] = datetime.now(timezone.utc).isoformat()
    await create_kubernetes_event(body, "Created", "Workspace created", logger=logger)


@kopf.on.delete(
    app_settings.platform_group, app_settings.platform_version, "workspaces"
)  # type: ignore
async def workspace_on_delete(spec, name, namespace, patch, meta, logger, body, **_):
    """Async handler for better concurrency"""
    patch.status["phase"] = "Deleting"
    await create_kubernetes_event(body, "Deleted", "Workspace deleted", logger=logger)


@kopf.timer(
    app_settings.platform_group,
    app_settings.platform_version,
    "workspace",
    interval=app_settings.controller_timer_interval,
)  # type: ignore
async def reconcile_workspace(
    name, namespace, spec, status, patch, logger, body, **kwargs
):
    """
    The main Workspace controller timer loop
    - Watch <app_settings.platform_group>/<app_settings.platform_version>/workspaces resources
    """
    async with LOCK:
        try:
            print()
            # Poll workspace to control plane API
            workspace = fetch_workspace(logger=logger)
            if not workspace:
                logger.error("Workspace cant be None")
                patch.status["phase"] = "ReconciliationError"
                patch.status["error"] = "Failed to fetch workspace from control plane"
                return

            # Check existing workspace CR
            get_workspace_cr(
                name=WORKSPACE_ID,
                logger=logger,
                namespace=app_settings.workload_namespace,
            )

            extWorkspaceId = workspace.extWorkspaceId
            workspace_app_crs = list_workspace_apps_cr(
                labels={f"{WORKSPACE_LABEL_PREFIX}/name": WORKSPACE_ID}, logger=logger
            )

            # Handle workspace deletion - check for child apps first
            if workspace.status in ("DELETING"):
                # Check if any apps still exist using labels
                workspace_app_crs = list_workspace_apps_cr(
                    labels={f"{WORKSPACE_LABEL_PREFIX}/name": WORKSPACE_ID},
                    logger=logger,
                )

                if workspace_app_crs:
                    logger.warning(
                        f"Cannot delete workspace {name}: "
                        f"{len(workspace_app_crs)} apps still exist"
                    )
                    patch.status["phase"] = "DeletionBlocked"
                    patch.status["error"] = (
                        f"Workspace has {len(workspace_app_crs)} applications "
                        f"that must be deleted first"
                    )
                    return

                # Safe to delete
                delete_workspace_cr(name=extWorkspaceId, logger=logger)
                return

            # Handle workspace apps
            desired_apps = [
                wa for wa in workspace.workspaceApps if wa.status not in ("DELETED")
            ]
            app_names = [a.name for a in desired_apps]
            logger.info(f"Desired apps: {app_names}")

            for app in desired_apps:
                app_name = app.name
                app_namespace = app.namespace
                app_status = app.status

                # Handle workspace app deletion
                if app_status in ("DELETING"):
                    await delete_workspace_app_cr(
                        name=app_name,
                        logger=logger,
                        namespace=app_namespace,
                    )
                    continue

                if app_status == "DELETED":
                    logger.warn(f"Workspace app: {app_name} still marked as DELETED")
                    continue

                # Check if workspace app exists (or create it)
                if app_status == "PROVISIONING":
                    get_or_create_workspace_app_cr(
                        name=app_name,
                        namespace=app_namespace,
                        # workspace_name=name,  # Parent workspace name
                        logger=logger,
                        version=getattr(app, "version", "latest"),
                        # config=getattr(app, 'config', {})
                    )

        except Exception as e:
            kopf.exception(body, reason="ReconciliationError", message="")
            logger.error(f"Workspace reconciliation failed: {e}")
            patch.status["phase"] = "ReconciliationError"
            patch.status["error"] = str(e)
            raise


WORKSPACE_APP_FINALIZER = f"workspaceapplication.{app_settings.platform_group}/cleanup"


@kopf.on.create(
    app_settings.platform_group, app_settings.platform_version, WORKSPACE_APPLICATIONS
)  # type: ignore
async def workspace_app_on_create(
    spec, name, namespace, patch, meta, logger, body, **_
):
    """Async handler for better concurrency"""
    patch.status["phase"] = "Creating"
    await create_kubernetes_event(
        body, "Creating", "Workspace app creating", logger=logger
    )

    # Add custom finalizer to control workspace app deletion
    existing_finalizers = meta.get("finalizers", [])
    if WORKSPACE_APP_FINALIZER not in existing_finalizers:
        patch.metadata["finalizers"] = existing_finalizers + [WORKSPACE_APP_FINALIZER]

    # Get existing labels (if any)
    existing_labels = meta.get("labels", {})

    # Merge with new labels
    patch.metadata["labels"] = {
        **existing_labels,  # Keep existing labels
        f"{WORKSPACE_LABEL_PREFIX}/name": spec.get("workspace", "unknown"),
        f"{WORKSPACE_LABEL_PREFIX}/name": WORKSPACE_ID,  # Parent workspace
        f"{WORKSPACE_LABEL_PREFIX}/managed": "true",  # Managed by controller
        f"{WORKSPACE_LABEL_PREFIX}/type": name,  # Type of workspace app
        "app.kubernetes.io/managed-by": "kopf",
    }

    logger.info(f"Workspace app {name} for workspace {WORKSPACE_ID} created")

    try:
        await asyncio.to_thread(
            reconcile_workspace_app,
            spec,
            name,
            namespace,
            logger,
        )
        patch.status["phase"] = "Reconciling"
        patch.status["lastReconcileTime"] = datetime.now(timezone.utc).isoformat()
    except Exception as e:
        logger.error(f"Failed to create: {e}")
        patch.status["phase"] = "Failed"
        patch.status["error"] = str(e)
        await create_kubernetes_event(
            body,
            "Error",
            "Workspace app creation error",
            event_type="Error",
            logger=logger,
        )
        raise


# @kopf.on.update(app_settings.platform_group, app_settings.platform_version, WORKSPACE_APPLICATIONS)  # type: ignore
# def workspace_app_on_update(spec, name, namespace, patch, logger, **_):
#     """Reconcile on spec changes"""
#     patch.status["phase"] = "Reconciling"

#     # TODO: labeling
#     labels = {}
#     try:
#         reconcile_workspace_app(spec, name, namespace, logger)
#         patch.status["phase"] = "Ready"
#     except Exception as e:
#         logger.error(f"Failed to reconcile: {e}")
#         patch.status["phase"] = "Failed"


@kopf.on.delete(
    app_settings.platform_group,
    app_settings.platform_version,
    WORKSPACE_APPLICATIONS,
    optional=True,  # Don't let kopf manage its own finalizer - we manage ours
)  # type: ignore
async def workspace_app_on_delete(
    spec, name, namespace, patch, meta, logger, body, **_
):
    """Trigger addon cleanup - actual deletion waits for timer to remove finalizer"""

    logger.info(f"Delete requested for workspace app: {name}")
    patch.status["phase"] = "Deleting"

    addon_name = f"addon-{name}"
    addon = get_addon(addon_name, logger)

    if addon is not None:
        addon_status = addon.get("status", {}).get("status")  # type: ignore
        if addon_status != "deleting":
            logger.info(f"Triggering uninstall for addon: {addon_name}")
            cleanup_workspace_app_resources(
                name=name, namespace=namespace, logger=logger
            )
        else:
            logger.info(f"Addon {addon_name} already deleting")
    else:
        logger.info(f"Addon {addon_name} not found, nothing to cleanup")

    await create_kubernetes_event(
        body,
        "Deleting",
        "Workspace app deleting, waiting for addon cleanup",
        logger=logger,
    )
    # Note: Finalizer will be removed by the timer when addon is completely gone


# Add timer for drift detection and periodic reconciliation
@kopf.timer(
    app_settings.platform_group,
    app_settings.platform_version,
    WORKSPACE_APPLICATIONS,
    interval=10,
    # idle=60.0,  # Start after 60s of no changes
)  # type: ignore
async def workspace_app_status_sync(
    spec, name, namespace, status, patch, logger, body, meta, **_
):
    """Poll KubeVela Application CR and update WorkspaceApplication status"""
    phase = status.get("phase")
    addon_name = f"addon-{name}"

    # Only process resources in "Reconciling" state
    if phase != "Reconciling":
        return

    logger.info(f"Workspace app {name} status={phase}")
    addon = get_addon(addon_name, logger)

    if addon is None:
        # Addon not created yet, still reconciling
        return

    addon_status = addon.get("status", {}).get("status") if addon else None  # type: ignore

    if addon_status == "running":
        logger.info(f"Addon {addon_name} is running, marking {name} as Ready")
        patch.status["phase"] = "Ready"
        patch.status["lastReadyTime"] = datetime.now(timezone.utc).isoformat()
        await create_kubernetes_event(
            body, "Ready", "Workspace app ready", logger=logger
        )
    elif addon_status == "deleting":
        return
    elif addon_status == "runningWorkflow":
        return
    elif addon_status in ("error", "failed"):
        logger.error(f"Addon {addon_name} failed, marking {name} as Failed")
        patch.status["phase"] = "Failed"
        patch.status["error"] = addon.get("status", {}).get("message", "Addon deployment failed")  # type: ignore
        await create_kubernetes_event(
            body, "Error", "Workspace app error", event_type="Error", logger=logger
        )

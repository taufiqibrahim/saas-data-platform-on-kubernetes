import asyncio
from datetime import datetime, timezone
from dotenv import load_dotenv
import kopf
import logging
import os
import urllib3
from kubernetes import client, config

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

urllib3.disable_warnings()
load_dotenv()

LOCK: asyncio.Lock

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


async def create_event(body, reason, message, event_type="Normal", logger=None):
    """Helper to create events selectively"""
    try:
        v1 = client.CoreV1Api()
        meta = body.get("metadata", {})

        event = client.CoreV1Event(
            metadata=client.V1ObjectMeta(
                generate_name=f"{meta.get('name')}-", namespace=meta.get("namespace")
            ),
            involved_object=client.V1ObjectReference(
                api_version=body.get("apiVersion"),
                kind=body.get("kind"),
                name=meta.get("name"),
                namespace=meta.get("namespace"),
                uid=meta.get("uid"),
            ),
            reason=reason,
            message=message,
            type=event_type,
            first_timestamp=datetime.now(timezone.utc),
            last_timestamp=datetime.now(timezone.utc),
            count=1,
            source=client.V1EventSource(component="tenant-workspace-controller"),
        )

        v1.create_namespaced_event(meta.get("namespace"), event)
    except Exception as e:
        if logger:
            logger.error(f"Failed to create event: {e}")


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
    await create_event(body, "Created", "Workspace created", logger=logger)


@kopf.on.delete(
    app_settings.platform_group, app_settings.platform_version, "workspaces"
)  # type: ignore
async def workspace_on_delete(spec, name, namespace, patch, meta, logger, body, **_):
    """Async handler for better concurrency"""
    patch.status["phase"] = "Deleting"
    await create_event(body, "Deleted", "Workspace deleted", logger=logger)


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
            existing_apps = list_workspace_apps_cr(
                labels={f"{WORKSPACE_LABEL_PREFIX}/name": WORKSPACE_ID}, logger=logger
            )

            # Handle workspace deletion - check for child apps first
            if workspace.status in ("DELETING"):
                # Check if any apps still exist using labels
                existing_apps = list_workspace_apps_cr(
                    labels={f"{WORKSPACE_LABEL_PREFIX}/name": WORKSPACE_ID},
                    logger=logger,
                )

                if existing_apps:
                    logger.warning(
                        f"Cannot delete workspace {name}: "
                        f"{len(existing_apps)} apps still exist"
                    )
                    patch.status["phase"] = "DeletionBlocked"
                    patch.status["error"] = (
                        f"Workspace has {len(existing_apps)} applications "
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
                if app.status in ("DELETING"):
                    delete_workspace_app_cr(
                        name=app_name,
                        logger=logger,
                        namespace=app_namespace,
                    )
                    continue

                if app.status == "DELETED":
                    logger.warn(f"Workspace app: {app_name} still marked as DELETED")
                    continue

                #     # Check if workspace app exists (or create it)
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


@kopf.on.create(
    app_settings.platform_group, app_settings.platform_version, "workspaceapplications"
)  # type: ignore
async def workspace_app_on_create(
    spec, name, namespace, patch, meta, logger, body, **_
):
    """Async handler for better concurrency"""
    patch.status["phase"] = "Creating"
    await create_event(body, "Creating", "Workspace app creating", logger=logger)

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
        await create_event(
            body,
            "Error",
            "Workspace app creation error",
            event_type="Error",
            logger=logger,
        )
        raise


# @kopf.on.update(app_settings.platform_group, app_settings.platform_version, "workspaceapplications")  # type: ignore
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
    "workspaceapplications",
    retries=5,  # Number of retry attempts
    backoff=1.5,  # Exponential backoff multiplier
    timeout=3600,  # Total timeout for all retries
)  # type: ignore
async def workspace_app_on_delete(
    spec, name, namespace, patch, meta, logger, retry, **_
):
    """Clean up child resources - BLOCKS deletion until complete"""

    # if retry > 0:
    #     logger.warning(f"Retry attempt {retry + 1}/5")

    logger.info(f"Deleting workspace app: {name}")
    patch.status["phase"] = "Deleting"
    patch.status["retryCount"] = retry

    cleanup_workspace_app_resources(name=name, namespace=namespace, logger=logger)

    logger.info(f"Successfully deleted workspace app: {name}")


# Add timer for drift detection and periodic reconciliation
@kopf.timer(
    app_settings.platform_group,
    app_settings.platform_version,
    "workspaceapplications",
    interval=10,
    idle=60.0,  # Start after 60s of no changes
)  # type: ignore
async def workspace_app_status_sync(
    spec, name, namespace, status, patch, logger, body, **_
):
    """Poll KubeVela Application CR and update WorkspaceApplication status"""
    phase = status.get("phase")

    # Only process resources in "Reconciling" state
    if phase != "Reconciling":
        return

    logger.info(f"Workspace app {name} status={phase}")
    addon_name = f"addon-{name}"
    addon = get_addon(addon_name, logger)

    if addon is None:
        # Addon not created yet, still reconciling
        return

    addon_status = addon.get("status", {}).get("status") if addon else None  # type: ignore

    if addon_status == "running":
        logger.info(f"Addon {addon_name} is running, marking {name} as Ready")
        patch.status["phase"] = "Ready"
        patch.status["lastReadyTime"] = datetime.now(timezone.utc).isoformat()
        await create_event(body, "Ready", "Workspace app ready", logger=logger)
    elif addon_status == "deleting":
        return
    elif addon_status == "runningWorkflow":
        return
    elif addon_status in ("error", "failed"):
        logger.error(f"Addon {addon_name} failed, marking {name} as Failed")
        patch.status["phase"] = "Failed"
        patch.status["error"] = addon.get("status", {}).get("message", "Addon deployment failed")  # type: ignore
        await create_event(
            body, "Error", "Workspace app error", event_type="Error", logger=logger
        )

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
    delete_workspace_app,
    get_or_create_workspace_app,  # type: ignore
    list_workspace_apps,
)

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

# Custom workspace labels
WORKSPACE_LABELS = {
    f"{WORKSPACE_LABEL_PREFIX}/name": app_settings.workspace_id,  # Parent workspace
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

FINALIZER = f"{app_settings.platform_group}/cleanup-finalizer"


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
async def workspace_on_create(spec, name, namespace, patch, meta, logger, **_):
    """Async handler for better concurrency"""
    patch.status["phase"] = "Ready"
    patch.status["lastReconcileTime"] = datetime.now(timezone.utc).isoformat()

@kopf.timer(
    app_settings.platform_group,
    app_settings.platform_version,
    "workspace",
    interval=app_settings.controller_timer_interval,
)  # type: ignore
async def reconcile_workspace(name, namespace, spec, status, patch, logger, **kwargs):
    """
    The main Workspace controller timer loop
    - Watch <app_settings.platform_group>/<app_settings.platform_version>/workspaces resources
    """
    async with LOCK:
        try:
            # Poll workspace to control plane API
            workspace = fetch_workspace(logger=logger)
            if not workspace:
                logger.error("Workspace cant be None")
                patch.status["phase"] = "ReconciliationError"
                patch.status["error"] = "Failed to fetch workspace from control plane"
                return
            
            # Check existing workspace CR
            get_workspace_cr(
                name=app_settings.workspace_id,
                logger=logger,
                namespace=app_settings.workspace_namespace,
            )

            extWorkspaceId = workspace.extWorkspaceId
            existing_apps = list_workspace_apps(
                labels={f"{WORKSPACE_LABEL_PREFIX}/name": name}, logger=logger
            )

            # Handle workspace deletion - check for child apps first
            if workspace.status in ("DELETING"):
                # Check if any apps still exist using labels
                existing_apps = list_workspace_apps(
                    labels={f"{WORKSPACE_LABEL_PREFIX}/name": name}, logger=logger
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
            desired_apps = workspace.workspaceApps
            app_names = [a.name for a in desired_apps]
            logger.info(f"Configured apps: {app_names}")

            for app in desired_apps:
                app_name = app.name
                app_namespace = app.namespace
                app_status = app.status

                # Handle workspace app deletion
                if app.status in ("DELETING"):
                    delete_workspace_app(
                        name=app_name,
                        logger=logger,
                        namespace=app_namespace,
                    )
                    continue

                #     # Check if workspace app exists (or create it)
                get_or_create_workspace_app(
                    name=app_name,
                    namespace=app_namespace,
                    # workspace_name=name,  # Parent workspace name
                    logger=logger,
                    # version=getattr(app, 'version', 'latest'),
                    # config=getattr(app, 'config', {})
                )

        except Exception as e:
            logger.error(f"Workspace reconciliation failed: {e}")
            patch.status["phase"] = "ReconciliationError"
            patch.status["error"] = str(e)
            raise


@kopf.on.create(
    app_settings.platform_group, app_settings.platform_version, "workspaceapplications"
)  # type: ignore
async def workspace_app_on_create(spec, name, namespace, patch, meta, logger, **_):
    """Async handler for better concurrency"""
    patch.status["phase"] = "Creating"
    patch.metadata["finalizers"] = [FINALIZER]

    # workspace_name = app_settings.workspace_id
    # Get labels from metadata
    # labels = meta.get("labels", {})
    # workspace_name = labels.get(
    #     f"{WORKSPACE_LABEL_PREFIX}/name", spec.get("workspace", "unknown")
    # )

    logger.info(
        f"Workspace app {name} for workspace {app_settings.workspace_id} created"
    )
    create_labels = {
        f"{WORKSPACE_LABEL_PREFIX}/name": app_settings.workspace_id,  # Parent workspace
        f"{WORKSPACE_LABEL_PREFIX}/managed": "true",  # Managed by controller
        f"{WORKSPACE_LABEL_PREFIX}/type": name,  # Type of workspace app
    }
    try:
        await asyncio.to_thread(
            reconcile_workspace_app,
            spec,
            name,
            namespace,
            create_labels,
            logger,
        )
        patch.status["phase"] = "Ready"
        patch.status["lastReconcileTime"] = datetime.now(timezone.utc).isoformat()
    except Exception as e:
        logger.error(f"Failed to create: {e}")
        patch.status["phase"] = "Failed"
        patch.status["error"] = str(e)
        raise


@kopf.on.update(app_settings.platform_group, app_settings.platform_version, "workspaceapplications")  # type: ignore
def workspace_app_on_update(spec, name, namespace, patch, logger, **_):
    """Reconcile on spec changes"""
    patch.status["phase"] = "Reconciling"

    # TODO: labeling
    labels = {}
    try:
        reconcile_workspace_app(spec, name, namespace, labels, logger)
        patch.status["phase"] = "Ready"
    except Exception as e:
        logger.error(f"Failed to reconcile: {e}")
        patch.status["phase"] = "Failed"
        raise


@kopf.on.delete(app_settings.platform_group, app_settings.platform_version, "workspaceapplications")  # type: ignore
def workspace_app_on_delete(spec, name, namespace, patch, meta, logger, **_):
    """Clean up child resources - BLOCKS deletion until complete"""
    logger.info(f"Deleting workspace app: {name}")
    patch.status["phase"] = "Deleting"

    try:
        # TODO: Delete child resources here
        # cleanup_workspace_app_child_resources(name, namespace, logger)

        # Remove finalizer to allow deletion
        finalizers = list(meta.get("finalizers", []))
        if FINALIZER in finalizers:
            finalizers.remove(FINALIZER)
            patch.metadata["finalizers"] = finalizers
            logger.debug(f"Removed finalizer: {FINALIZER}")

        logger.info(f"Successfully deleted workspace app: {name}")
    except Exception as e:
        logger.error(f"Failed to delete: {e}")
        patch.status["phase"] = "DeletionFailed"
        raise kopf.PermanentError(f"Deletion failed: {e}")


# # Add timer for drift detection and periodic reconciliation
# @kopf.timer(
#     app_settings.platform_group,
#     app_settings.platform_version,
#     "workspaceapplications",
#     interval=5,
#     # interval=30.0,  # Every 5 minutes
#     # idle=60.0,  # Start after 60s of no changes
# )  # type: ignore
# def workspace_app_timer(spec, name, namespace, status, logger, **_):
#     """Periodic reconciliation to detect drift"""
#     print("kajajaja")
#     try:
#         # Check existing workspace CR
#         get_workspace_cr(
#             name=app_settings.workspace_id,
#             logger=logger,
#             namespace=app_settings.workspace_namespace,
#         )

#         # if status.get("phase") not in ["Ready", "Failed"]:
#         #     return  # Skip if already reconciling

#         # reconcile_workspace_app(spec, name, namespace, {}, logger)
#     except Exception as e:
#         logger.error(f"Timer reconciliation failed: {e}")


from kubernetes import client


def reconcile_workspace_app(spec, name, namespace, labels, logger):
    """
    Reconcile workspace app with label propagation
    """
    logger.info(f"Reconciling workspace app: {name} in {namespace}")

    # Prepare labels for child resources
    child_labels = {
        # Inherit from parent
        **labels,
        # Add child-specific labels
        "app.kubernetes.io/part-of": name,
    }

    core_v1 = client.CoreV1Api()
    apps_v1 = client.AppsV1Api()

    # # Example: Create ConfigMap with labels
    # configmap = client.V1ConfigMap(
    #     metadata=client.V1ObjectMeta(
    #         name=f"{name}-config",
    #         namespace=namespace,
    #         labels=child_labels,
    #         owner_references=[
    #             client.V1OwnerReference(
    #                 api_version=f"{app_settings.platform_group}/{app_settings.platform_version}",
    #                 kind="WorkspaceApplication",
    #                 name=name,
    #                 uid=spec.get("uid"),  # You'll need to pass this
    #                 controller=True,
    #                 block_owner_deletion=True
    #             )
    #         ]
    #     ),
    #     data=spec.get("config", {})
    # )

    # try:
    #     core_v1.read_namespaced_config_map(f"{name}-config", namespace)
    #     core_v1.patch_namespaced_config_map(f"{name}-config", namespace, configmap)
    #     logger.info(f"Updated ConfigMap {name}-config")
    # except client.exceptions.ApiException as e:
    #     if e.status == 404:
    #         core_v1.create_namespaced_config_map(namespace, configmap)
    #         logger.info(f"Created ConfigMap {name}-config")
    #     else:
    #         raise

    # # Example: Create Deployment with labels
    # deployment = client.V1Deployment(
    #     metadata=client.V1ObjectMeta(
    #         name=f"{name}-deployment",
    #         namespace=namespace,
    #         labels=child_labels
    #     ),
    #     spec=client.V1DeploymentSpec(
    #         replicas=spec.get("replicas", 1),
    #         selector=client.V1LabelSelector(
    #             match_labels={"app": name}
    #         ),
    #         template=client.V1PodTemplateSpec(
    #             metadata=client.V1ObjectMeta(
    #                 labels={**child_labels, "app": name}
    #             ),
    #             spec=client.V1PodSpec(
    #                 containers=[
    #                     client.V1Container(
    #                         name=name,
    #                         image=spec.get("image", "nginx:latest"),
    #                         ports=[client.V1ContainerPort(container_port=8080)]
    #                     )
    #                 ]
    #             )
    #         )
    #     )
    # )

    # try:
    #     apps_v1.read_namespaced_deployment(f"{name}-deployment", namespace)
    #     apps_v1.patch_namespaced_deployment(f"{name}-deployment", namespace, deployment)
    #     logger.info(f"Updated Deployment {name}-deployment")
    # except client.exceptions.ApiException as e:
    #     if e.status == 404:
    #         apps_v1.create_namespaced_deployment(namespace, deployment)
    #         logger.info(f"Created Deployment {name}-deployment")
    #     else:
    #         raise

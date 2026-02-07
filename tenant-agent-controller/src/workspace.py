from typing import Optional
import requests
from kubernetes import client
from kubernetes.client.exceptions import ApiException
from schemas import WorkspacePollResponse
from settings import app_settings

WORKSPACE_ID = app_settings.workspace_id


def create_workspace_cr(logger) -> None:
    """Create the Workspace CR if it doesn't exist."""
    api = client.CustomObjectsApi()
    core_api = client.CoreV1Api()

    # Ensure namespace exists
    try:
        core_api.read_namespace(name=app_settings.workload_namespace)
    except ApiException as e:
        if e.status == 404:
            logger.info(f"Creating namespace {app_settings.workload_namespace}")
            core_api.create_namespace(
                body=client.V1Namespace(
                    metadata=client.V1ObjectMeta(name=app_settings.workload_namespace)
                )
            )
        else:
            raise

    workspace_name = WORKSPACE_ID
    workspace_body = {
        "apiVersion": f"{app_settings.platform_group}/{app_settings.platform_version}",
        "kind": "Workspace",
        "metadata": {
            "name": workspace_name,
            "namespace": app_settings.workload_namespace,
        },
        "spec": {
            "extWorkspaceId": workspace_name,
        },
    }

    try:
        api.get_namespaced_custom_object(
            group=app_settings.platform_group,
            version=app_settings.platform_version,
            namespace=app_settings.workload_namespace,
            plural="workspaces",
            name=workspace_name,
        )
        logger.info(f"Workspace CR {workspace_name} already exists")
    except ApiException as e:
        if e.status == 404:
            logger.info(f"Creating Workspace CR {workspace_name}")
            api.create_namespaced_custom_object(
                group=app_settings.platform_group,
                version=app_settings.platform_version,
                namespace=app_settings.workload_namespace,
                plural="workspaces",
                body=workspace_body,
            )
        else:
            raise


def get_workspace_cr(name, logger, namespace=None):
    api = client.CustomObjectsApi()
    _namespace = app_settings.workload_namespace
    if namespace is not None and namespace != "":
        _namespace = namespace
    try:
        api.get_namespaced_custom_object(
            group=app_settings.platform_group,
            version=app_settings.platform_version,
            namespace=app_settings.workload_namespace,
            plural="workspaces",
            name=name,
        )
        logger.info(f"Workspace found: {name}")
    except ApiException as e:
        raise


def delete_workspace_cr(name, logger):
    logger.info(f"Deleting Workspace {name}")

    api = client.CustomObjectsApi()
    try:
        api.delete_namespaced_custom_object(
            group=app_settings.platform_group,
            version=app_settings.platform_version,
            namespace=app_settings.workload_namespace,
            plural="workspaces",
            name=name,
        )
        logger.info(f"Deleted Workspace CR: {name}")
    except ApiException as e:
        logger.error(f"Failed to delete Workspace CR {name}: {e}")

from typing import Optional
import requests
from kubernetes import client
from kubernetes.client.exceptions import ApiException
from schemas import WorkspacePollResponse
from settings import app_settings


def fetch_workspace(logger) -> Optional[WorkspacePollResponse]:
    try:
        response = requests.get(
            app_settings.workspace_polling_url,
            timeout=5,
            verify=app_settings.controller_verify_ca,
        )
        response.raise_for_status()
        config = response.json()
        logger.debug(f"Fetched workspace config: {config}")
        logger.info(f"Fetched workspace config")
        return WorkspacePollResponse(**config)
    except requests.RequestException as e:
        logger.error(f"Failed to fetch workspace config: {e}")
        return None

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

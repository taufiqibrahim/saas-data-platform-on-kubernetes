import asyncio
import hashlib
import json
import logging
import subprocess
from kubernetes import client
from kubernetes.client.exceptions import ApiException
from typing import Dict, List, Optional

import yaml

from schemas import WorkspaceAppPollResponse, WorkspacePollResponse
from settings import app_settings
from addon_handlers import get_addon, install_vela_addon, uninstall_vela_addon


ADDON_REGISTRY_NAME = app_settings.vela_addon_registry_name
WORKSPACE_APP_FINALIZER = f"workspaceapplication.{app_settings.platform_group}/cleanup"
WORKSPACE_APPLICATIONS = "workspaceapplications"


def get_addon_identifier(name):
    return f"{ADDON_REGISTRY_NAME}/{name}"


def get_workspace_app_cr(name, logger, namespace=None):
    api = client.CustomObjectsApi()
    _namespace = app_settings.workload_namespace
    if namespace is not None and namespace != "":
        _namespace = namespace
    try:
        obj = api.get_namespaced_custom_object(
            group=app_settings.platform_group,
            version=app_settings.platform_version,
            namespace=_namespace,
            plural=WORKSPACE_APPLICATIONS,
            name=name,
        )
        status = obj.get("status", {}).get("phase")  # type: ignore
        logger.debug(f"Workspace application found: {name} [{status}]")
        return obj
    except ApiException as e:
        if e.status == 404:
            return None


def get_or_create_workspace_app_cr(name, version, logger, namespace=None):
    api = client.CustomObjectsApi()
    _namespace = app_settings.workload_namespace
    if namespace is not None and namespace != "":
        _namespace = namespace
    try:
        obj = api.get_namespaced_custom_object(
            group=app_settings.platform_group,
            version=app_settings.platform_version,
            namespace=_namespace,
            plural=WORKSPACE_APPLICATIONS,
            name=name,
        )
        status = obj.get("status", {}).get("phase")  # type: ignore
        logger.debug(f"Workspace application found: {name} [{status}]")
        return obj
    except ApiException as e:
        if e.status == 404:
            body = {
                "apiVersion": f"{app_settings.platform_group}/{app_settings.platform_version}",
                "kind": "WorkspaceApplication",
                "metadata": {
                    "name": name,
                    "namespace": _namespace,
                },
                "spec": {
                    "workspace": app_settings.workspace_id,
                    "name": name,
                    "version": version,
                },
            }
            obj = api.create_namespaced_custom_object(
                group=app_settings.platform_group,
                version=app_settings.platform_version,
                namespace=_namespace,
                plural=WORKSPACE_APPLICATIONS,
                body=body,
            )
            logger.info(f"Workspace application is created: {name}")
            return obj
        else:
            logger.error(f"Workspace application error: {name} {e.reason}")


def list_workspace_apps_cr(
    namespace: Optional[str] = None,
    labels: Optional[Dict[str, str]] = None,
    logger: Optional[logging.Logger] = None,
) -> List[Dict]:
    """
    List WorkspaceApplication CRDs with optional filtering

    Args:
        namespace: Namespace to search in. If None, searches all namespaces
        labels: Dictionary of labels to filter by. Example: {"workspace": "my-workspace"}
        logger: Logger instance

    Returns:
        List of WorkspaceApplication resources as dictionaries
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    try:
        api = client.CustomObjectsApi()

        # Build label selector string
        label_selector = None
        if labels:
            label_selector = ",".join([f"{k}={v}" for k, v in labels.items()])
            logger.debug(f"Filtering with labels: {label_selector}")

        # List workspace applications
        if namespace:
            # List in specific namespace
            response = api.list_namespaced_custom_object(
                group=app_settings.platform_group,
                version=app_settings.platform_version,
                namespace=namespace,
                plural=WORKSPACE_APPLICATIONS,
                label_selector=label_selector,
            )
        else:
            # List across all namespaces
            response = api.list_cluster_custom_object(
                group=app_settings.platform_group,
                version=app_settings.platform_version,
                plural=WORKSPACE_APPLICATIONS,
                label_selector=label_selector,
            )

        items = response.get("items", [])
        logger.info(f"Workspace applications count: {len(items)}")

        return items

    except ApiException as e:
        if e.status == 404:
            logger.warning("WorkspaceApplication CRD not found")
            return []
        else:
            logger.error(f"Failed to list workspace applications: {e}")
            raise


def remove_workspace_app_finalizer(name, namespace, finalizer, logger):
    """Remove a finalizer from a WorkspaceApplication to allow deletion"""
    api = client.CustomObjectsApi()
    try:
        obj = api.get_namespaced_custom_object(
            group=app_settings.platform_group,
            version=app_settings.platform_version,
            namespace=namespace,
            plural=WORKSPACE_APPLICATIONS,
            name=name,
        )
        finalizers = obj.get("metadata", {}).get("finalizers", [])  # type: ignore
        if finalizer in finalizers:
            finalizers.remove(finalizer)
            api.patch_namespaced_custom_object(
                group=app_settings.platform_group,
                version=app_settings.platform_version,
                namespace=namespace,
                plural=WORKSPACE_APPLICATIONS,
                name=name,
                body={"metadata": {"finalizers": finalizers}},
            )
            logger.info(f"Removed finalizer {finalizer} from {name}")
    except Exception as e:
        logger.error(f"Failed to remove finalizer from {name}: {e}")


async def delete_workspace_app_cr(name, logger, namespace=None):
    api = client.CustomObjectsApi()
    _namespace = app_settings.workload_namespace
    if namespace is not None and namespace != "":
        _namespace = namespace

    workspace_app_cr = get_workspace_app_cr(name, logger, _namespace)
    if not (workspace_app_cr):
        return

    try:
        api.delete_namespaced_custom_object(
            group=app_settings.platform_group,
            version=app_settings.platform_version,
            namespace=_namespace,
            plural=WORKSPACE_APPLICATIONS,
            name=name,
        )

        addon_name = f"addon-{name}"
        addon = get_addon(addon_name, logger)
        if addon is None:
            logger.info(
                f"Addon {addon_name} is gone, removing finalizer to complete deletion"
            )
            await asyncio.to_thread(
                remove_workspace_app_finalizer,
                name,
                app_settings.workload_namespace,
                WORKSPACE_APP_FINALIZER,
                logger,
            )
        else:
            addon_status = addon.get("status", {}).get("status")  # type: ignore
            logger.info(
                f"Waiting for addon {addon_name} to be deleted (status: {addon_status})"
            )

        # logger.info(f"Delete in process workspace application: {name}")
    except ApiException as e:
        if e.status == 404:
            logger.error(f"Workspace application not found: {name}")
            return
        else:
            raise


def cleanup_workspace_app_resources(
    *, name: str, namespace: str, logger: logging.Logger
) -> None:
    logger.info(f"Clean up workspace app: {name} in {namespace}")

    # Check if Addon exist
    addon_name = f"addon-{name}"
    addon = get_addon(addon_name, logger)
    addon_status = (
        addon.get("status", {}).get("status") if addon else None  # type: ignore
    )

    # Uninstall the addon
    if addon:
        uninstall_vela_addon(
            addon_name=name,
            logger=logger,
        )
    else:
        logger.error(f"Workspace application addon not found: {name}")
        raise


def reconcile_workspace_app(spec, name, namespace, logger):
    """
    Reconcile workspace app with label propagation
    """
    logger.info(f"Reconciling workspace app: {namespace}/{name}")

    # Check if Addon exist
    addon_name = f"addon-{name}"
    addon_version = spec["version"]
    addon_identifier = get_addon_identifier(name=name)
    addon = get_addon(addon_name, logger)
    # addon_status = (
    #     addon.get("status", {}).get("status") if addon else None  # type: ignore
    # )

    # # Install the addon if not running
    if addon is None:
        install_vela_addon(
            addon_identifier=addon_identifier,
            addon_parameters={},
            addon_version=addon_version,
            logger=logger,
        )

    # Check if addon is running and healthy

    # raise NotImplementedError

    logger.info(f"Reconciled workspace app: {namespace}/{name}")

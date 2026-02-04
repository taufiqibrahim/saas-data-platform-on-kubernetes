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


def run_vela_addon(
    args: list, logger: logging.Logger, capture_output: bool = True
) -> Optional[str]:
    """
    Run a `vela addon` CLI command.

    Args:
        args (list(str)): The CLI command arguments after `vela addon`, e.g. ["list"] or ["enable", "my-addon"]
        capture_output (bool): If True, returns the command output as a string.
                               If False, prints output directly.

    Returns:
        Optional[str]: The command output if capture_output is True, otherwise None.
    """
    full_command = ["vela", "addon"] + args
    logger.info(f"Running command: {full_command}")

    try:
        if capture_output:
            # Capture output
            result = subprocess.run(
                full_command,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            output = result.stdout.strip()
            return output
        else:
            # Just run and show output directly
            subprocess.run(full_command, check=True)
            return None
    except subprocess.CalledProcessError as e:
        print(f"Command failed with return code {e.returncode}")
        print("stdout:", e.stdout)
        print("stderr:", e.stderr)
        return None


def get_addon(addon_name, logger):
    try:
        api = client.CustomObjectsApi()
        obj = api.get_namespaced_custom_object(
            group="core.oam.dev",
            version="v1beta1",
            namespace=app_settings.vela_system_namespace,
            plural="applications",
            name=addon_name,
        )
        logger.info(
            f"Addon {addon_name} found in namespace {app_settings.vela_system_namespace}"
        )
        return obj
    except ApiException as e:
        if e.status == 404:
            logger.warn(
                f"Addon {addon_name} is not found in namespace {app_settings.vela_system_namespace}"
            )
            return None
        else:
            raise


def install_vela_addon(addon_name, addon_version, addon_parameters, logger):
    logger.info(f"Installing addon: {addon_name}")

    addon_render_output = run_vela_addon(
        ["enable", addon_name, "--version", addon_version, "--dry-run"],
        logger,
        capture_output=True,
    )
    print(addon_render_output)

    body = yaml.safe_load(str(addon_render_output))
    api = client.CustomObjectsApi()
    api.create_namespaced_custom_object(
        group="core.oam.dev",
        version="v1beta1",
        namespace=app_settings.vela_system_namespace,
        plural="applications",
        body=body,
    )
    return


def uninstall_vela_addon(addon_name, logger):
    logger.info(f"Uninstalling addon: {addon_name}")
    output = run_vela_addon(
        ["uninstall", addon_name],
        logger,
        capture_output=False,
    )
    logger.info(f"Uninstall addon {addon_name} output: {output}")


def compute_digest(spec):
    spec_bytes = json.dumps(spec, sort_keys=True).encode("utf-8")
    return hashlib.sha256(spec_bytes).hexdigest()


def desired_workspace_application_cr(app_name, workspace_name, status, namespace):
    return {
        "apiVersion": f"{app_settings.platform_group}/{app_settings.platform_version}",
        "kind": "WorkspaceApplication",
        "metadata": {
            "name": app_name,
            "namespace": namespace,
        },
        "spec": {
            "workspaceRef": workspace_name,
            "name": app_name,
            "status": status,
        },
    }


def list_workspace_apps(
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
                plural="workspaceapplications",
                label_selector=label_selector,
            )
        else:
            # List across all namespaces
            response = api.list_cluster_custom_object(
                group=app_settings.platform_group,
                version=app_settings.platform_version,
                plural="workspaceapplications",
                label_selector=label_selector,
            )

        items = response.get("items", [])
        logger.info(f"Found {len(items)} workspace applications")

        return items

    except ApiException as e:
        if e.status == 404:
            logger.warning("WorkspaceApplication CRD not found")
            return []
        else:
            logger.error(f"Failed to list workspace applications: {e}")
            raise


def get_workspace_app(name: str, namespace: str, logger: logging.Logger):
    """
    Get a specific WorkspaceApplication CRD

    Args:
        name: Name of the workspace application
        namespace: Namespace of the workspace application
        logger: Logger instance

    Returns:
        WorkspaceApplication resource as dictionary or None if not found
    """
    try:
        api = client.CustomObjectsApi()

        app = api.get_namespaced_custom_object(
            group=app_settings.platform_group,
            version=app_settings.platform_version,
            namespace=namespace,
            plural="workspaceapplications",
            name=name,
        )

        logger.info(f"Found workspace app: {name} in {namespace}")
        return app

    except ApiException as e:
        if e.status == 404:
            logger.info(f"Workspace app not found: {name} in {namespace}")
            return None
        else:
            logger.error(f"Failed to get workspace app: {e}")
            raise


def count_workspace_apps_for_workspace(
    workspace_name: str, logger: logging.Logger
) -> int:
    """
    Count how many workspace applications belong to a specific workspace

    Args:
        workspace_name: Name of the workspace
        logger: Logger instance

    Returns:
        Number of workspace applications
    """
    apps = list_workspace_apps(
        labels={"workspace.platform.io/name": workspace_name}, logger=logger
    )
    return len(apps)


def get_or_create_workspace_app(name, logger, namespace=None):
    api = client.CustomObjectsApi()
    _namespace = app_settings.workload_namespace
    if namespace is not None and namespace != "":
        _namespace = namespace
    try:
        obj = api.get_namespaced_custom_object(
            group=app_settings.platform_group,
            version=app_settings.platform_version,
            namespace=_namespace,
            plural="workspaceapplications",
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
                },
            }
            obj = api.create_namespaced_custom_object(
                group=app_settings.platform_group,
                version=app_settings.platform_version,
                namespace=_namespace,
                plural="workspaceapplications",
                body=body,
            )
            logger.info(f"Workspace application is created: {name}")
            return obj
        else:
            logger.error(f"Workspace application error: {name} {e.reason}")


def delete_workspace_app(name, logger, namespace=None):
    api = client.CustomObjectsApi()
    _namespace = app_settings.workload_namespace
    if namespace is not None and namespace != "":
        _namespace = namespace
    try:
        api.delete_namespaced_custom_object(
            group=app_settings.platform_group,
            version=app_settings.platform_version,
            namespace=_namespace,
            plural="workspaceapplications",
            name=name,
        )
        logger.info(f"Workspace application deleted: {name}")
    except ApiException as e:
        if e.status == 404:
            logger.error(f"Workspace application not found: {name}")
            return
        else:
            raise


def handle_workspace_app_addon(app: WorkspaceAppPollResponse, logger: logging.Logger):
    addon_name = f"addon-{app.name}"
    logger.info(f"Handling workspace app addon: {addon_name}")

    # Check if Addon exist
    addon_exists = get_addon(addon_name, logger)
    addon_status = (
        addon_exists.get("status", {}).get("status") if addon_exists else None  # type: ignore
    )
    print(addon_name, addon_status)

    # #
    # if addon_status != "running" or addon_status is None:
    #     install_vela_addon()


# @kopf.timer(app_settings.platform_group, app_settings.platform_version, "workspaceapplications", interval=10)  # type: ignore
# def sync_workspace_app(spec, status, patch, logger, name, namespace, **_):
#     phase = status.get("phase")
#     print("phase", phase)
#     addon_name = "addon-" + name

#     # 1. Ready → do nothing
#     if phase == "Ready":
#         return

#     # logger.info(f"Phase: {phase}, syncing {name} in {app_settings.workload_namespace}")

#     # 2. Check if Addon exist
#     addon_exists = get_addon(addon_name, logger)
#     addon_status = addon_exists.get('status', {}).get("status") if addon_exists else None

#     # # 3. Decide what to do
#     # if phase in (None, "Pending") or not addon_exists:
#     #     patch.status["phase"] = "Reconciling"
#     #     logger.info(f"Enabling addon: {addon_name}")
#     #     addon_request = run_vela_addon(
#     #         ["enable", name, "--dry-run"], logger, capture_output=True
#     #     )
#     #     print(addon_request)
#     #     api.create_namespaced_custom_object(
#     #         group='core.oam.dev',
#     #         version='v1beta1',
#     #         namespace=app_settings.vela_system_namespace,
#     #         plural="applications",
#     #         body=yaml.safe_load(str(addon_request)),
#     #     )
#     #     return

#     if phase == "Reconciling":
#         if addon_status == 'running':
#             logger.info(f"Marking workspace app {name} as Running")
#             patch.status["phase"] = "Running"

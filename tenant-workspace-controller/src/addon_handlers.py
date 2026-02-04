import logging
import subprocess
from kubernetes import client
from kubernetes.client.exceptions import ApiException
from typing import Optional

import yaml

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
        logger.debug(f"Get addon: {obj}")
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


def install_vela_addon(addon_identifier, addon_version, addon_parameters, logger):
    logger.info(f"Installing addon: {addon_identifier}")

    addon_render_output = run_vela_addon(
        ["enable", addon_identifier, "--version", addon_version, "--dry-run"],
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

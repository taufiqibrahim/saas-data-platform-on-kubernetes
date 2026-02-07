from datetime import datetime, timezone
from kubernetes import client
from kubernetes.client.exceptions import ApiException
from pathlib import Path
import yaml

# CRDs directory path
CRDS_DIR = Path(__file__).parent.parent / "crds"


def install_crds(logger) -> None:
    """Install CRDs from the crds directory."""
    api = client.ApiextensionsV1Api()

    for crd_file in CRDS_DIR.glob("*.yaml"):
        logger.info(f"Loading CRD from {crd_file.name}")
        with open(crd_file) as f:
            crd_manifest = yaml.safe_load(f)

        crd_name = crd_manifest["metadata"]["name"]

        try:
            # Check if CRD exists
            api.read_custom_resource_definition(name=crd_name)
            logger.info(f"CRD {crd_name} already exists, updating...")
            api.patch_custom_resource_definition(
                name=crd_name,
                body=crd_manifest,
            )
        except ApiException as e:
            if e.status == 404:
                logger.info(f"Creating CRD {crd_name}")
                api.create_custom_resource_definition(body=crd_manifest)
            else:
                raise


async def create_kubernetes_event(
    body, reason, message, event_type="Normal", logger=None
):
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
            source=client.V1EventSource(component="tenant-agent-controller"),
        )

        v1.create_namespaced_event(meta.get("namespace"), event)
    except Exception as e:
        if logger:
            logger.error(f"Failed to create event: {e}")

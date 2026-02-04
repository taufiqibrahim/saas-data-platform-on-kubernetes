from datetime import datetime, timezone
from kubernetes import client


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
            source=client.V1EventSource(component="tenant-workspace-controller"),
        )

        v1.create_namespaced_event(meta.get("namespace"), event)
    except Exception as e:
        if logger:
            logger.error(f"Failed to create event: {e}")

from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[1]  # project root


class Settings(BaseSettings):

    # Controller
    controller_timer_interval: float = 10
    ca_path: str
    cert_path: str = "/etc/certs/client.crt"
    key_path: str = "/etc/certs/client.key"
    ca_path: str = "/etc/certs/ca.crt"

    # Platform
    platform_group: str = "platform.saas.internal"
    platform_version: str = "v1alpha1"

    # KubeVela
    vela_system_namespace: str = "vela-system"
    vela_addon_registry_name: str

    # Workspace
    workspace_id: str
    control_plane_base_url: str

    # Workload
    workload_namespace: str = "saas-workload"

    # Status
    # workspace_app_created_status: str = "PROVISIONING"

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="allow",
    )


app_settings = Settings()  # type: ignore

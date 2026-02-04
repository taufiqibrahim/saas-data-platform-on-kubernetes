from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[1]  # project root
print(BASE_DIR)


class Settings(BaseSettings):
    # Controller
    controller_timer_interval: float = 10
    controller_verify_ca: bool = True

    # Platform
    platform_group: str = "platform.saas.internal"
    platform_version: str = "v1alpha1"

    # KubeVela
    vela_system_namespace: str = "vela-system"
    vela_addon_registry_name: str

    # Workspace
    workspace_id: str
    workspace_ca_path: str
    workspace_polling_url: str

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

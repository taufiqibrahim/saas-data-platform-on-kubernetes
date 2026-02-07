from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class JupyterHubParams(BaseModel):
    enabled: bool = False
    helm_values: Optional[Dict[str, Any]] = Field(default_factory=dict)


class Parameters(BaseModel):
    jupyterhub: Optional[JupyterHubParams] = Field(default_factory=JupyterHubParams)


class WorkspaceSpec(BaseModel):
    extWorkspaceId: str
    bootstrapToken: str


class WorkspaceAppPollResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    uid: str
    name: str
    namespace: Optional[str] = None
    version: str
    status: str


class WorkspacePollResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    status: str
    extWorkspaceId: str

    workspaceApps: List[WorkspaceAppPollResponse]

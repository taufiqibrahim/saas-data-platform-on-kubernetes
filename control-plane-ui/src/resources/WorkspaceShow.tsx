import { RecordField, Show } from "@/components/admin";
import { CopyCell } from "@/components/custom/copy-cell";
import { AgentBootstrapCommand } from "@/components/custom/workspace/agent-bootstrap-command";

export const WorkspaceShow = () => (
  <Show title="Workspace">
    <div className="flex flex-col gap-4">
      <RecordField
        source="extWorkspaceId"
        label="Workspace external ID"
        render={(record: any) => <CopyCell value={record.extWorkspaceId} />}
      />

      <RecordField
        source="uid"
        label="Workspace UID"
        render={(record: any) => <CopyCell value={record.uid} />}
      />

      <RecordField source="name" label="Workspace name" />

      <RecordField source="status" label="Status" />

      <RecordField source="account.platformProvider.displayName" label="Platform" />

      <RecordField source="createdAt" label="Created at" />
      <RecordField source="createdBy.email" label="Created by" />

      <RecordField source="updatedAt" label="Last updated at" />

      <AgentBootstrapCommand />
    </div>
  </Show>
)
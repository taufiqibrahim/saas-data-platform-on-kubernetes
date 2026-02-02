import { RecordField, Show } from "@/components/admin";
import { CopyCell } from "@/components/custom/copy-cell";
import { BootstrapClusterButton } from "@/components/custom/workspace/bootstrap-cluster-button";

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

      <RecordField source="createdAt" label="Created at" />
      <RecordField source="createdBy.email" label="Created by" />

      <RecordField source="updatedAt" label="Last updated at" />

      <BootstrapClusterButton />

    </div>
  </Show>
)
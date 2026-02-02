import { DataTable, DateField, List, SearchInput } from "@/components/admin";
import { CopyCell } from "@/components/custom/copy-cell";

const workspaceFilters = [
  <SearchInput source="q" alwaysOn />,
];

export const WorkspaceList = () => (
  <List title={"Workspaces"} filters={workspaceFilters} debounce={600}>
    <DataTable bulkActionButtons={false}>
      {/* <DataTable.Col source="uid" /> */}
      <DataTable.Col source="name" label="Workspace Name" />
      <DataTable.Col
        source="extWorkspaceId"
        label="External Workspace ID"
        render={(record: any) => <CopyCell value={record.extWorkspaceId} />} />
      <DataTable.Col source="status" label="Status" />
      <DataTable.Col source="createdAt"
        render={(record: any) => <DateField record={record} source="createdAt" showTime={true} />}
      />
      <DataTable.Col source="createdBy.email" label="Created by" />
    </DataTable>
  </List>
);

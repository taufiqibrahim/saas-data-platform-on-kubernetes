import { DataTable, DateField, List, SearchInput } from "@/components/admin";
import { CopyCell } from "@/components/custom/copy-cell";

const accountFilters = [
  <SearchInput source="q" alwaysOn />,

];

export const AccountList = () => (
  <List
    title={"Accounts"}
    filters={accountFilters}
    debounce={600}
    sort={{field: 'createdAt', order: 'DESC'}}
  >
    <DataTable bulkActionButtons={false}>
      <DataTable.Col source="name" label="Account Name" />
      <DataTable.Col
        source="extAccountId"
        label="Ext Account ID"
        render={(record: any) => <CopyCell value={record.extAccountId} />} />
      <DataTable.Col source="status" label="Status" />
      <DataTable.Col source="platformProvider.displayName" label="Platform" disableSort />
      <DataTable.Col source="platformProviderRegion.displayName" label="Region" disableSort />
      <DataTable.Col source="createdAt" sortByOrder="DESC"
        render={
          (record: any) => <DateField record={record} source="createdAt" showTime />
        }
      />
      <DataTable.Col source="createdBy.email" label="Created by" />
    </DataTable>
  </List>
);

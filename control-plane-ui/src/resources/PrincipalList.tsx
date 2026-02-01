import { DataTable, DateField, List, SearchInput, TextInput } from "@/components/admin";
import { CopyCell } from "@/components/custom/copy-cell";

const principalFilters = [
  <SearchInput source="q" alwaysOn />,
  <TextInput label="Title" source="title" defaultValue="Hello, World!" />,
];

export const PrincipalList = () => (
  <List title={"Principals"} filters={principalFilters} debounce={600}>
    <DataTable bulkActionButtons={false}>
      <DataTable.Col source="uid" />
      <DataTable.Col source="email"
        label="Email"
        render={(record: any) => <CopyCell value={record.email} />} />
      <DataTable.Col source="kind" />
      <DataTable.Col source="createdAt"
        render={(record: any) => <DateField record={record} source="createdAt" showTime={true} />}
      />
    </DataTable>
  </List>
);

import { DataTable, List } from "@/components/admin";

// import { useRecordContext } from "ra-core";
// import { Link } from "react-router";

// const ShowRegionButton = () => {
//     const platformProvider = useRecordContext();
//     return (
//         <Link className="bg-dark" to={`/platformProviders/${platformProvider?.uid}/regions`}>
//             Regions
//         </Link>
//     );
// };

export const PlatformProviderList = () => (
  <List title={"Platform Providers"} pagination={false}>
    <DataTable bulkActionButtons={false}>
      <DataTable.Col source="name" label="Name" />
      <DataTable.Col source="displayName" label="Display Name" />
      {/* <DataTable.Col
        source="displayName"
        label="Regions"
        render={() => <ShowRegionButton />}
      /> */}
    </DataTable>
  </List>
);

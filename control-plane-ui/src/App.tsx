import { Admin } from "@/components/admin";
import { CustomRoutes, Resource } from 'ra-core';
import { dataProvider } from "./dataProvider";
import { authProvider } from "./authProvider";

import { PlatformProviderList } from "./resources/PlatformProviderList";
import { PrincipalList } from "./resources/PrincipalList";
import { AccountList } from "./resources/AccountList";
import { WorkspaceList } from "./resources/WorkspaceList";
import { AccountProvisioning } from "./resources/AccountProvisioning";
import { Route } from "react-router";
import { PlatformProviderRegionList } from "./resources/PlatformProviderRegionList";
import { FoldersIcon, IdCardIcon, MonitorCheckIcon, ShieldUserIcon } from "lucide-react";
import { Account } from "./resources/Account";
import { CustomLayout } from "./components/custom/layout";
import { WorkspaceProvisioning } from "./resources/WorkspaceCreate";
import { WorkspaceShow } from "./resources/WorkspaceShow";

const App = () => {

    return (
        <Admin
            authProvider={authProvider}
            dataProvider={dataProvider}
            layout={CustomLayout}
        >
            <Resource
                name="platformProviders"
                icon={MonitorCheckIcon}
                list={PlatformProviderList}
                options={{ label: "Platform Providers" }}
            >
                <Route
                    path=":platformProviderUid/regions"
                    element={<PlatformProviderRegionList />}
                />
            </Resource>

            <Resource
                name="admin/principals"
                icon={IdCardIcon}
                list={PrincipalList}
                options={{ label: "Principals" }}
            />

            <Resource
                name="admin/accounts"
                key="admin/accounts"
                icon={ShieldUserIcon}
                list={AccountList}
                create={AccountProvisioning}
                options={{ label: "Accounts" }}
            />

            <CustomRoutes>
                <Route path="/account" element={<Account />} />
            </CustomRoutes>

            <Resource
                name="workspaces"
                icon={FoldersIcon}
                list={WorkspaceList}
                create={WorkspaceProvisioning}
                show={WorkspaceShow}
                options={{ label: "Workspaces" }}
            />
        </Admin>
    )
}


export default App;

import { AuthProvider } from "ra-core"
import { keycloakAuthProvider } from "./lib/keycloakAuthProvider";
import Keycloak, { KeycloakConfig, KeycloakInitOptions, KeycloakTokenParsed } from "keycloak-js";

export interface CustomAuthProviderMethods extends AuthProvider {
    refreshToken: () => Promise<any>
}

// Here to set options for the keycloak client
const initOptions: KeycloakInitOptions = {
    // Optional: makes Keycloak check that a user session already exists when it initializes
    // and immediately consider the user as authenticated if one exists.
    // onLoad: 'check-sso',
    // Optional: makes Keycloak check that a user session already exists when it initializes and redirect them to the Keycloak login page if not.
    // It's not necessary with react-admin as it already has a process for that (authProvider.checkAuth)
    onLoad: 'login-required',
    // Required when using react-router HashRouter (or createHashRouter)
    // responseMode: 'query'
}

// here to implement the permission mapping logic for react-admin
const getPermissions = (decoded: KeycloakTokenParsed) => {
    console.log(decoded.realm_access)
    // const roles = decoded?.realm_access?.roles;
    // if (!roles) {
    //     return false;
    // }
    // if (roles.includes('admin')) return 'admin';
    // if (roles.includes('user')) return 'user';
    // return false;
    return true
};

const realm = localStorage.getItem("realm")

const config: KeycloakConfig = {
    url: import.meta.env.VITE_KEYCLOAK_URL,
    realm: realm ?? "",
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
};

export const keycloakClient = new Keycloak(config);

const baseAuthProvider = keycloakAuthProvider(keycloakClient, {
    initOptions,
    onPermissions: getPermissions,
});

export const authProvider: AuthProvider = {
    ...baseAuthProvider,
    login: async () => {
        const kc = new Keycloak(config);
        return keycloakAuthProvider(kc, {
            initOptions,
            onPermissions: getPermissions,
            loginRedirectUri: "/",
            logoutRedirectUri: "/",
        }).login
    }
}
interface CreateClientInput {
  realm: string;
  clientId: string;
  redirectUris: string[];
  webOrigins?: string[];
  publicClient?: boolean;
  rootUrl?: string;
  baseUrl?: string;
  attributes?: Record<string, string>;
  shouldGetPublicKey?: boolean;
}

type ClientConfig = {
  client: CreateClientInput;
  roles: string[];
  shouldEnsureClientScopeHasRole?: boolean;
};

type Role = {
  name: string;
  description: string;
};

type WorkspaceBffStack = {
  client: CreateClientInput;
  roles: string[];
};

interface RolesJSON {
  [realmRole: string]: {
    [clientId: string]: string[]; // array of client role names
  };
}

type RealmDefinition = {
  realm: string;
  displayName: string;
  enabled: boolean;
  realmRoles: Role[];
  accountLevelClients: Record<string, ClientConfig>;
  workspaceBffStack: WorkspaceBffStack;
  workspaceAppStack: Record<string, ClientConfig>;
  roles: RolesJSON;
};

export const realmDefinition: RealmDefinition = {
  realm: 'realmName',
  displayName: 'Realm display name',
  enabled: true,
  realmRoles: [
    {
      name: 'platform_admin',
      description: 'Manage users, assign roles, manage policies, view all assets.',
    },
    {
      name: 'data_engineer',
      description: 'Build ETL pipelines, manage Delta tables, schedule jobs.',
    },
    {
      name: 'ml_engineer',
      description: 'Train & deploy models, manage MLflow runs, feature engineering.',
    },
    {
      name: 'data_analyst',
      description: 'Query datasets, build dashboards, limited notebook access.',
    },
    {
      name: 'business_user',
      description: 'View curated dashboards and reports.',
    },
    {
      name: 'data_steward',
      description: 'Tag, classify, and curate datasets, manage metadata/lineage.',
    },
    {
      name: 'tenant_admin',
      description: 'Manage tenant configurations, users, and shared resources.',
    },
    {
      name: 'support_user',
      description:
        'Has full administrative control over the entire platform. Can manage all accounts, users, global settings, and billing at the platform level.',
    },
  ],

  accountLevelClients: {
    controlplane: {
      client: {
        realm: '',
        redirectUris: [],
        clientId: 'controlplane',
        publicClient: true,
        attributes: {},
      },
      roles: ['controlplane-role'],
    },
    'saas-ux': {
      client: {
        realm: '',
        redirectUris: [],
        clientId: 'saas-ux',
        publicClient: true,
        attributes: {},
      },
      roles: ['saas-ux-role'],
    },
  },

  workspaceBffStack: {
    client: {
      realm: 'changeme',
      redirectUris: [],
      clientId: 'saas-bff-api',
      publicClient: false,
      attributes: {
        'standard.token.exchange.enabled': 'true',
      },
    },
    roles: ['role'],
  },

  workspaceAppStack: {
    airflow: {
      client: {
        realm: 'changeme',
        redirectUris: [],
        clientId: 'changeme',
        publicClient: false,
        attributes: {},
      },
      roles: ['workflow_admin', 'workflow_editor', 'workflow_viewer'],
    },
    datahub: {
      client: {
        realm: 'changeme',
        redirectUris: [],
        clientId: 'changeme',
        publicClient: false,
        attributes: {},
      },
      roles: ['datahub_user'],
    },
    grafana: {
      client: {
        realm: 'changeme',
        redirectUris: [],
        clientId: 'changeme',
        publicClient: false,
        attributes: {},
      },
      roles: ['admin'],
    },
    jupyterhub: {
      client: {
        realm: 'changeme',
        redirectUris: [],
        clientId: 'changeme',
        publicClient: false,
        attributes: {},
      },
      roles: ['notebook_user'],
    },
    mlflow: {
      client: {
        realm: 'changeme',
        redirectUris: [],
        clientId: 'changeme',
        publicClient: false,
        attributes: {},
      },
      roles: ['ml_platform_user'],
    },
    superset: {
      client: {
        realm: 'changeme',
        redirectUris: [],
        clientId: 'changeme',
        publicClient: false,
        attributes: {},
      },
      roles: ['dashboard_admin', 'dashboard_editor', 'dashboard_viewer', 'sql_editor_user'],
    },
  },
  roles: {
    platform_admin: {
      airflow: ['workflow_admin'],
      superset: ['dashboard_admin'],
    },
    tenant_admin: {
      airflow: ['workflow_admin'],
      superset: ['dashboard_admin'],
    },
    data_engineer: {
      airflow: ['workflow_editor'],
      superset: ['sql_editor_user', 'dashboard_editor'],
    },
    ml_engineer: {
      superset: ['sql_editor_user'],
      mlflow: ['ml_platform_user'],
    },
    data_analyst: {
      airflow: ['workflow_admin'],
      superset: ['sql_editor_user', 'dashboard_editor'],
    },
    business_user: {
      superset: ['dashboard_viewer'],
    },
  },
};

import dotenv from 'dotenv';

dotenv.config();

export interface RedisConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  maxRetries: number;
  retryDelay: number;
  connectTimeout: number;
}

export interface KeycloakConfig {
  host: string;
  realm: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  webOrigin: string;
}

export interface KeycloakAdminConfig {
  host: string;
  protocol: string;
  port: number;
  realm: string;
  username: string;
  password: string;
}

export interface CORSConfig {
  enabled: boolean;
  origin?: string[];
  credentials?: boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
  optionsSuccessStatus?: number;
}

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user?: string;
    pass?: string;
  };
  starttls: {
    enabled: boolean;
  };
  ssl?: boolean;
  from: string;
}

export interface TemporalConfig {
  address: string;
  namespace: string;
}

export interface TofuAWSConfig {
  region: string;
  s3Bucket: string;
  crossAccountRoleArn: string;
}

export interface TofuConfig {
  tofuRepoUrl: string;
  tofuRepoRevision: string;
  tofuTemplateDir: string;
  aws: TofuAWSConfig;
}

export interface ProvisioningFreeTierAwsConfig {
  defaultRegion: string;
  s3Bucket: string;
  vpcId: string;
  subnetIds: string[];
  securityGroupIds: string[];
  eks_cluster_name: string;
}

export interface AccountWorkflowConfig {
  enabled: boolean;
}

export interface WorkspaceWorkflowConfig {
  enabled: boolean;
}

export interface WorkflowConfig {
  accountWorkflow: AccountWorkflowConfig;
  workspaceWorkflow: WorkspaceWorkflowConfig;
}

export interface AllowedTokens {
  bffToken: string;
}

export interface AppConfig {
  baseUrl: string;
  listenPort: number;
  logLevel: string;
  jsonLimit: string;
  allowedTokens: AllowedTokens;
  nodeEnv: string;
  baseProtocol: string;
  baseDomain: string;
}

export interface Config {
  app: AppConfig;
  cors: CORSConfig;
  smtp: SMTPConfig;
  redis: RedisConfig;
  systemUserEmail: string;
  keycloak: KeycloakConfig;
  keycloakAdmin: KeycloakAdminConfig;
  keycloakProvisioningEnableLocalClients: boolean;
  temporal: TemporalConfig;

  // tofu: TofuConfig;
  // masterRealm: string;
  // controlPlaneClient: string;
  // controlPlaneRedirectURI: string;
  // provisioningFreeTierAWS: ProvisioningFreeTierAwsConfig;
  // workflow: WorkflowConfig;
}

const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  maxRetries: Number(process.env.REDIS_MAX_RETRIES) || 3,
  retryDelay: Number(process.env.REDIS_RETRY_DELAY) || 3,
  connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT) || 5,
};

const keycloakConfig: KeycloakConfig = {
  host: process.env.KEYCLOAK_HOST || 'http://localhost:8080',
  realm: process.env.KEYCLOAK_REALM || 'controlplane',
  issuer: process.env.KEYCLOAK_ISSUER || 'http://localhost:8080/realms/global-users',
  clientId: process.env.KEYCLOAK_CLIENT_ID || 'global-users',
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || 'KEYCLOAK_CLIENT_SECRET',
  redirectUri: process.env.KEYCLOAK_REDIRECT_URI || 'http://localhost:5173/*',
  webOrigin: process.env.KEYCLOAK_WEBORIGIN || 'http://localhost:5173',
};

const keycloakAdminConfig: KeycloakAdminConfig = {
  host: process.env.KEYCLOAK_ADMIN_HOST || 'localhost',
  protocol: process.env.KEYCLOAK_ADMIN_PROTOCOL || 'https',
  port: Number(process.env.KEYCLOAK_ADMIN_PORT) || 443,
  realm: process.env.KEYCLOAK_ADMIN_REALM || 'master',
  username: process.env.KEYCLOAK_ADMIN_USERNAME || 'kcadmin',
  password: process.env.KEYCLOAK_ADMIN_PASSWORD || 'kcadmin',
};

const corsOptions: CORSConfig = {
  enabled: process.env.CORS_ENABLED === 'true',
  origin: process.env.CORS_ALLOWED_ORIGINS?.split(','),
  credentials: process.env.CORS_ALLOW_CREDENTIALS === 'true',
  methods: process.env.CORS_ALLOWED_METHODS?.split(','),
  allowedHeaders: process.env.CORS_ALLOWED_HEADERS?.split(','),
  exposedHeaders: process.env.CORS_EXPOSED_HEADERS?.split(','),
  maxAge: process.env.CORS_MAX_AGE ? Number(process.env.CORS_MAX_AGE) : undefined,
  optionsSuccessStatus: process.env.CORS_OPTIONS_SUCCESS_STATUS
    ? Number(process.env.CORS_OPTIONS_SUCCESS_STATUS)
    : undefined,
};

const smtpConfig: SMTPConfig = {
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  from: process.env.SMTP_MAIL_FROM || 'noreply@example.com',
  starttls: {
    enabled: process.env.SMTP_STARTTLS === 'true',
  },
  ssl: process.env.SMTP_SSL === 'true',
};

const temporalConfig: TemporalConfig = {
  address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  namespace: process.env.TEMPORAL_NAMESPACE || 'default',
};

// const tofuConfig: TofuConfig = {
//   tofuRepoUrl: process.env.TOFU_REPO_URL || 'git@github.com:saas/saas-infra-master.git',
//   tofuRepoRevision: process.env.TOFU_REPO_REVISION || 'core-platform/0.0.1',
//   tofuTemplateDir: process.env.TOFU_TEMPLATE_DIR || '/app/tofu-template',
//   aws: {
//     region: process.env.TOFU_AWS_REGION || 'tofuBackendAwsRegion',
//     s3Bucket: process.env.TOFU_AWS_S3_BUCKET || 'tofuBackendAwsS3Bucket',
//     crossAccountRoleArn: process.env.TOFU_AWS_CROSS_ACCOUNT_ROLE_ARN || '',
//   },
// };

// const provisioningFreeTierAwsConfig: ProvisioningFreeTierAwsConfig = {
//   defaultRegion: process.env.PROVISIONING_FREE_TIER_AWS_DEFAULT_REGION || 'ap-southeast-1',
//   s3Bucket: process.env.PROVISIONING_FREE_TIER_AWS_S3_BUCKET || 'my-bucket',
//   vpcId: process.env.PROVISIONING_FREE_TIER_AWS_VPC_ID || 'vpc-111222333',
//   subnetIds: process.env.PROVISIONING_FREE_TIER_AWS_SUBNET_IDS?.split(',') || [],
//   securityGroupIds: process.env.PROVISIONING_FREE_TIER_AWS_SECURITY_GROUP_IDS?.split(',') || [],
//   eks_cluster_name: process.env.PROVISIONING_FREE_TIER_AWS_EKS_CLUSTER_NAME || 'free-eks-cluster',
// };

// const workflowConfig: WorkflowConfig = {
//   accountWorkflow: {
//     enabled: process.env.ACCOUNT_WORKFLOW_ENABLED ? process.env.ACCOUNT_WORKFLOW_ENABLED === 'true' : true,
//   },
//   workspaceWorkflow: {
//     enabled: process.env.WORKSPACE_WORKFLOW_ENABLED ? process.env.WORKSPACE_WORKFLOW_ENABLED === 'true' : true,
//   },
// };

const listenPort = Number(process.env.LISTEN_PORT) || 5001;

const appConfig: AppConfig = {
  baseUrl: process.env.BASE_URL || `https://localhost:${listenPort}`,
  listenPort: listenPort,
  logLevel: process.env.LOG_LEVEL || 'info',
  jsonLimit: process.env.JSON_LIMIT || '10mb',
  nodeEnv: process.env.NODE_ENV || 'development',
  baseProtocol: process.env.BASE_PROTOCOL || 'https',
  baseDomain: process.env.BASE_DOMAIN || 'dev.saas.com',
  allowedTokens: {
    bffToken: process.env.BFF_TOKEN!,
  },
};

const config: Config = {
  app: appConfig,
  cors: corsOptions,
  redis: redisConfig,
  systemUserEmail: process.env.SYSTEM_USER_EMAIL || 'system@quant-data.io',
  keycloak: keycloakConfig,
  keycloakAdmin: keycloakAdminConfig,
  keycloakProvisioningEnableLocalClients:
    process.env.KEYCLOAK_PROVISIONING_ENABLE_LOCAL_CLIENTS?.toLowerCase() === 'true' ? true : false,
  smtp: smtpConfig,
  temporal: temporalConfig,

  // masterRealm: 'master',
  // controlPlaneClient: 'controlplane',
  // controlPlaneRedirectURI: process.env.CONTROL_PLANE_REDIRECT_URI || 'http://localhost:3000/*',
  // tofu: tofuConfig,
  // workflow: workflowConfig,
  // // Provisioning
  // provisioningFreeTierAWS: provisioningFreeTierAwsConfig,
};

export default config;

// import * as RoleService from '@domains/permission/role.service';
// import * as WorkspaceMemberService from '@domains/workspace/workspaceMember.service';
import { Prisma, Workspace } from '@prisma/client';
import { randomBytes } from 'crypto';

import { prisma } from '@/clients/prisma.client';
// import { WorkflowHandle } from '@temporalio/client';
// import * as KeycloakAdminService from '../authentication/keycloakAdmin.service';
// import { connectTemporalClient } from '@/clients/temporal.client';
// import config from '@/config/config';
import logger from '@/config/logger';
import { checkPermission } from '@/middlewares/authorization.middleware';
import { HttpError } from '@/types/errors';
// import { WorkspaceProvisionConfig, WorkspaceWorkflowOp } from '@/temporal/types/workspaceProvisioning.type';
// import { workspaceProvisioningWorkflow } from '@/temporal/workflows/workspaceProvisioning.workflow';
// import { HttpError } from '@/types/errors';
import { offsetPagination } from '@/utils/api';
import { generateWorkspaceId } from '@/utils/idGenerator';

import { CertService } from '../certificate/cert.service';
import { createdByPrincipalSelect } from '../principal/principal.select';
import { workspaceSelect } from './workspace.select';
import {
  AgentRegisterRequest,
  AgentRegisterResponse,
  AgentSyncParams,
  AgentSyncResponse,
  GenerateBootstrapTokenParams,
  GenerateBootstrapTokenResponse,
  GetWorkspaceParams,
  ListWorkspacesParams,
  ListWorkspacesResponse,
  ProvisionWorkspaceData,
  WorkspaceResponse,
} from './workspace.type';
// import { generateWorkspaceId } from '@/utils/idGenerator';
// import { deepMergeObject, isNonEmptyObject } from '@/utils/json.utils'

// import { accountCredentialConfigSchema } from '../account/accountCredential.type';
// import { accountNetworkConfigSchema } from '../account/accountNetwork.type';
// import { accountStorageConfigSchema } from '../account/accountStorage.type';
// import { workspaceProvisionConfigSelect, workspaceSelect } from './workspace.select';
// import {
//   PartialWorkspacePatchInput,
//   Workspace,
//   WorkspaceCreateServiceInput,
//   WorkspaceFilters,
//   WorkspaceList,
//   WorkspaceProvisionConfigInput,
//   WorkspaceProvisionConfigRequestBody,
//   WorkspaceProvisioningConfig,
//   WorkspaceProvisioningConfigList,
// } from './workspace.type';
// import { initKeycloakAdminClient } from '@/clients/keycloak-admin.client';
// import { realmDefinition } from '@/config/declarative-realm-template';

// /******************************************************************************
//  * Workspace workflow wrapper
//  *****************************************************************************/
// export async function startWorkspaceWorkflow(op: WorkspaceWorkflowOp, arg: WorkspaceProvisionConfig): Promise<WorkflowHandle | null> {
//   if (config.workflow.workspaceWorkflow.enabled) {
//     logger.debug({ arg }, 'startWorkspaceWorkflow invoked');

//     const temporalClient = await connectTemporalClient();

//     const handle = await temporalClient.workflow.start(workspaceProvisioningWorkflow, {
//       args: [op, arg],
//       taskQueue: 'sharedWorker',
//       workflowId: `workspaceProvisioning/${op}/${arg.extWorkspaceId}/${Date.now()}`,
//     });
//     return handle;
//   } else {
//     logger.warn({ arg }, 'startWorkspaceWorkflow disabled');
//     return null;
//   }
// }

/******************************************************************************
 * List available workspaces
 *****************************************************************************/
export async function listWorkspaces({
  principal,
  filters = {},
  sort,
  order,
  pagination = { page: 1, limit: 10 },
}: ListWorkspacesParams): Promise<ListWorkspacesResponse> {
  logger.debug(principal.email);
  // await checkPermission({
  //   principal,
  //   resource: {
  //     kind: 'workspace',
  //     id: '*',
  //   },
  //   action: 'workspace:listWorkspaces',
  // });

  const { page = 1, limit = 10 } = pagination;

  // Filtering
  const q = filters.q?.trim();
  const where: Record<string, unknown> = {
    ...(q && {
      OR: [
        { extAccountId: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    }),

    ...(filters.name && {
      name: filters.name,
    }),
  };

  // Order by / sorting
  const orderBy = sort && order ? { [sort]: order.toLowerCase() } : undefined;

  // const whereClause: Record<string, unknown> = {};
  // whereClause.deletedAt = null;
  // whereClause.account = { uid: accountUid };

  // IMPORTANT: Mandatory filter by userId
  // whereClause.members = {
  //   some: {
  //     userId,
  //   },
  // };

  // // OPTIONALS
  // if (name) {
  //   whereClause.name = {
  //     contains: name,
  //     mode: 'insensitive' as const,
  //   };
  // }

  // if (description) {
  //   whereClause.description = {
  //     contains: description,
  //     mode: 'insensitive' as const,
  //   };
  // }

  // logger.debug({ userId }, 'Listing workspaces for a user');

  const [totalData, workspaces] = await Promise.all([
    prisma.workspace.count({ where }),
    prisma.workspace.findMany({
      where,
      select: workspaceSelect,
      skip: offsetPagination(page, limit),
      take: limit,
      orderBy,
    }),
  ]);

  const totalPages = Math.ceil(totalData / limit);

  return {
    // data: workspaces.map((workspace) => ({
    //   ...workspace,
    //   storage: {
    //     ...workspace.storage,
    //     storageConfig: accountStorageConfigSchema.parse(workspace.storage.storageConfig),
    //   },
    //   network: workspace.network && {
    //     ...workspace.network,
    //     networkConfig: accountNetworkConfigSchema.parse(workspace.network.networkConfig),
    //   },
    // })),
    data: workspaces,
    pagination: {
      totalData,
      totalPages,
      currentPage: page,
      limit,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

/******************************************************************************
 * Create workspace transaction
 *****************************************************************************/
export async function createWorkspaceTx(
  tx: Prisma.TransactionClient,
  { principal, data }: ProvisionWorkspaceData,
): Promise<Workspace> {
  await checkPermission({
    principal,
    resource: {
      kind: 'workspace',
      id: '*',
    },
    action: 'workspace:provisionWorkspace',
  });

  let workspace;

  // Validate account
  const account = await tx.account.findFirst({
    where: {
      members: {
        some: {
          principalId: principal.id,
        },
      },
      extAccountId: data.extAccountId,
      deletedAt: null,
    },
  });
  if (!account) {
    throw new HttpError(404, `Account ${data.extAccountId} not found`);
  }
  if (account.status != 'ACTIVE') {
    throw new HttpError(
      400,
      `Can not create workspace on an account with status=${account.status}`,
    );
  }

  // Validate or generate external workspace ID
  const sanitizedExtWorkspaceId = data.extWorkspaceId?.trim();
  const extWorkspaceId =
    sanitizedExtWorkspaceId && sanitizedExtWorkspaceId.length >= 5
      ? sanitizedExtWorkspaceId
      : generateWorkspaceId();
  logger.debug(
    { data, sanitizedExtWorkspaceId, extWorkspaceId },
    'Validate or generate external account ID',
  );

  // Check if workspace exist
  const workspaceExists = await tx.workspace.findFirst({
    where: {
      extWorkspaceId: extWorkspaceId,
      deletedAt: null,
    },
    include: {
      createdBy: {
        select: createdByPrincipalSelect,
      },
    },
  });

  // Create workspace
  if (workspaceExists) {
    throw new HttpError(409, `Workspace ${extWorkspaceId} already exists`);
  } else {
    logger.warn(`Creating workspace ${extWorkspaceId} in database...`);
    workspace = await tx.workspace.create({
      data: {
        accountId: account.id,
        extWorkspaceId,
        name: data.name,
        createdById: principal.id as unknown as number,
      },
      include: {
        createdBy: {
          select: createdByPrincipalSelect,
        },
      },
    });
  }

  if (!workspace) {
    throw new HttpError(500, 'Failed to create workspace');
  }

  return workspace;
}
/******************************************************************************
 * Provision a workspace
 *****************************************************************************/
export async function provisionWorkspace({
  principal,
  data,
}: ProvisionWorkspaceData): Promise<WorkspaceResponse | null> {
  await checkPermission({
    principal,
    resource: {
      kind: 'workspace',
      id: '*',
    },
    action: 'workspace:provisionWorkspace',
  });

  // TODO:
  // Handle if workspace exists by extWorkspaceId

  // Create account and related DB records in a transaction
  const workspaceProvisioned = await prisma.$transaction(async (tx) => {
    // Create account
    const workspace = await createWorkspaceTx(tx, {
      principal,
      data,
    });

    // const workspace = await tx.workspace.findUnique({
    //   // where: { uid, members: { some: { userId } } },
    //   where: { uid }, // disable workspace membership
    //   select: workspaceSelect,
    // });

    //   if (!workspace) {
    //     throw new HttpError(404, 'Workspace not found');
    //   }

    // Create workspace cluster agent record
    const workspaceClusterAgent = await tx.workspaceClusterAgent.create({
      data: {
        workspaceId: workspace.id,
      },
    });

    // Generate a secure random token
    const token = randomBytes(32).toString('base64url'); // 43 characters, URL-safe

    // Set expiration (e.g., 24 hours from now)
    const expiredAt = new Date();
    expiredAt.setHours(expiredAt.getHours() + 24);

    // Create workspace cluster agent token
    const workspaceClusterAgentBootstrapToken = await tx.workspaceClusterAgentBootstrapToken.create(
      {
        data: {
          workspaceClusterAgentId: workspaceClusterAgent.id,
          token,
          expiredAt,
        },
      },
    );

    // Update workspace cluster agent
    await tx.workspaceClusterAgent.update({
      where: { id: workspaceClusterAgent.id },
      data: { bootstrapTokenId: workspaceClusterAgentBootstrapToken.id },
    });

    // Update workspace and guard on created workspace
    const workspaceCreated = await tx.workspace.update({
      where: { id: workspace.id },
      data: { clusterAgentId: workspaceClusterAgent.id },
      select: workspaceSelect,
    });

    return workspaceCreated;
  });

  //   return {
  //     ...workspace,
  //     storage: {
  //       ...workspace.storage,
  //       storageConfig: accountStorageConfigSchema.parse(workspace.storage.storageConfig),
  //     },
  //     network: workspace.network && {
  //       ...workspace.network,
  //       networkConfig: accountNetworkConfigSchema.parse(workspace.network.networkConfig),
  //     },
  //   };
  // }

  // export async function createWorkspaceTx(tx: Prisma.TransactionClient, input: WorkspaceCreateServiceInput): Promise<Workspace> {
  //   const extWorkspaceId = input.extWorkspaceId ?? generateWorkspaceId();

  //   // Check extWorkspaceId
  //   // If exists and not deleted -> reject
  //   const extWorkspaceIdExist = await tx.workspace.findFirst({
  //     where: {
  //       extWorkspaceId: extWorkspaceId,
  //       deletedAt: null,
  //     },
  //   });
  //   if (extWorkspaceIdExist) {
  //     throw new HttpError(400, `Workspace with extWorkspaceId=${extWorkspaceId} already exist with status=${extWorkspaceIdExist.status}`);
  //   }

  //   // Check account exists
  //   const account = await tx.account.findUnique({
  //     where: { uid: input.accountUid },
  //   });
  //   if (!account) {
  //     throw new HttpError(404, 'Account not found');
  //   }

  //   // Check cloud region exists and valid
  //   const cloudRegion = await tx.cloudRegion.findUnique({ where: { uid: input.cloudRegionUid } });
  //   if (!cloudRegion) {
  //     throw new HttpError(404, 'Cloud region not found');
  //   }

  //   const accountCredential = await tx.accountCredential.findUnique({
  //     where: { uid: input.accountCredentialUid },
  //   });
  //   if (!accountCredential) {
  //     throw new HttpError(404, 'Account Credential not found');
  //   }

  //   const accountStorage = await tx.accountStorage.findUnique({
  //     where: { uid: input.accountStorageUid },
  //     select: {
  //       id: true,
  //       storageConfig: true,
  //     },
  //   });
  //   if (!accountStorage) {
  //     throw new HttpError(404, 'Account Storage not found');
  //   }

  //   // Account network is optional
  //   // Check if the request use existing VPC or new VPC
  //   let networkId = null;

  //   if (input.accountNetworkUid) {
  //     const accountNetwork = await tx.accountNetwork.findUnique({
  //       where: { uid: input.accountNetworkUid },
  //     });
  //     if (!accountNetwork) {
  //       throw new HttpError(404, 'Account Network not found');
  //     }
  //     networkId = accountNetwork.id;
  //   }
  //   // else {
  //   //   // SaaS auto-creates network
  //   //   // const cloudRegion = await tx.clo
  //   //   const newNetwork = await tx.accountNetwork.create({
  //   //     data: {
  //   //       accountId: account.id,
  //   //       networkName: `qd-platform-${extWorkspaceId}-vpc`,
  //   //       providerName: account.region.cloudProvider.name,
  //   //       networkConfig: {},
  //   //       createdById: input.createdById,
  //   //     },
  //   //   });
  //   //   networkId = newNetwork.id;
  //   // }

  //   const workspace = await tx.workspace.create({
  //     data: {
  //       name: input.name,
  //       extWorkspaceId: extWorkspaceId,
  //       description: input.description,
  //       status: 'PENDING',
  //       cloudRegionId: cloudRegion.id,
  //       accountId: account.id,
  //       credentialId: accountCredential.id,
  //       storageId: accountStorage.id,
  //       networkId: networkId,
  //       createdById: input.createdById,
  //     },
  //   });

  //   // Assign as workspace owner
  //   const workspaceOwnerRole = await RoleService.getRoleByName('WorkspaceOwner');
  //   await WorkspaceMemberService.createWorkspaceMemberTx(tx, {
  //     workspaceId: workspace.id,
  //     userId: input.createdById,
  //     roleId: workspaceOwnerRole?.id || -1,
  //   });

  //   // Fetch back workspace data
  //   const result = await tx.workspace.findUnique({
  //     where: { uid: workspace.uid },
  //     select: workspaceSelect,
  //   });

  //   if (!result) {
  //     throw new HttpError(500, 'Failed to create workspace');
  //   }

  //   // Create workspace provision config
  //   const resultForConfig = await tx.workspace.findUnique({
  //     where: { uid: workspace.uid },
  //     select: workspaceProvisionConfigSelect,
  //   });

  //   if (!resultForConfig) {
  //     throw new HttpError(500, 'Workspace provision creation failed');
  //   }
  //   const provisionConfig = await generateWorkspaceProvisionConfig(resultForConfig);
  //   logger.info({ provisionConfig }, 'workspaceProvisionConfig');

  //   // Save workspace provision config to database
  //   const workspaceProvisioningConfig = await tx.workspaceProvisioningConfig.create({
  //     data: {
  //       workspaceId: workspace.id,
  //       provisionConfig: provisionConfig as unknown as Prisma.InputJsonValue,
  //       version: 1, // Always 1 on create
  //     },
  //   });

  //   // Set the cluster workspace provision config as current config
  //   await tx.workspace.update({
  //     where: { id: workspace.id },
  //     data: { currentConfigId: workspaceProvisioningConfig.id },
  //   });

  //   // Start workspace creation job
  //   const workflowId = startWorkspaceWorkflow('CREATE', provisionConfig);
  //   logger.info('workflowId', workflowId);

  //   return {
  //     ...result,
  //     storage: {
  //       ...result.storage,
  //       storageConfig: accountStorageConfigSchema.parse(result.storage.storageConfig),
  //     },
  //     network: result.network && {
  //       ...result.network,
  //       networkConfig: accountNetworkConfigSchema.parse(result.network.networkConfig),
  //     },
  //   };

  return workspaceProvisioned;
}

/******************************************************************************
 * Get a workspace
 *****************************************************************************/
export async function getWorkspaceInternal({
  principal,
  workspaceUid,
}: GetWorkspaceParams): Promise<Workspace> {
  await checkPermission({
    principal,
    resource: {
      kind: 'workspace',
      id: '*',
    },
    action: 'workspace:getWorkspace',
  });

  const workspaceExists = await prisma.workspace.findUnique({
    where: {
      uid: workspaceUid,
      deletedAt: null,
    },
  });

  if (!workspaceExists) {
    throw new HttpError(404, 'Workspace not found');
  }

  return workspaceExists;
}

export async function getWorkspace({
  principal,
  workspaceUid,
}: GetWorkspaceParams): Promise<WorkspaceResponse | null> {
  await checkPermission({
    principal,
    resource: {
      kind: 'workspace',
      id: '*',
    },
    action: 'workspace:getWorkspace',
  });

  const workspaceExists = await prisma.workspace.findUnique({
    where: {
      uid: workspaceUid,
      deletedAt: null,
    },
    select: workspaceSelect,
  });

  if (!workspaceExists) {
    throw new HttpError(404, 'Workspace not found');
  }

  return workspaceExists;
}

// async function generateWorkspaceProvisionConfig(workspace: WorkspaceProvisionConfigInput): Promise<WorkspaceProvisionConfig> {
//   if (!workspace) {
//     throw new HttpError(404, 'Workspace not found');
//   }

//   // Prepare provisionConfig
//   const provisionConfig: WorkspaceProvisionConfig = {} as WorkspaceProvisionConfig;

//   const providerName = workspace.cloudRegion.cloudProvider.name;
//   const region = workspace.cloudRegion.name;

//   // Common standard values
//   provisionConfig.workspaceUid = workspace.uid;
//   provisionConfig.extWorkspaceId = workspace.extWorkspaceId;

//   // Git Repo URL
//   provisionConfig.tofuRepoUrl = config.tofu.tofuRepoUrl;
//   provisionConfig.tofuRepoRevision = config.tofu.tofuRepoRevision;
//   // The path from Git Repo
//   // For example: aws/aws-client-workspace
//   provisionConfig.tofuTemplatePath = `${providerName}/${providerName}-client-workspace`;

//   // Local template dir on the executor machine
//   provisionConfig.tofuTemplateDir = config.tofu.tofuTemplateDir;

//   const credentialConfigParsed = accountCredentialConfigSchema.safeParse(workspace.credential.credentialConfig);
//   if (!credentialConfigParsed.data) {
//     throw new HttpError(500, 'Failed to parse credentialConfig');
//   }

//   const storageConfigParsed = accountStorageConfigSchema.safeParse(workspace.storage.storageConfig);
//   if (!storageConfigParsed.data) {
//     throw new HttpError(500, 'Failed to parse storageConfig');
//   }

//   // Determine backend config based on provider
//   switch (providerName) {
//     /**
//      * AWS provider use cross account IAM role assume
//      */
//     case 'aws':
//       provisionConfig.credentialConfig = {
//         provider: 'aws',
//         sourceRoleArn: credentialConfigParsed.data.sourceRoleArn,
//         targetRoleArn: credentialConfigParsed.data.targetRoleArn,
//         externalId: credentialConfigParsed.data.externalId,
//         region: credentialConfigParsed.data.region,
//       };
//       provisionConfig.tofuBackendConfig = {
//         type: 's3',
//         bucket: config.tofu.aws.s3Bucket,
//         region: config.tofu.aws.region,
//         key: `account=${workspace.account.extAccountId}/workspace=${workspace.extWorkspaceId}`,
//       };

//       provisionConfig.tofuTfvars = {
//         app_domain: config.baseDomain,
//         backend_tfstate_bucket: config.tofu.aws.s3Bucket,
//         source_iam_role_arn: config.tofu.aws.crossAccountRoleArn,
//         source_region: config.tofu.aws.region,
//         client_iam_role_arn: credentialConfigParsed.data.targetRoleArn,
//         client_region: region,
//         external_id: credentialConfigParsed.data.externalId,
//         account_id: workspace.account.extAccountId,
//         workspace_id: workspace.extWorkspaceId,
//         account_storage_bucket: storageConfigParsed.data.bucket,
//       };
//       break;
//     default:
//       throw new HttpError(400, 'Provider not supported');
//   }

//   // // Handle Free Tier vs Paid
//   // switch (input.accountPlan) {
//   //   case 'free':
//   //     provisionConfig.tofuTemplatePath = 'aws/aws-tenant-free-tier';
//   //     provisionConfig.tofuTfvars = {
//   //       region: config.provisioningFreeTierAWS.defaultRegion,
//   //       shared_subnet_ids: config.provisioningFreeTierAWS.subnetIds,
//   //       shared_eks_cluster_name: config.provisioningFreeTierAWS.eks_cluster_name,
//   //       shared_bucket_name: config.provisioningFreeTierAWS.s3Bucket,
//   //       tenant_bucket_data_path: `${input.accountStorage.root}${input.accountStorage.dataPath}`,
//   //       tenant_bucket_workspace_path: `${input.accountStorage.root}${input.accountStorage.workspacePath}`,
//   //       tenant_node_instance_types: input.clusterTshirtSize.nodeInstanceTypes,
//   //       tenant_cluster_uid: input.cluster.uid,
//   //       tenant_node_desired_size: 1,
//   //       tenant_node_min_size: 1,
//   //       tenant_node_max_size: 1,
//   //     };

//   //     break;
//   //   case 'enterprise':
//   //     throw new HttpError(400, `${input.accountPlan} plan not supprted yet`);
//   //   default:
//   //     throw new HttpError(400, `${input.accountPlan} plan not supprted yet`);
//   // }

//   // logger.debug({ provisionConfig }, 'Generated provisionConfig');

//   return provisionConfig;
// }

// /******************************************************************************
//  * Create new workspace provisioning config
//  *****************************************************************************/
// export async function createWorkspaceProvisioningConfigTx(tx: Prisma.TransactionClient, workspaceUid: string, _userId: bigint, data?: WorkspaceProvisionConfigRequestBody) {
//   const workspace = await tx.workspace.findUnique({
//     where: { uid: workspaceUid },
//   });

//   if (!workspace) {
//     throw new HttpError(404, `Workspace not found for uid=${workspaceUid}`);
//   }

//   // Fetch current workspace provisioning config
//   const currentWorkspaceProvisioningConfig = await getWorkspaceCurrentProvisioningConfig(workspace.uid)

//   // Create workspace provision config
//   const resultForConfig = await tx.workspace.findUnique({
//     where: { uid: workspace.uid },
//     select: workspaceProvisionConfigSelect,
//   });

//   if (!resultForConfig) {
//     throw new HttpError(500, 'Workspace provision creation failed');
//   }
//   const provisionConfig = await generateWorkspaceProvisionConfig(resultForConfig);

//   // Check if tfvarsOverride provided
//   if (data?.tfvarsOverride && isNonEmptyObject(data?.tfvarsOverride)) {
//     logger.info(
//       { tfvarsOverride: data.tfvarsOverride },
//       'tfvarsOverride provided'
//     );

//     provisionConfig.tofuTfvars = deepMergeObject(
//       provisionConfig.tofuTfvars ?? {},
//       data.tfvarsOverride
//     );
//   }
//   logger.info({ provisionConfig, currentWorkspaceProvisioningConfig }, 'workspaceProvisionConfig');

//   // Save workspace provision config to database
//   const workspaceProvisioningConfig = await tx.workspaceProvisioningConfig.create({
//     data: {
//       workspaceId: workspace.id,
//       provisionConfig: provisionConfig as unknown as Prisma.InputJsonValue,
//       version: currentWorkspaceProvisioningConfig
//         ? currentWorkspaceProvisioningConfig.version + 1
//         : 1,
//     },
//   });

//   // Update latest config to Workspace
//   await tx.workspace.update({
//     where: { uid: workspaceUid },
//     data: {
//       currentConfig: { connect: { uid: workspaceProvisioningConfig.uid } },
//     },
//   });

//   return provisionConfig
// }

// export async function listWorkspaceProvisioningConfigs(workspaceUid: string, page = 1, limit = 10): Promise<WorkspaceProvisioningConfigList> {
//   const workspace = await prisma.workspace.findUnique({
//     where: { uid: workspaceUid },
//   });

//   if (!workspace) {
//     throw new HttpError(404, `Workspace not found for uid=${workspaceUid}`);
//   }

//   const whereClause = {
//     workspaceId: workspace.id,
//   };

//   const [totalData, workspaceProvisioningConfigs] = await Promise.all([
//     prisma.workspaceProvisioningConfig.count({
//       where: whereClause,
//     }),
//     prisma.workspaceProvisioningConfig.findMany({
//       where: whereClause,
//       orderBy: { version: 'desc' }, // newest first
//       skip: offsetPagination(page, limit),
//       take: limit,
//     }),
//   ]);

//   const totalPages = Math.ceil(totalData / limit);

//   return {
//     data: workspaceProvisioningConfigs.map((c) => {
//       const jsonValue = c.provisionConfig;
//       const provisionConfig = jsonValue && typeof jsonValue === 'object' && !Array.isArray(jsonValue) ? (jsonValue as unknown as WorkspaceProvisionConfig) : undefined;
//       if (!provisionConfig) {
//         throw new HttpError(404, 'Provisioning config not found or invalid');
//       }
//       return {
//         uid: c.uid,
//         provisionConfig: provisionConfig,
//         version: c.version,
//         createdAt: c.createdAt
//       }
//     }),
//     pagination: {
//       totalData,
//       totalPages,
//       currentPage: page,
//       limit,
//       hasNextPage: page < totalPages,
//       hasPreviousPage: page > 1,
//     },
//   };
// }

// /******************************************************************************
//  * Get current workspace provisioning config
//  *****************************************************************************/
// export async function getWorkspaceCurrentProvisioningConfig(workspaceUid: string): Promise<WorkspaceProvisioningConfig> {
//   const workspace = await prisma.workspace.findUnique({
//     where: { uid: workspaceUid },
//   });

//   if (!workspace) {
//     throw new HttpError(404, `Workspace not found for uid=${workspaceUid}`);
//   }

//   // Fetch current workspace provisioning config
//   const workspaceProvisioningConfig = await prisma.workspaceProvisioningConfig.findUnique({
//     where: { id: workspace.currentConfigId as unknown as bigint },
//   });

//   if (!workspaceProvisioningConfig) {
//     throw new HttpError(404, 'Workspace provisioning config not found or invalid');
//   }

//   // Read JSON column from DB
//   const jsonValue = workspaceProvisioningConfig?.provisionConfig;
//   // Ensure it's an object before casting
//   const provisionConfig =
//     jsonValue && typeof jsonValue === 'object' && !Array.isArray(jsonValue) ? (jsonValue as unknown as WorkspaceProvisionConfig) : undefined;

//   if (!provisionConfig) {
//     throw new HttpError(404, 'Workspace provisioning config not found or invalid');
//   }

//   logger.debug({ workspaceProvisioningConfig }, "getWorkspaceCurrentProvisioningConfig")

//   return {
//     uid: workspaceProvisioningConfig.uid,
//     provisionConfig: provisionConfig,
//     version: workspaceProvisioningConfig.version,
//     createdAt: workspaceProvisioningConfig.createdAt
//   };
// }

// /******************************************************************************
//  * Patch a workspace
//  *****************************************************************************/
// export async function patchWorkspaceTx(tx: Prisma.TransactionClient, uid: string, userId: bigint, data: PartialWorkspacePatchInput): Promise<Workspace> {
//   logger.debug({ uid, userId }, 'patchWorkspace');
//   const existingWorkspace = await tx.workspace.findUnique({
//     where: { uid, members: { some: { userId: userId } } },
//   });

//   if (!existingWorkspace) {
//     throw new HttpError(404, 'Workspace not found');
//   }
//   const workspace = await tx.workspace.update({
//     where: { uid: existingWorkspace.uid },
//     data: {
//       ...data,
//       status: 'UPDATING',
//     },
//     select: workspaceSelect,
//   });

//   // Fetch current workspace provisioning config
//   const currentWorkspaceProvisioningConfig = await getWorkspaceCurrentProvisioningConfig(existingWorkspace.uid)

//   // Read JSON column from DB
//   const jsonValue = currentWorkspaceProvisioningConfig?.provisionConfig;
//   // Ensure it's an object before casting
//   const provisionConfig =
//     jsonValue && typeof jsonValue === 'object' && !Array.isArray(jsonValue) ? (jsonValue as unknown as WorkspaceProvisionConfig) : undefined;

//   if (!provisionConfig) {
//     throw new HttpError(404, 'Workspace provisioning config not found or invalid');
//   }

//   // Start workspace creation job
//   const workflowId = startWorkspaceWorkflow('UPDATE', provisionConfig);
//   logger.info('workflowId', workflowId);

//   return {
//     ...workspace,
//     storage: {
//       ...workspace.storage,
//       storageConfig: accountStorageConfigSchema.parse(workspace.storage.storageConfig),
//     },
//     network: workspace.network && {
//       ...workspace.network,
//       networkConfig: accountNetworkConfigSchema.parse(workspace.network.networkConfig),
//     },
//   };
// }

// /******************************************************************************
//  * Delete a workspace
//  *****************************************************************************/
// export async function deleteWorkspaceTx(tx: Prisma.TransactionClient, uid: string, userId: bigint): Promise<Workspace> {
//   const existingWorkspace = await tx.workspace.findUnique({
//     where: { uid, members: { some: { userId } } },
//   });
//   if (!existingWorkspace) {
//     throw new HttpError(404, 'Workspace not found');
//   }

//   // // Delete workspace membership
//   // await tx.workspaceMember.deleteMany({
//   //   where: { workspaceId: existingWorkspace.id },
//   // });

//   // Fetch current workspace provisioning config
//   const currentWorkspaceProvisioningConfig = await getWorkspaceCurrentProvisioningConfig(existingWorkspace.uid)

//   // Read JSON column from DB
//   const jsonValue = currentWorkspaceProvisioningConfig?.provisionConfig;
//   // Ensure it's an object before casting
//   const provisionConfig =
//     jsonValue && typeof jsonValue === 'object' && !Array.isArray(jsonValue) ? (jsonValue as unknown as WorkspaceProvisionConfig) : undefined;

//   if (!provisionConfig) {
//     throw new HttpError(404, 'Workspace provisioning config not found or invalid');
//   }

//   // Start workspace deletion job
//   const workflowId = startWorkspaceWorkflow('DELETE', provisionConfig);
//   logger.info('workflowId', workflowId);

//   // Delete workspace (soft)
//   const workspace = await tx.workspace.update({
//     where: { id: existingWorkspace.id },
//     data: {
//       deletedAt: new Date(),
//       status: 'DELETING',
//     },
//     select: workspaceSelect,
//   });

//   return {
//     ...workspace,
//     storage: {
//       ...workspace.storage,
//       storageConfig: accountStorageConfigSchema.parse(workspace.storage.storageConfig),
//     },
//     network: workspace.network && {
//       ...workspace.network,
//       networkConfig: accountNetworkConfigSchema.parse(workspace.network.networkConfig),
//     },
//   };
// }

// /******************************************************************************
//  * Ensure Keycloak clients configuration for a workspace
//  *****************************************************************************/
// export async function ensureWorkspaceKeycloakConfig(uid: string, userId: bigint) {

//   const existingWorkspace = await prisma.workspace.findUnique({
//     where: { uid, members: { some: { userId } } },
//     include: {
//       account: true,
//     }
//   });
//   if (!existingWorkspace) {
//     throw new HttpError(404, 'Workspace not found');
//   }

//   const realmDef = {
//     ...realmDefinition,
//     realmName: existingWorkspace.account.extAccountId,
//     displayName: existingWorkspace.account.name,
//   }
//   const extWorkspaceId = existingWorkspace.extWorkspaceId;

//   // Prepare Keycloak client
//   const kc = await initKeycloakAdminClient();

//   // Ensure BFF stack
//   const bffStack = realmDef.workspaceBffStack;
//   const bffClientId = `${extWorkspaceId}-${bffStack.client.clientId}`;
//   const bffBaseUrl = `https://${bffStack.client.clientId}.${extWorkspaceId}.${config.baseDomain}`;
//   // Ensure BFF client
//   await KeycloakAdminService.ensureClient(kc, {
//     ...bffStack.client,
//     realm: realmDef.realmName,
//     clientId: bffClientId,
//     redirectUris: [`${bffBaseUrl}/*`],
//     webOrigins: [bffBaseUrl],
//     rootUrl: bffBaseUrl,
//     baseUrl: bffBaseUrl,
//   });
//   // Ensuring client roles
//   const prefixedBffClientRoles = bffStack.roles.map(role => `${bffClientId}-${role}`);
//   await KeycloakAdminService.ensureClientRoles(kc, realmDef.realmName, bffClientId, prefixedBffClientRoles);
//   await KeycloakAdminService.ensureClientMappers(kc, realmDef.realmName, bffClientId);

//   // Ensure BFF client is attached to realm roles
//   const roleNames = realmDef.realmRoles.map(r => r.name);
//   await KeycloakAdminService.ensureClientAttachToRealmRoles(kc, realmDef.realmName, bffClientId, `${bffClientId}-role`, roleNames)

//   // Ensuring workspace apps stack
//   for (const [clientKey, cfg] of Object.entries(realmDef.workspaceAppStack)) {
//     const { client, roles } = cfg;

//     const appBaseUrl = `https://${clientKey}.${extWorkspaceId}.${config.baseDomain}`;
//     const appClientId = `${extWorkspaceId}-${clientKey}`

//     await KeycloakAdminService.ensureClient(kc, {
//       ...client,
//       realm: realmDef.realmName,
//       clientId: appClientId,
//       redirectUris: [`${appBaseUrl}/*`],
//       webOrigins: [appBaseUrl],
//       rootUrl: appBaseUrl,
//       baseUrl: appBaseUrl,
//     });

//     // Ensuring client roles
//     console.log("Client", appClientId, roles)
//     // const prefixedClientRoles = roles.map(role => `${appClientId}-${role}`);
//     await KeycloakAdminService.ensureClientRoles(kc, realmDef.realmName, appClientId, roles);
//     await KeycloakAdminService.ensureClientMappers(kc, realmDef.realmName, appClientId);

//     // Assign client roles to realm roles
//     // For example assign Superset  to data_engineer

//     // // Ensuring client scopes
//     // //   //
//     // //   for (const scopeCfg of clientScopes) {
//     // //     if (!scopeCfg.assignToClients) continue;
//     // //     for (const assignCfg of scopeCfg.assignToClients) {
//     // //       await KeycloakAdminService.ensureClientHasScope(
//     // //         kc,
//     // //         realmDef.realmName,
//     // //         `${assignCfg.clientId}`,  // target client (e.g., saas-ux)
//     // //         `${appClientId}-scope`,                     // scope from service client
//     // //         assignCfg.type           // "optional" | "default"
//     // //       );
//     // //     }
//     // //   }

//     // // Ensure Client Scope Has Role
//     // KeycloakAdminService.ensureClientScopeHasRole(kc, realmDef.realmName, `${appClientId}-scope`, appClientId, `${appClientId}-role`)
//     // // if (realmDef.workspaceLevelClients[clientId].shouldEnsureClientScopeHasRole) {
//     // //   logger.info("Ensure client scope created and has has role scope mapping for the client role");
//     // //   KeycloakAdminService.ensureClientHasScope(kc, realmDef.realmName, `${extWorkspaceId}-saas-bff-api`, `${appClientId}-scope`, 'default');
//     // // }

//     // // Ensure each client is attached to the default realm roles
//     // if (!defaultAssignToRealmRoles) continue;
//     // await KeycloakAdminService.ensureClientAttachToRealmRoles(kc, realmDef.realmName, appClientId, `${appClientId}-role`, defaultAssignToRealmRoles)

//   }

//   // Add app client roles
//   await KeycloakAdminService.syncClientRolesToRealmRoles(kc, realmDef.realmName, realmDef.roles, extWorkspaceId)
// }

/******************************************************************************
 * Generate new bootstrap token for workspace
 *****************************************************************************/
export async function generateBootstrapToken({
  principal,
  workspaceUid,
}: GenerateBootstrapTokenParams): Promise<GenerateBootstrapTokenResponse> {
  await checkPermission({
    principal,
    resource: {
      kind: 'workspace',
      id: workspaceUid,
    },
    action: 'workspace:generateBootstrapToken',
  });

  // Find the workspace
  const workspace = await prisma.workspace.findUnique({
    where: {
      uid: workspaceUid,
      deletedAt: null,
    },
    include: {
      clusterAgent: {
        include: {
          bootstrapToken: true,
        },
      },
    },
  });

  if (!workspace) {
    throw new HttpError(404, 'Workspace not found');
  }

  if (!workspace.clusterAgent) {
    throw new HttpError(400, 'Workspace does not have a cluster agent');
  }

  const agent = workspace.clusterAgent;

  // Generate new bootstrap token in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Invalidate existing bootstrap token by setting expiredAt to now
    if (agent.bootstrapTokenId) {
      await tx.workspaceClusterAgentBootstrapToken.update({
        where: { id: agent.bootstrapTokenId },
        data: { expiredAt: new Date() },
      });
    }

    // Generate a new secure random token
    const token = randomBytes(32).toString('base64url');

    // Set expiration (24 hours from now)
    const expiredAt = new Date();
    expiredAt.setHours(expiredAt.getHours() + 24);

    // Create new bootstrap token
    const newBootstrapToken = await tx.workspaceClusterAgentBootstrapToken.create({
      data: {
        workspaceClusterAgentId: agent.id,
        token,
        expiredAt,
      },
    });

    // Update agent to point to new token and reset status to PendingRegistration
    await tx.workspaceClusterAgent.update({
      where: { id: agent.id },
      data: {
        bootstrapTokenId: newBootstrapToken.id,
        status: 'PendingRegistration',
      },
    });

    return {
      token,
      expiredAt,
    };
  });

  logger.info(
    { workspaceUid, agentUid: agent.uid },
    'Bootstrap token regenerated, agent status reset to PendingRegistration',
  );

  return {
    workspaceUid: workspace.uid,
    extWorkspaceId: workspace.extWorkspaceId,
    token: result.token,
    expiredAt: result.expiredAt,
    agentStatus: 'PendingRegistration',
  };
}

/******************************************************************************
 * Register workspace cluster agent
 *****************************************************************************/
export async function registerWorkspaceClusterAgent({
  extWorkspaceId,
  token,
}: AgentRegisterRequest): Promise<AgentRegisterResponse> {
  // Find the bootstrap token
  const bootstrapToken = await prisma.workspaceClusterAgentBootstrapToken.findFirst({
    where: {
      token,
      workspaceClusterAgent: { workspace: { extWorkspaceId } },
    },
    include: {
      workspaceClusterAgent: {
        include: {
          workspace: true,
        },
      },
    },
  });

  if (!bootstrapToken) {
    throw new HttpError(401, 'Invalid registration token');
  }

  // Check if token is expired
  if (new Date() > bootstrapToken.expiredAt) {
    throw new HttpError(401, 'Registration token has expired');
  }

  const agent = bootstrapToken.workspaceClusterAgent;
  const workspace = agent.workspace;

  // Check if agent is already registered
  // if (agent.status === 'Active') {
  //   throw new HttpError(409, 'Agent is already registered');
  // }

  if (agent.status === 'Deleted') {
    throw new HttpError(410, 'Agent has been deleted');
  }

  if (agent.status === 'Suspended') {
    throw new HttpError(403, 'Agent is suspended');
  }

  // Generate mTLS certificates via Step CA
  const certService = new CertService();
  const mtls = await certService.issueAgentCertificate(agent.uid, workspace.uid);

  // Store mTLS credential and update agent in a transaction
  await prisma.$transaction(async (tx) => {
    // Create mTLS credential record for tracking/verification
    const mtlsCredential = await tx.workspaceClusterAgentMTLSCredential.create({
      data: {
        workspaceClusterAgentId: agent.id,
        caProvider: mtls.caProvider || 'self-signed',
        caCert: mtls.caCert, // Only stored for self-signed (per-workspace CA)
        certSerialNumber: mtls.certSerialNumber,
        certFingerprint: mtls.certFingerprint,
        expiresAt: mtls.expiresAt,
      },
    });

    // Update agent status to Active, set lastPingAt, and link to mTLS credential
    await tx.workspaceClusterAgent.update({
      where: { id: agent.id },
      data: {
        status: 'Active',
        lastPingAt: new Date(),
        mtlsCredentialId: mtlsCredential.id,
      },
    });
  });

  logger.info(
    { agentUid: agent.uid, workspaceUid: workspace.uid },
    'Agent registered successfully',
  );

  return {
    agentUid: agent.uid,
    workspaceUid: workspace.uid,
    extWorkspaceId: workspace.extWorkspaceId,
    mtls,
  };
}

/******************************************************************************
 * Agent sync - poll config and update telemetry
 *****************************************************************************/
export async function syncAgent({ agentUid, data }: AgentSyncParams): Promise<AgentSyncResponse> {
  // Find the agent by UID
  const agent = await prisma.workspaceClusterAgent.findUnique({
    where: { uid: agentUid },
    include: {
      workspace: true,
    },
  });

  if (!agent) {
    throw new HttpError(404, 'Agent not found');
  }

  if (agent.status === 'Deleted') {
    throw new HttpError(410, 'Agent has been deleted');
  }

  if (agent.status === 'Suspended') {
    throw new HttpError(403, 'Agent is suspended');
  }

  if (agent.status === 'PendingRegistration') {
    throw new HttpError(403, 'Agent is not yet registered');
  }

  // Update lastPingAt and optionally store telemetry
  await prisma.workspaceClusterAgent.update({
    where: { id: agent.id },
    data: {
      lastPingAt: new Date(),
      // Future: store telemetry data (agentVersion, kubernetesVersion, etc.)
    },
  });

  const workspace = agent.workspace;

  logger.debug(
    {
      agentUid,
      workspaceUid: workspace.uid,
      agentVersion: data.agentVersion,
      kubernetesVersion: data.kubernetesVersion,
    },
    'Agent sync',
  );

  return {
    uid: workspace.uid,
    extWorkspaceId: workspace.extWorkspaceId,
    name: workspace.name,
    description: workspace.description ?? '',
    status: workspace.status,
    workspaceApps: [], // TODO: populate from workspace apps
    storage: {}, // TODO: populate from workspace storage config
    network: {}, // TODO: populate from workspace network config
    createdAt: workspace.createdAt,
    createdBy: {
      uid: '', // TODO: resolve from workspace creator
      email: '',
      fullName: '',
    },
    updatedAt: workspace.updatedAt,
  };
}

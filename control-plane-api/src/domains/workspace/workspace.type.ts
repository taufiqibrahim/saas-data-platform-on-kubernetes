// import { Prisma } from '@prisma/client';

import { PaginationOptions } from '@/types/api.type';
import { PrincipalAuthInfo } from '@/types/auth-middleware-types';

import { CreatedByInfo, PaginationInfo } from '../_shared/shared.type';

// import { PaginationInfo } from '../_shared/shared.dto';
// import { AccountNetwork } from '../account/accountNetwork.type';
// import { AccountStorage } from '../account/accountStorage.type';
// import { CreatedByInfo } from '../user/user.type';
// import { workspaceProvisionConfigSelect } from './workspace.select';
// import { AccountCredentialConfig } from '../account/accountCredential.type';
// // import { TofuBackendConfig } from '@/temporal/types/shared.type';
// import { IRecordOfAny, JsonValue } from '../_shared/shared.types';

export interface WorkspaceResponse {
  /**
   * Workspace unique ID
   * @example "83ef9fc3-159c-43fc-a31f-0d4575dc373c"
   */
  uid: string;
  /**
   * Workspace name
   * @example "Example workspace"
   */
  name: string;
  /**
   * Workspace description
   * @example "Example workspace description"
   */
  description?: string | null;
  status: string;
  // storage: AccountStorage;
  // network?: AccountNetwork | null;
  createdAt: Date;
  createdBy: CreatedByInfo;
  updatedAt: Date;
}

export interface WorkspaceFilters {
  q?: string;
  name?: string;
}

export interface GetWorkspaceParams {
  principal: PrincipalAuthInfo;
  /**
   * Workspace unique ID
   * @example "83ef9fc3-159c-43fc-a31f-0d4575dc373c"
   */
  workspaceUid: string;
}

export interface ListWorkspacesParams {
  principal: PrincipalAuthInfo;
  filters?: WorkspaceFilters;
  sort?: string;
  order?: string;
  pagination?: PaginationOptions;
}

export interface ListWorkspacesResponse {
  data: WorkspaceResponse[];
  pagination: PaginationInfo;
  serverTime?: string;
}

export interface CreateWorkspaceRequestBody {
  /**
   * Workspace name
   * @example "Example workspace"
   */
  name: string;
  /**
   * Workspace description
   * @example "Example workspace description"
   */
  description?: string | null;
  /**
   * External account ID
   */
  extAccountId: string;
  /**
   * External workspace ID
   * @example "w-123456789"
   */
  extWorkspaceId?: string;
  // /**
  //  * Cloud provider region unique ID (AWS Singapore)
  //  * @example "709cb1d8-0320-485e-982a-a3f60c4def66"
  //  */
  // cloudRegionUid: string;
  // /**
  //  * Account credential unique ID
  //  * @example "83ef9fc3-159c-43fc-a31f-0d4575dc373c"
  //  */
  // accountCredentialUid: string;
  // /**
  //  * Account storage unique ID
  //  * @example "83ef9fc3-159c-43fc-a31f-0d4575dc373c"
  //  */
  // accountStorageUid: string;
  // /**
  //  * Account network unique ID
  //  * @example "83ef9fc3-159c-43fc-a31f-0d4575dc373c"
  //  */
  // accountNetworkUid?: string | null;
}

export interface ProvisionWorkspaceData {
  principal: PrincipalAuthInfo;
  data: CreateWorkspaceRequestBody;
}

// export type Role = {
//   name: string;
//   description: string;
//   type: RoleTypeEnum;
// };

// export interface EnsureAccountRolesData {
//   accountId: bigint;
//   createdByPrincipalId: bigint;
//   roles: Role[];
// }

// export interface ProvisionAccountMembershipData {
//   accountId: bigint;
//   memberPrincipalId: bigint;
//   createdByPrincipalId: bigint;
//   roles: Role[];
// }

// export interface WorkspaceFilters {
//   accountUid: string;
//   userId: bigint;
//   name?: string;
//   description?: string;
//   page?: number;
//   limit?: number;
// }

// /******************************************************************************
//  * Workspace
//  *****************************************************************************/
// export interface Workspace {
//   /**
//    * Workspace unique ID
//    * @example "83ef9fc3-159c-43fc-a31f-0d4575dc373c"
//    */
//   uid: string;
//   /**
//    * Workspace name
//    * @example "Example workspace"
//    */
//   name: string;
//   /**
//    * Workspace description
//    * @example "Example workspace description"
//    */
//   description?: string | null;
//   status: string;
//   storage: AccountStorage;
//   network?: AccountNetwork | null;
//   createdAt: Date;
//   createdBy: CreatedByInfo;
//   updatedAt: Date;
// }

// export interface WorkspaceList {
//   data: Workspace[];
//   pagination: PaginationInfo;
//   serverTime?: string;
// }

// export interface WorkspaceCreateServiceInput {
//   name: string;
//   description?: string | null;
//   createdById: bigint;
//   accountUid: string;
//   extWorkspaceId?: string | null;
//   cloudRegionUid: string;
//   accountCredentialUid: string;
//   accountStorageUid: string;
//   accountNetworkUid?: string | null; // Optional
// }

// export interface WorkspaceService {
//   serviceName: string;
// }

// export interface PartialWorkspacePatchInput {
//   name?: string;
//   description?: string | null;
// }

// /******************************************************************************
//  * Workspace Provision Config
//  *****************************************************************************/
// interface ProvisionConfig {
//   /**
//    * Workspace unique ID
//    * @example "83ef9fc3-159c-43fc-a31f-0d4575dc373c"
//    */
//   workspaceUid: string
//   /**
//    * External workspace ID
//    * @example "w-123456789"
//    */
//   extWorkspaceId: string
//   tofuRepoUrl: string
//   tofuRepoRevision: string
//   tofuTemplatePath: string
//   tofuTemplateDir: string
//   credentialConfig: AccountCredentialConfig
//   tofuBackendConfig: IRecordOfAny
//   tofuTfvars: IRecordOfAny
// }
// export interface WorkspaceProvisioningConfig {
//   uid: string;
//   version: number;
//   createdAt: Date;
//   provisionConfig: ProvisionConfig;
// }

// export interface WorkspaceProvisioningConfigList {
//   data: WorkspaceProvisioningConfig[];
//   pagination: PaginationInfo;
//   serverTime?: string;
// }

// export type WorkspaceProvisionConfigInput = Prisma.WorkspaceGetPayload<{
//   select: typeof workspaceProvisionConfigSelect;
// }>;

// export interface WorkspaceProvisionConfigRequestBody {
//   tfvarsOverride: JsonValue
// }

// export interface WorkspaceProvisionConfigResponse {
//   /**
//   * Workspace unique ID
//   * @example "83ef9fc3-159c-43fc-a31f-0d4575dc373c"
//   */
//   workspaceUid: string;
//   extWorkspaceId: string;
//   credentialConfig: AccountCredentialConfig;
//   tofuRepoUrl: string;
//   tofuRepoRevision: string;
//   tofuTemplateDir: string;
//   tofuTemplatePath: string;
//   // tofuBackendConfig: TofuBackendConfig;
//   tofuTfvars: IRecordOfAny;
// }

/******************************************************************************
 * Agent Registration Types
 *****************************************************************************/

/**
 * Request body for agent registration
 */
export interface AgentRegisterRequest {
  /**
   * Bootstrap token for agent registration
   * @example "abc123xyz..."
   */
  token: string;
}

/**
 * mTLS credentials for agent communication
 */
export interface AgentMTLSCredentials {
  /**
   * CA certificate in PEM format
   */
  caCert: string;
  /**
   * Client certificate in PEM format
   */
  clientCert: string;
  /**
   * Client private key in PEM format
   */
  clientKey: string;
  /**
   * Certificate expiration date
   */
  expiresAt: Date;
}

/**
 * Response for successful agent registration
 */
export interface AgentRegisterResponse {
  /**
   * Agent unique ID
   */
  agentUid: string;
  /**
   * Workspace unique ID
   */
  workspaceUid: string;
  /**
   * External workspace ID
   */
  extWorkspaceId: string;
  /**
   * mTLS credentials for secure communication
   */
  mtls: AgentMTLSCredentials;
}

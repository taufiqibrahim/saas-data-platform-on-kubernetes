import { AccountPlanEnum, RoleTypeEnum } from '@prisma/client';

import { PaginationOptions } from '@/types/api.type';
import { PrincipalAuthInfo } from '@/types/auth-middleware-types';

import { CreatedByInfo, PaginationInfo } from '../_shared/shared.type';
import {
  PlatformProviderRegionResponse,
  PlatformProviderResponse,
} from '../platform/platform.type';

export interface AccountResponse {
  /**
   * Unique ID
   * @example "83ef9fc3-159c-43fc-a31f-0d4575dc373c"
   */
  uid: string;
  /**
   * External account ID
   * @example "abc1234"
   */
  extAccountId?: string;
  /**
   * Account name
   * @example "Example Account"
   */
  name: string;
  plan: AccountPlanEnum;
  platformProvider: PlatformProviderResponse;
  platformProviderRegion: PlatformProviderRegionResponse;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  // metadata: any;
  createdBy: CreatedByInfo;
}

export interface AccountFilters {
  q?: string;
  name?: string;
}

export interface GetAccountParams {
  principal: PrincipalAuthInfo;
  accountUid?: string;
  extAccountId?: string;
}

export interface ListAccountsInternalParams {
  principal: PrincipalAuthInfo;
  scope: string;
  filters?: AccountFilters;
  sort?: string;
  order?: string;
  pagination?: PaginationOptions;
}

export interface ListAccountsParams {
  principal: PrincipalAuthInfo;
  filters?: AccountFilters;
  sort?: string;
  order?: string;
  pagination?: PaginationOptions;
}

export interface ListAccountsResponse {
  data: AccountResponse[];
  pagination: PaginationInfo;
  serverTime?: string;
}

export type ProvisionAccountRequestBody = {
  /**
   * Platform provider unique ID
   * @example "8ad0b3a3-3b3c-47ba-99ec-754dcf09a5b1"
   */
  platformProviderUid: string;
  /**
   * Region unique ID
   * @example "1fa42981-f87d-4cec-8ebe-3eb262037ce3"
   */
  platformProviderRegionUid?: string;
  /**
   * Account name
   * @example "ACME Corp"
   */
  accountName?: string;
  /**
   * Account plan
   */
  accountPlan: AccountPlanEnum;
  /**
   * External account ID
   */
  extAccountId?: string;
  /**
   * Create initial account owner
   * @example true
   */
  createInitialAccountOwner?: boolean;
  /**
   * Initial account owner email
   * @example "joe@example.com"
   */
  initialAccountOwnerEmail: string;
};

export interface ProvisionAccountData {
  principal: PrincipalAuthInfo;
  data: ProvisionAccountRequestBody;
}

export type Role = {
  name: string;
  description: string;
  type: RoleTypeEnum;
};

export interface EnsureAccountRolesData {
  accountId: bigint;
  createdByPrincipalId: bigint;
  roles: Role[];
}

export interface ProvisionAccountMembershipData {
  accountId: bigint;
  memberPrincipalId: bigint;
  createdByPrincipalId: bigint;
  roles: Role[];
}

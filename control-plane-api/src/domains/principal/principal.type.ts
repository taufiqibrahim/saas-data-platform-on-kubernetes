import { PaginationOptions } from '@/types/api.type';
import { PrincipalAuthInfo } from '@/types/auth-middleware-types';

import { PaginationInfo } from '../_shared/shared.type';

export interface PrincipalResponse {
  /**
   * Unique ID
   * @example "83ef9fc3-159c-43fc-a31f-0d4575dc373c"
   */
  uid: string;
  /**
   * Principal external ID
   * Examples: user:123 | agent:cluster-1
   * @example "user:joe@example.com"
   */
  externalId: string;
  /**
   * Principal kind
   * @example "user"
   */
  kind: string;
  /**
   * Principal email
   * @example "joe@example.com"
   */
  email: string;
  createdAt: Date;
  deletedAt?: Date | null;
  // createdBy: CreatedByInfo;
}

export interface PrincipalFilters {
  q?: string;
  email?: string;
  kind?: string;
}

export interface ListPrincipalsParams {
  principal: PrincipalAuthInfo;
  filters?: PrincipalFilters;
  sort?: string;
  order?: string;
  pagination?: PaginationOptions;
}

export interface ListPrincipalsResponse {
  data: PrincipalResponse[];
  pagination: PaginationInfo;
  serverTime?: string;
}

export interface ProvisionPrincipalData {
  /**
   * Principal external ID
   * Examples: user:123 | agent:cluster-1
   * @example "user:joe@example.com"
   */
  externalId: string;
  /**
   * Principal kind
   * @example "user"
   */
  kind: string;
  /**
   * Principal email
   * @example "joe@example.com"
   */
  email: string;
  /**
   * System role name
   * @example "UserRole"
   */
  systemRoleName: string;
}

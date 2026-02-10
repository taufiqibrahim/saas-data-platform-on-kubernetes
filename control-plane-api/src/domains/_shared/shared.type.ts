export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalData: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CreatedByInfo {
  uid: string;
  email: string;
  externalId?: string;
}

export interface ValidateErrorJSON {
  message: 'Validation failed';
  details: { [name: string]: unknown };
}

export enum RoleTypeEnum {
  MANAGED_ROLE = 'MANAGED_ROLE',
  CUSTOMER_MANAGED_ROLES = 'CUSTOMER_MANAGED_ROLES',
}

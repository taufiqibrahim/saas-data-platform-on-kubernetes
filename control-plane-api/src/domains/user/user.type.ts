export interface OwnUserInfoAccountMembership {
  /**
   * Account UID
   * @example "83ef9fc3-159c-43fc-a31f-0d4575dc373c"
   */
  accountUid: string;
  /**
   * Account name
   * @example "My Account"
   */
  accountName: string;
  /**
   * Roles within this account
   * @example ["account_admin"]
   */
  roles: string[];
}

export interface OwnUserInfo {
  /**
   * Unique ID
   * @example "83ef9fc3-159c-43fc-a31f-0d4575dc373c"
   */
  uid: string;
  /**
   * Principal external ID
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
   * System roles
   * @example ["system_admin"]
   */
  roles: string[];
  /**
   * Account memberships with roles
   */
  accounts: OwnUserInfoAccountMembership[];
}

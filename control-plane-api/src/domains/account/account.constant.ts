import { Role } from './account.type';

export const DEFAULT_ACCOUNT_ROLES: Role[] = [
  {
    name: 'AccountOwner',
    description:
      'Owns a specific customer account. Can manage workspaces, users, billing, and integrations within the account.',
    type: 'MANAGED_ROLE',
  },
  {
    name: 'AccountAdmin',
    description:
      'Manages users, workspaces, and configuration inside an account. Cannot delete the account or transfer ownership.',
    type: 'MANAGED_ROLE',
  },
  {
    name: 'AccountMember',
    description:
      'Has access to workspaces in the account, depending on workspace-level roles. Cannot manage account settings or users.',
    type: 'MANAGED_ROLE',
  },
];

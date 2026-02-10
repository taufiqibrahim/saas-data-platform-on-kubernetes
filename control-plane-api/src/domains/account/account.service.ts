// import * as AccountMemberService from '@domains/account/accountMember.service';
import { Account, Prisma } from '@prisma/client';

import { prisma } from '@/clients/prisma.client';
import logger from '@/config/logger';
import { checkPermission } from '@/middlewares/authorization.middleware';
import { HttpError } from '@/types/errors';
// import { WorkflowHandle } from '@temporalio/client';
// import { connectTemporalClient } from '@/clients/temporal.client';
// import config from '@/config/config';
// import logger from '@/config/logger';
// import { AccountProvisionConfig, AccountWorkflowOp } from '@/temporal/types/accountProvisioning.type';
// import { accountProvisioningWorkflow } from '@/temporal/workflows/accountProvisioning.workflow';
// import { HttpError } from '@/types/errors';
import { offsetPagination } from '@/utils/api';
import { generateAccountId } from '@/utils/idGenerator';

import { platformProviderRegionSelect, platformProviderSelect } from '../platform/platform.select';
import { createdByPrincipalSelect } from '../principal/principal.select';
// import { generateAccountId } from '@/utils/idGenerator';
// import { createdByUserSelect } from '../user/user.select';
// import { Account, AccountCreateServiceInput, AccountFilters, AccountList, ListAccountsParams, ListAccountsResponse, PartialAccountPatchInput } from './account.type';
import {
  AccountResponse,
  EnsureAccountRolesData,
  GetAccountParams,
  ListAccountsInternalParams,
  ListAccountsParams,
  ListAccountsResponse,
  ProvisionAccountData,
  ProvisionAccountMembershipData,
} from './account.type';

export const accountSelect = {
  uid: true,
  extAccountId: true,
  name: true,
  status: true,
  plan: true,
  platformProvider: {
    select: platformProviderSelect,
  },
  platformProviderRegion: {
    select: platformProviderRegionSelect,
  },
  metadata: true,
  createdAt: true,
  createdBy: { select: createdByPrincipalSelect },
  updatedAt: true,
  // members: {
  //   where: {
  //     accountMemberRoles: {
  //       some: {
  //         accountRole: {
  //           name: ''
  //         }
  //       }
  //     }
  //   },
  //   select: {
  //     principalId: true,
  //   },
  // }
  // credential: {
  //   select: {
  //     uid: true,
  //     credentialName: true,
  //     credentialConfig: true,
  //   },
  // },
  // storage: {
  //   select: {
  //     uid: true,
  //     storageName: true,
  //     storageConfig: true,
  //   },
  // },
  // network: {
  //   select: {
  //     uid: true,
  //     networkName: true,
  //     networkConfig: true,
  //   },
  // },
} satisfies Prisma.AccountSelect;

export async function listAccountsInternal({
  principal,
  scope,
  filters = {},
  sort,
  order,
  pagination = { page: 1, limit: 10 },
}: ListAccountsInternalParams): Promise<ListAccountsResponse> {

  const { page = 1, limit = 10 } = pagination;

  // Filtering
  const q = filters.q?.trim();
  const where: Record<string, unknown> = {
    ...((scope === 'OWNED') && {
      members: {
        some: {
          principalId: principal.id,
        },
      },
    }),

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

  const [totalData, accounts] = await Promise.all([
    prisma.account.count({ where }),
    prisma.account.findMany({
      where,
      select: {
        id: false,
        uid: true,
        extAccountId: true,
        name: true,
        plan: true,
        status: true,
        platformProvider: {
          select: platformProviderSelect,
        },
        platformProviderRegion: {
          select: platformProviderRegionSelect,
        },
        createdAt: true,
        createdBy: {
          select: createdByPrincipalSelect,
        },
        updatedAt: true,
      },
      skip: offsetPagination(page, limit),
      take: limit,
      orderBy,
    }),
  ]);

  const totalPages = Math.ceil(totalData / limit);

  return {
    data: accounts,
    pagination: {
      currentPage: page,
      totalPages,
      totalData,
      limit,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

/******************************************************************************
 * List all available accounts (Admin)
 *****************************************************************************/
export async function listAllAccounts({
  principal,
  filters = {},
  sort,
  order,
  pagination = { page: 1, limit: 10 },
}: ListAccountsParams): Promise<ListAccountsResponse> {
  await checkPermission({
    principal,
    resource: {
      kind: 'account',
      id: '*',
    },
    action: 'account:listAllAccounts',
  });

  return await listAccountsInternal({
    principal,
    scope: "ALL",
    filters,
    sort,
    order,
    pagination,
  })
}

/******************************************************************************
 * List all owned accounts (Account owners)
 *****************************************************************************/
export async function listOwnedAccounts({
  principal,
  filters = {},
  sort,
  order,
  pagination = { page: 1, limit: 10 },
}: ListAccountsParams): Promise<ListAccountsResponse> {
  await checkPermission({
    principal,
    resource: {
      kind: 'account',
      id: '*',
    },
    action: 'account:listOwnedAccounts',
  });

  return await listAccountsInternal({
    principal,
    scope: "OWNED",
    filters,
    sort,
    order,
    pagination,
  })
}

/******************************************************************************
 * Create account
 *****************************************************************************/
export async function createAccountTx(
  tx: Prisma.TransactionClient,
  { principal, data }: ProvisionAccountData,
): Promise<Account> {
  await checkPermission({
    principal,
    resource: {
      kind: 'account',
      id: '*',
    },
    action: 'account:provisionAccount',
  });

  let account;

  // Validate platform provider
  const platformProvider = await prisma.platformProvider.findUnique({
    where: { uid: data.platformProviderUid },
  });
  if (!platformProvider) {
    throw new HttpError(400, 'Invalid platformProviderUid');
  }

  // Validate platform provider region
  const platformProviderRegion = await prisma.platformProviderRegion.findUnique({
    where: { uid: data.platformProviderRegionUid },
  });
  if (!platformProviderRegion) {
    throw new HttpError(400, 'Invalid platformProviderRegionUid');
  }

  // Validate or generate external account ID
  const sanitizedExtAccountId = data.extAccountId?.trim();
  const extAccountId =
    sanitizedExtAccountId && sanitizedExtAccountId.length >= 5
      ? sanitizedExtAccountId
      : generateAccountId();
  logger.debug({ data, sanitizedExtAccountId, extAccountId }, "Validate or generate external account ID")

  // Check if account exist
  const accountExists = await tx.account.findFirst({
    where: { extAccountId: extAccountId, deletedAt: null },
    include: {
      createdBy: {
        select: createdByPrincipalSelect,
      },
    },
  });

  if (accountExists) {
    logger.warn(
      `Account ${extAccountId} already exists in database with id ${accountExists.id}. Skipping account creation`,
    );
    account = accountExists;
  } else {
    logger.warn(`Creating account ${extAccountId} in database...`);
    account = await tx.account.create({
      data: {
        extAccountId: extAccountId,
        name: data.accountName || 'default',
        platformProviderId: platformProvider.id,
        platformProviderRegionId: platformProviderRegion.id,
        status: 'PROVISIONING',
        plan: data.accountPlan,
        createdById: principal.id as unknown as number,
      },
      include: {
        createdBy: {
          select: createdByPrincipalSelect,
        },
      },
    });
  }

  if (!account) {
    throw new HttpError(400, 'Invalid parameters');
  }

  return account;
}

export async function createAccountMembershipTx(
  tx: Prisma.TransactionClient,
  data: ProvisionAccountMembershipData,
) {
  // await checkPermission({
  //   principal,
  //   resource: {
  //     kind: 'account',
  //     id: '*',
  //   },
  //   action: 'account:getAccount',
  // });

  const accountMember = await tx.accountMember.upsert({
    where: {
      accountId_principalId: {
        accountId: data.accountId,
        principalId: data.memberPrincipalId,
      },
    },
    create: {
      accountId: data.accountId,
      principalId: data.memberPrincipalId,
    },
    update: {},
  });

  const roleNames = data.roles.map((r) => r.name);

  const accountRoles = await tx.accountRole.findMany({
    where: { accountId: data.accountId, name: { in: roleNames } },
    select: { id: true },
  });

  await tx.accountMemberRole.createMany({
    data: accountRoles.map((role) => ({
      accountMemberId: accountMember.id,
      accountRoleId: role.id,
    })),
    skipDuplicates: true,
  });
}

/******************************************************************************
 * Get an account (account members only)
 *****************************************************************************/
export async function getAccount({
  principal,
  accountUid,
}: GetAccountParams): Promise<AccountResponse> {
  await checkPermission({
    principal,
    resource: {
      kind: 'account',
      id: '*',
    },
    action: 'account:getAccount',
  });

  const accountExists = await prisma.account.findUnique({
    where: {
      uid: accountUid,
      deletedAt: null,
    },
    select: accountSelect,
  });

  if (!accountExists) {
    throw new HttpError(404, 'Account not found');
  }

  return accountExists;
}

/******************************************************************************
 * Get an account (account members only)
 *****************************************************************************/
export async function getAccountByExtId({
  principal,
  extAccountId,
}: GetAccountParams): Promise<AccountResponse> {
  console.log("principal.roles", principal.roles)

  // 1. Get account
  const account = await prisma.account.findFirst({
    where: {
      extAccountId,
      deletedAt: null,
      // members: {}
    },
    select: accountSelect,
  });

  // 2. Hide existence
  if (!account) {
    throw new HttpError(404, 'Account not found');
  }

  // 3. Authorize access
  await checkPermission({
    principal,
    action: 'account:getAccount',
    resource: {
      kind: 'account',
      id: account.uid,
      // attr: {
      //   ownerIds: account.owners.map(o => o.userId),
      // },
    },
  });

  // 4. Return if allowed
  return account;
}

export async function ensureAccountRoles(
  tx: Prisma.TransactionClient,
  data: EnsureAccountRolesData,
) {
  const { accountId, createdByPrincipalId, roles } = data;

  if (!roles || roles.length === 0) return;

  // Build lookup map keyed by role name
  const roleMap = new Map(roles.map((r) => [r.name, { description: r.description, type: r.type }]));

  const roleNames = [...roleMap.keys()];

  // 1. Find existing roles
  const existing = await tx.accountRole.findMany({
    where: { accountId, name: { in: roleNames } },
    select: { name: true },
  });

  const existingSet = new Set(existing.map((r) => r.name));

  // 2. Determine missing roles
  const missingRoles = roleNames.filter((r) => !existingSet.has(r));

  if (missingRoles.length === 0) return;

  // 3. Insert missing roles
  await tx.accountRole.createMany({
    data: missingRoles.map((name) => {
      const role = roleMap.get(name)!;
      return {
        accountId,
        createdById: createdByPrincipalId,
        name,
        description: role.description,
        type: role.type,
      };
    }),
    skipDuplicates: true,
  });
}

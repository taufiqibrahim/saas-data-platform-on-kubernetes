import { prisma } from '@/clients/prisma.client';
import { checkPermission } from '@/middlewares/authorization.middleware';
import { startAccountProvisioning } from '@/temporal/temporal';
import { HttpError } from '@/types/errors';

import { DEFAULT_ACCOUNT_ROLES } from '../account/account.constant';
import * as AccountService from '../account/account.service';
import { AccountCreatedResponse, ProvisionAccountData } from '../account/account.type';
import * as PrincipalService from '../principal/principal.service';

export async function provisionAccount({
  principal,
  data,
}: ProvisionAccountData): Promise<AccountCreatedResponse | null> {
  await checkPermission({
    principal,
    resource: {
      kind: 'account',
      id: 'system',
    },
    action: 'account:provisionAccount',
  });

  // TODO:
  // Handle if account exists by extAccountId

  // Create account and related DB records in a transaction
  const accountProvisioned = await prisma.$transaction(async (tx) => {
    // Create account
    const account = await AccountService.createAccountTx(tx, {
      principal,
      data,
    });

    // Populate default account roles
    await AccountService.ensureAccountRoles(tx, {
      accountId: account.id,
      createdByPrincipalId: principal.id as unknown as bigint,
      roles: DEFAULT_ACCOUNT_ROLES,
    });

    // Create account owner principal
    const accountOwner = await PrincipalService.createPrincipalTx(tx, {
      kind: 'user',
      email: data.initialAccountOwnerEmail,
      externalId: `user:${data.initialAccountOwnerEmail}`,
      systemRoleName: 'UserRole',
    });

    // Assign account owner as "UserRole" to principal system role
    // await PrincipalService.

    // Assign account owner membership
    await AccountService.createAccountMembershipTx(tx, {
      accountId: account.id,
      roles: [DEFAULT_ACCOUNT_ROLES[0]],
      memberPrincipalId: accountOwner.id,
      createdByPrincipalId: principal.id as bigint,
    });

    // Recheck and guard on created account
    const accountCreated = await tx.account.findUnique({
      where: { id: account.id },
      select: {
        ...AccountService.accountSelect,
      },
    });

    return accountCreated;
  });

  if (!accountProvisioned) {
    // This should never happen, but we guard anyway
    throw new HttpError(500, 'Account provisioning failed: account not created');
  }

  // Start acccount provisioning Temporal workflow
  const workflowId = await startAccountProvisioning({
    accountName: accountProvisioned.name,
    extAccountId: accountProvisioned.extAccountId,
    initialAccountOwnerEmail: data.initialAccountOwnerEmail,
  });

  return { workflowId, account: accountProvisioned };
}

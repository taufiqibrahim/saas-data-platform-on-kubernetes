import { AccountStatusEnum } from '@prisma/client';

import { createAuthProvisioningAdapter } from '@/adapters/createAuthProvisioningAdapter';
import { prisma } from '@/clients/prisma.client';

/**
 * External auth / Keycloak
 */
export async function provisionExternalAuth(input: {
  extAccountId: string;
  accountName: string;
  ownerEmail: string;
}) {
  const authAdapter = createAuthProvisioningAdapter();

  return await authAdapter.provisionAccount({
    extAccountId: input.extAccountId,
    accountName: input.accountName,
    ownerEmail: input.ownerEmail,
  });
}

/**
 * Compensation for external auth
 */
export async function rollbackExternalAuth(extAccountId: string) {
  const authAdapter = createAuthProvisioningAdapter();
  await authAdapter.rollbackAccount({ extAccountId });
}

/**
 * Account state transitions
 */
export async function updateAccountStatus(extAccountId: string, status: AccountStatusEnum) {
  const account = await prisma.account.findFirst({ where: { extAccountId } });
  if (!account) {
    throw `External account ID ${extAccountId} not found`;
  }
  await prisma.account.update({
    where: { id: account.id },
    data: { status },
  });
}

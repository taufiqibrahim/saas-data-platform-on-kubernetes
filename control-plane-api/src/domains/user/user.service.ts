import { prisma } from '@/clients/prisma.client';
import { checkPermission } from '@/middlewares/authorization.middleware';
import { PrincipalAuthInfo } from '@/types/auth-middleware-types';

import { OwnUserInfo } from './user.type';

export async function getOwnUserInfo({
  principal,
}: {
  principal: PrincipalAuthInfo;
}): Promise<OwnUserInfo> {
  await checkPermission({
    principal,
    resource: {
      kind: 'user',
      id: principal.uid,
    },
    action: 'user:readSelf',
  });

  const accountMembers = await prisma.accountMember.findMany({
    where: { principalId: principal.id },
    select: {
      account: {
        select: {
          uid: true,
          name: true,
        },
      },
      accountMemberRoles: {
        select: {
          accountRole: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return {
    uid: principal.uid,
    externalId: principal.externalId,
    kind: principal.kind,
    email: principal.email,
    roles: principal.roles,
    accounts: accountMembers.map((am) => ({
      accountUid: am.account.uid,
      accountName: am.account.name,
      roles: am.accountMemberRoles.map((r) => r.accountRole.name),
    })),
  };
}

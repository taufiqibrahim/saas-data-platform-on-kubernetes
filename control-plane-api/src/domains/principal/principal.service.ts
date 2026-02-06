import { Principal, Prisma } from '@prisma/client';

import { prisma } from '@/clients/prisma.client';
import { checkPermission } from '@/middlewares/authorization.middleware';
import { PrincipalAuthInfo } from '@/types/auth-middleware-types';
import { HttpError } from '@/types/errors';
import { offsetPagination } from '@/utils/api';

import {
  ListPrincipalsParams,
  ListPrincipalsResponse,
  ProvisionPrincipalData,
} from './principal.type';

export async function getPrincipalAuthInfo(email: string): Promise<PrincipalAuthInfo> {
  const principalAuthInfo = await prisma.principal.findUnique({
    where: { email },
    select: {
      id: true,
      uid: true,
      externalId: true,
      email: true,
      kind: true,
      principalSystemRoles: {
        select: {
          role: true,
        },
      },
    },
  });
  if (!principalAuthInfo) {
    throw new HttpError(401, 'Invalid principal');
  }

  const systemRoles = principalAuthInfo.principalSystemRoles.map((psr) => psr.role.name);
  // if (systemRoles.length < 1) {
  //   throw new HttpError(401, 'Principal must have at least 1 system roles');
  // }

  return {
    id: principalAuthInfo.id,
    uid: principalAuthInfo.uid,
    externalId: principalAuthInfo.externalId,
    kind: principalAuthInfo.kind,
    email: principalAuthInfo.email,
    roles: systemRoles,
    attr: {
      system_roles: systemRoles,
      // accounts?: Record<
      //   string,
      //   {
      //     roles: string[];
      //   }
      // >;
      // workspaces?: Record<
      //   string,
      //   {
      //     account_id: string;
      //     roles: string[];
      //   }
      // >;
    },
  };
}

export async function listPrincipals({
  principal,
  filters = {},
  sort,
  order,
  pagination = { page: 1, limit: 10 },
}: ListPrincipalsParams): Promise<ListPrincipalsResponse> {
  await checkPermission({
    principal,
    resource: {
      kind: 'principal',
      id: 'system',
    },
    action: 'iam:listPrincipals',
  });

  const { page = 1, limit = 10 } = pagination;

  // Filtering
  const q = filters.q?.trim();
  const where: Record<string, unknown> = {
    ...(q && {
      OR: [{ email: { contains: q, mode: 'insensitive' } }],
    }),

    ...(filters.kind && {
      kind: filters.kind,
    }),
  };

  // Order by / sorting
  const orderBy = sort && order ? { [sort]: order.toLowerCase() } : undefined;

  const [totalData, principals] = await Promise.all([
    prisma.principal.count({ where }),
    prisma.principal.findMany({
      where,
      select: {
        id: false,
        uid: true,
        kind: true,
        externalId: true,
        email: true,
        createdAt: true,
      },
      skip: offsetPagination(page, limit),
      take: limit,
      orderBy,
    }),
  ]);

  const totalPages = Math.ceil(totalData / limit);

  return {
    data: principals,
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

export async function createPrincipalTx(
  tx: Prisma.TransactionClient,
  data: ProvisionPrincipalData,
): Promise<Principal> {
  // await checkPermission({
  //   principal,
  //   resource: {
  //     kind: 'principal',
  //     id: 'system',
  //   },
  //   action: 'iam:createPrincipal',
  // });

  const newPrincipal = await tx.principal.upsert({
    where: {
      email: data.email,
    },
    create: {
      email: data.email,
      externalId: data.externalId,
      kind: data.kind,
    },
    update: {},
  });

  const systemRole = await tx.systemRole.findUnique({
    where: { name: data.systemRoleName },
  });
  if (!systemRole) {
    throw new HttpError(404, 'System role not found');
  }

  if (newPrincipal) {
    await tx.principalSystemRole.upsert({
      where: {
        principalId_roleId: {
          principalId: newPrincipal.id,
          roleId: systemRole.id,
        },
      },
      create: {
        principalId: newPrincipal.id,
        roleId: systemRole.id,
      },
      update: {},
    });
  }

  return newPrincipal;
}

import {
  PlatformProvider,
  PlatformProviderNameEnum,
  PlatformProviderRegion,
  PrismaClient,
} from '@prisma/client';

import { HttpError } from '@/types/errors';
import { offsetPagination } from '@/utils/api';

import { platformProviderRegionSelect } from './platform.select';
import {
  ListPlatformProviderRegionsParams,
  ListPlatformProviderRegionsResponse,
  ListPlatformProvidersParams,
  ListPlatformProvidersResponse,
} from './platform.type';

const prisma = new PrismaClient();

export async function listPlatformProviders({
  filters = {},
  pagination = { page: 1, limit: 10 },
}: ListPlatformProvidersParams): Promise<ListPlatformProvidersResponse> {
  const { name } = filters;
  const { page = 1, limit = 10 } = pagination;

  const where: Record<string, unknown> = {};
  if (name) where.name = { contains: name, mode: 'insensitive' as const };

  const [totalData, platformProviders] = await Promise.all([
    prisma.platformProvider.count({ where }),
    prisma.platformProvider.findMany({
      where,
      select: {
        id: false,
        uid: true,
        name: true,
        displayName: true,
        regions: {
          select: {
            id: false,
            uid: true,
            name: true,
            displayName: true,
          },
        },
      },
      skip: offsetPagination(page, limit),
      take: limit,
    }),
  ]);

  const totalPages = Math.ceil(totalData / limit);

  return {
    data: platformProviders,
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

export async function getPlatformProviderByName(name: string): Promise<PlatformProvider> {
  const platformProvider = await prisma.platformProvider.findUnique({
    where: { name: name as PlatformProviderNameEnum },
  });

  if (!platformProvider) {
    throw new HttpError(400, `Platform provider ${name} not found`);
  }

  return platformProvider;
}

export async function getPlatformProviderRegionByName(
  platformProviderName: string,
  name: string,
): Promise<PlatformProviderRegion> {
  const platformProvider = await getPlatformProviderByName(platformProviderName);
  const platformProviderRegion = await prisma.platformProviderRegion.findUnique({
    where: {
      platformProviderId_name: {
        platformProviderId: platformProvider.id,
        name,
      },
    },
  });

  if (!platformProviderRegion) {
    throw new HttpError(400, `Platform provider region ${name} not found`);
  }

  return platformProviderRegion;
}

export async function listPlatformProviderRegions({
  platformProviderUid,
  filters = {},
  sort,
  order,
  pagination = { page: 1, limit: 10 },
}: ListPlatformProviderRegionsParams): Promise<ListPlatformProviderRegionsResponse> {
  // await checkPermission({
  //   principal,
  //   resource: {
  //     kind: 'x',
  //     id: '*',
  //   },
  //   action: 'x:listPlatformProviderRegions',
  // });

  const { page = 1, limit = 10 } = pagination;

  // Filtering
  const q = filters.q?.trim();
  const where: Record<string, unknown> = {
    ...{
      platformProvider: { uid: platformProviderUid },
    },
    ...(q && {
      OR: [{ name: { contains: q, mode: 'insensitive' } }],
    }),

    ...(filters.name && {
      name: filters.name,
    }),
  };

  // Order by / sorting
  const orderBy = sort && order ? { [sort]: order.toLowerCase() } : undefined;

  const [totalData, accounts] = await Promise.all([
    prisma.platformProviderRegion.count({ where }),
    prisma.platformProviderRegion.findMany({
      where,
      select: platformProviderRegionSelect,
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

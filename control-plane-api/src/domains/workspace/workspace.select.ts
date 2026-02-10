import { Prisma } from '@prisma/client';

import { createdByPrincipalSelect } from '../principal/principal.select';

export const workspaceSelect = {
  id: false,
  uid: true,
  extWorkspaceId: true,
  name: true,
  status: true,
  description: true,
  account: {
    select: {
      uid: true,
      extAccountId: true,
      platformProvider: {
        select: {
          name: true,
          displayName: true,
        },
      },
    },
  },
  clusterAgent: {
    select: {
      uid: true,
      status: true,
      lastPingAt: true,
      bootstrapToken: {
        select: {
          token: true,
          expiredAt: true,
        },
      },
    },
  },
  // credential: {
  //   select: {
  //     uid: true,
  //     credentialName: true,
  //     cloudProvider: true,
  //     createdAt: true,
  //     createdBy: { select: createdByPrincipalSelect },
  //   },
  // },
  // storage: {
  //   select: {
  //     uid: true,
  //     storageName: true,
  //     cloudProvider: true,
  //     cloudRegion: true,
  //     type: true,
  //     storageConfig: true,
  //     createdAt: true,
  //     createdBy: { select: createdByPrincipalSelect },
  //   },
  // },
  // network: {
  //   select: {
  //     uid: true,
  //     networkName: true,
  //     cloudProvider: true,
  //     cloudRegion: true,
  //     networkConfig: true,
  //     createdAt: true,
  //     createdBy: { select: createdByPrincipalSelect },
  //   },
  // },
  createdAt: true,
  createdBy: {
    select: createdByPrincipalSelect,
  },
  updatedAt: true,
} satisfies Prisma.WorkspaceSelect;

export const workspaceProvisionConfigSelect = {
  id: false,
  uid: true,
  extWorkspaceId: true,
  name: true,
  status: true,
  // cloudRegion: {
  //   include: {
  //     cloudProvider: true,
  //   },
  // },
  // credential: {
  //   select: {
  //     uid: true,
  //     credentialName: true,
  //     credentialConfig: true,
  //     cloudProvider: true,
  //   },
  // },
  // storage: {
  //   select: {
  //     uid: true,
  //     storageName: true,
  //     cloudProvider: true,
  //     cloudRegion: true,
  //     type: true,
  //     storageConfig: true,
  //   },
  // },
  // network: {
  //   select: {
  //     uid: true,
  //     networkName: true,
  //     cloudProvider: true,
  //     cloudRegion: true,
  //     networkConfig: true,
  //   },
  // },
  account: {
    select: {
      extAccountId: true,
    },
  },
} satisfies Prisma.WorkspaceSelect;

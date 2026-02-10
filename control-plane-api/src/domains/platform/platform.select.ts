import { Prisma } from '@prisma/client';

export const platformProviderSelect = {
  uid: true,
  name: true,
  displayName: true,
} satisfies Prisma.PlatformProviderSelect;

export const platformProviderRegionSelect = {
  uid: true,
  name: true,
  displayName: true,
} satisfies Prisma.PlatformProviderRegionSelect;

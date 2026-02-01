import { Prisma } from '@prisma/client';

export const platformProviderSelect = Prisma.validator<Prisma.PlatformProviderSelect>()({
  uid: true,
  name: true,
  displayName: true,
});

export const platformProviderRegionSelect = Prisma.validator<Prisma.PlatformProviderRegionSelect>()(
  {
    uid: true,
    name: true,
    displayName: true,
  },
);

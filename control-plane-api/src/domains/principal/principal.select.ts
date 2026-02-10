import { Prisma } from '@prisma/client';

export const createdByPrincipalSelect = {
  uid: true,
  externalId: true,
  email: true,
} satisfies Prisma.PrincipalSelect;

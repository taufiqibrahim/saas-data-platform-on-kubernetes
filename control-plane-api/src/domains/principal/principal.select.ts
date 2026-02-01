import { Prisma } from '@prisma/client';

export const createdByPrincipalSelect = Prisma.validator<Prisma.PrincipalSelect>()({
  uid: true,
  externalId: true,
  email: true,
});

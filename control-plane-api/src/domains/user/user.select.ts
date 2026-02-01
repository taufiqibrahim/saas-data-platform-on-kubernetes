// import { Prisma } from '@prisma/client';

// export const createdByUserSelect = Prisma.validator<Prisma.UserSelect>()({
//   uid: true,
//   email: true,
// });

// export const internalUserSelect = {
//   id: true,
//   uid: true,
//   kcSub: false,
//   email: true,
//   fullName: true,
//   avatarUrl: true,
//   createdAt: true,
// } as const;

// // Base interface for user selection
// export const baseUserSelect = Prisma.validator<Prisma.UserSelect>()({
//   uid: true,
//   email: true,
//   fullName: true,
//   avatarUrl: true,
// });

// /**
//  * Base session info select (id excluded)
//  */
// export const userSessionInfoSelect = Prisma.validator<Prisma.UserSelect>()({
//   id: false,
//   uid: true,
//   email: true,
//   fullName: true,
//   avatarUrl: true,
//   createdAt: true,
//   accountMembers: {
//     select: {
//       account: {
//         select: {
//           uid: true,
//           name: true,
//           plan: true,
//           createdAt: true,
//           deletedAt: true,
//           workspaces: {
//             select: {
//               uid: true,
//               name: true,
//               createdAt: true,
//               members: {
//                 select: {
//                   role: {
//                     select: {
//                       uid: true,
//                       name: true,
//                       description: true,
//                     },
//                   },
//                 },
//               },
//             },
//           },
//         },
//       },
//     },
//   },
// });

// /**
//  * Variant that overrides the top-level `id` to be included.
//  */
// export const userInternalSessionInfoSelect = Prisma.validator<Prisma.UserSelect>()({
//   ...userSessionInfoSelect,
//   id: true,
// } as const);

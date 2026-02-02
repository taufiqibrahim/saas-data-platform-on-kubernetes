import { PrismaClient, PlatformProviderNameEnum } from '@prisma/client';
import { supportedPlatformProviders } from './platform.seed';
import { systemPrincipals, systemRoles } from './roles.seed';
import { apps } from './apps.seed';
const prisma = new PrismaClient();

async function seedSupportedPlatformProviders() {
  console.log('Seeding supported platform providers...');
  for (const pp of supportedPlatformProviders) {

    const platformProvider = await prisma.platformProvider.upsert({
      where: { uid: pp.uid },
      update: {
        name: pp.name as PlatformProviderNameEnum,
        displayName: pp.displayName,
      },
      create: {
        uid: pp.uid,
        name: pp.name as PlatformProviderNameEnum,
        displayName: pp.displayName,
      },
    });

    if (pp.regions && pp.regions.length > 0) {
      for (const ppr of pp.regions) {
        await prisma.platformProviderRegion.upsert({
          where: {
            uid: ppr.uid,
          },
          create: {
            uid: ppr.uid,
            platformProviderId: platformProvider.id,
            name: ppr.name,
            displayName: ppr.displayName,
          },
          update: {
            platformProviderId: platformProvider.id,
            name: ppr.name,
            displayName: ppr.displayName,
          },
        })
      }
    }
  }
}

async function seedSystemRoles() {
  console.log('Seeding system roles...');
  for (const r of systemRoles) {
    await prisma.systemRole.upsert({
      where: { uid: r.uid },
      update: {
        name: r.name
      },
      create: {
        uid: r.uid,
        name: r.name
      },
    });
  }
}

async function seedSystemPrincipals() {
  console.log('Seeding system principals...');
  const systemRole = await prisma.systemRole.findUnique({
    where: {
      name: "SystemRole"
    }
  })

  if (!systemRole) {
    throw new Error("system_admin role not found");
  }

  for (const sp of systemPrincipals) {

    // Create principals
    const principal = await prisma.principal.upsert({
      where: { uid: sp.uid },
      update: {
        email: sp.email,
        externalId: sp.externalId,
        kind: sp.kind
      },
      create: {
        uid: sp.uid,
        email: sp.email,
        externalId: sp.externalId,
        kind: sp.kind,
      },
    });

    // Attach principal system role
    await prisma.principalSystemRole.upsert({
      where: {
        principalId_roleId: {
          principalId: principal.id,
          roleId: systemRole.id
        }
      },
      create: {
        principalId: principal.id,
        roleId: systemRole.id
      },
      update: {},
    })
  }
}

async function seedInitialApps() {
  console.log('Seeding initial apps...');
  for (const r of apps) {
    await prisma.app.upsert({
      where: { uid: r.uid },
      update: { name: r.name, description: r.description, displayName: r.displayName, isFreeTier: true },
      create: { uid: r.uid, name: r.name, description: r.description, displayName: r.displayName, isFreeTier: true },
    });

    // // Upsert versions
    // for (const v of r.versions) {
    //   await prisma.appVersion.upsert({
    //     where: {
    //       // composite unique key or fallback to unique (name+version) if not using composite ID
    //       uid: v.uid,
    //     },
    //     update: {
    //       appId: app.id,
    //       version: v.version,
    //       appVersion: v.app_version,
    //       isDefault: v.isDefault,
    //       releaseDate: v.releaseDate,
    //     },
    //     create: {
    //       uid: v.uid,
    //       appId: app.id,
    //       version: v.version,
    //       appVersion: v.app_version,
    //       isDefault: v.isDefault,
    //       releaseDate: v.releaseDate,
    //     },
    //   });
    // }

    // // Upsert tfvars templates
    // for (const t of r.templates) {
    //   await prisma.appTfvarsTemplate.upsert({
    //     where: {
    //       appId_provider: {
    //         appId: app.id,
    //         provider: t.provider as Provider,
    //       }
    //     },
    //     update: {
    //       appId: app.id,
    //       tfvars: t.tfvars,
    //       isDefault: t.isDefault,
    //     },
    //     create: {
    //       appId: app.id,
    //       provider: t.provider as Provider,
    //       tfvars: t.tfvars,
    //       isDefault: t.isDefault,
    //     },
    //   });
    // }
  }
}

async function main() {
  await seedSupportedPlatformProviders()
  await seedSystemRoles()
  await seedSystemPrincipals()
  await seedInitialApps();

  console.log('Seed finished');
}

main().then(() => prisma.$disconnect());

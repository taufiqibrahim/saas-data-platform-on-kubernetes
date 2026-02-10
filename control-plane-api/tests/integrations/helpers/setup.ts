import { execSync } from 'child_process';

/**
 * Run DB migrations and seed data against the test database.
 * Expects DATABASE_URL to point at the test DB (via .env.test).
 */
export function migrateAndSeed(): void {
  console.log('[test-setup] Running Prisma migrate reset...');
  execSync('pnpm exec prisma migrate reset --force', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  console.log('[test-setup] Running DB seed...');
  execSync('pnpm exec ts-node prisma/seeds/init.ts', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
}

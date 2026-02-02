// import { execSync } from 'child_process';
// import { PrismaClient } from '@prisma/client';
// import { mockLogger } from './src/__mocks__/config/logger';

// jest.mock('@keycloak/keycloak-admin-client');
// jest.mock('@config/logger', () => mockLogger);

// beforeAll(() => {
//   process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./test.db';
//   execSync('npx prisma migrate reset --force --skip-seed', { stdio: 'inherit' });
//   execSync('npx prisma generate', { stdio: 'inherit' });
//   execSync('pnpm seed', { stdio: 'inherit' }); // or your seed file
// });

// afterAll(async () => {
//   const prisma = new PrismaClient();
//   await prisma.$disconnect();
// });

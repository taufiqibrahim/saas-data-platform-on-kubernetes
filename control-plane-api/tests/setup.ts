import dotenv from 'dotenv';
import path from 'path';
import { resetMigrationAndSeed } from './helpers/db-setup';
import { setupKeycloakSaaSRealm } from './helpers/auth-setup';

// Runs in every test worker (via setupFiles) — loads .env.test into process.env
dotenv.config({ path: path.resolve(__dirname, '..', '.env.test'), override: true });

export const baseUrl = process.env.BASE_URL;

// Runs once before all tests (via globalSetup)
export async function setup() {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.test'), override: true });
  resetMigrationAndSeed();
  await setupKeycloakSaaSRealm();
}

export async function teardown() {
  // teardown if needed
}

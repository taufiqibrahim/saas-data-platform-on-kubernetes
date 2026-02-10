import KcAdminClient from '@keycloak/keycloak-admin-client';

export function getKeycloakUrl(): string {
  const protocol = process.env.KEYCLOAK_ADMIN_PROTOCOL || 'https';
  const host = process.env.KEYCLOAK_ADMIN_HOST || 'localhost';
  const port = process.env.KEYCLOAK_ADMIN_PORT || '443';
  return `${protocol}://${host}:${port}`;
}

export const SAAS_REALM = 'saas-test';
export const SAAS_CLIENT_ID = 'saas-test-client';
export const SAAS_USER_EMAIL = 'admin@saas.internal';
export const SAAS_USER_PASSWORD = 'admin123';

export async function setupKeycloakSaaSRealm(): Promise<void> {
  console.log("Setting up SaaS realm and admin user...")
  console.log(`Keycloak URL=${process.env.KEYCLOAK_HOST}`)
  const kc = new KcAdminClient({
    baseUrl: process.env.KEYCLOAK_HOST,
    realmName: 'master',
  });

  console.log(`Authenticating with Keycloak admin...`);
  await kc.auth({
    grantType: 'password',
    clientId: 'admin-cli',
    username: process.env.KEYCLOAK_ADMIN_USERNAME,
    password: process.env.KEYCLOAK_ADMIN_PASSWORD,
  });
  console.log(`Authenticated.`);

  // Check if realm exists
  const existing = await kc.realms.findOne({ realm: SAAS_REALM });
  if (existing) return;

  // Create realm
  await kc.realms.create({
    realm: SAAS_REALM,
    enabled: true,
    registrationAllowed: false,
    requiredActions: [],
  });

  // Switch to test realm for client/user operations
  kc.setConfig({ realmName: SAAS_REALM });

  // Create client
  await kc.clients.create({
    clientId: SAAS_CLIENT_ID,
    enabled: true,
    publicClient: true,
    directAccessGrantsEnabled: true,
    redirectUris: ['*'],
    webOrigins: ['*'],
    protocol: 'openid-connect',
  });

  // Create test user
  await kc.users.create({
    username: SAAS_USER_EMAIL,
    email: SAAS_USER_EMAIL,
    enabled: true,
    emailVerified: true,
    requiredActions: [],
    credentials: [
      {
        type: 'password',
        value: SAAS_USER_PASSWORD,
        temporary: false,
      },
    ],
  });
}


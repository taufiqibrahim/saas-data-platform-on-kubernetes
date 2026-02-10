import axios from 'axios';

import { initKeycloakAdminClient } from '@/clients/keycloak-admin.client';
import config from '@/config/config';

const TEST_REALM = 'test-realm';
const TEST_CLIENT_ID = 'test-client';
const TEST_USER_EMAIL = 'admin@saas.internal';
const TEST_USER_PASSWORD = 'testpassword123';

const keycloakUrl = `${config.keycloakAdmin.protocol}://${config.keycloakAdmin.host}:${config.keycloakAdmin.port}`;

export async function setupKeycloakTestRealm(): Promise<void> {
  const kc = await initKeycloakAdminClient();

  // Check if realm exists
  const existing = await kc.realms.findOne({ realm: TEST_REALM });
  if (existing) return;

  // Create realm
  await kc.realms.create({
    realm: TEST_REALM,
    enabled: true,
    registrationAllowed: false,
    requiredActions: [],
  });

  // Switch to test realm for client/user operations
  kc.setConfig({ realmName: TEST_REALM });

  // Create client
  await kc.clients.create({
    clientId: TEST_CLIENT_ID,
    enabled: true,
    publicClient: true,
    directAccessGrantsEnabled: true,
    redirectUris: ['*'],
    webOrigins: ['*'],
    protocol: 'openid-connect',
  });

  // Create test user
  await kc.users.create({
    username: TEST_USER_EMAIL,
    email: TEST_USER_EMAIL,
    enabled: true,
    emailVerified: true,
    requiredActions: [],
    credentials: [
      {
        type: 'password',
        value: TEST_USER_PASSWORD,
        temporary: false,
      },
    ],
  });
}

export async function getTestToken(): Promise<string> {
  const url = `${keycloakUrl}/realms/${TEST_REALM}/protocol/openid-connect/token`;

  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: TEST_CLIENT_ID,
    username: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,

    // include ONLY if the client is confidential
    // client_secret: TEST_CLIENT_SECRET,
  });

  const res = await axios.post(url, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return res.data.access_token;
}

export async function teardownKeycloakTestRealm(): Promise<void> {
  try {
    const kc = await initKeycloakAdminClient();
    await kc.realms.del({ realm: TEST_REALM });
  } catch {
    // Ignore errors during teardown
  }
}

import { describe, it, expect, beforeAll } from 'vitest';
import app from '../../src/app';
import { User } from '../helpers/user';
import {
  getKeycloakUrl,
  SAAS_REALM,
  SAAS_CLIENT_ID,
  SAAS_USER_EMAIL,
  SAAS_USER_PASSWORD,
} from '../helpers/auth-setup';
import { findPlatformProvider } from 'tests/helpers/api';
import { PLATFORM_KUBERNETES, PLATFORM_KUBERNETES_EXT_ACCOUNT_ID, TENANT_EMAIL } from 'tests/constants';

let admin: User;

beforeAll(async () => {
  admin = new User({
    username: SAAS_USER_EMAIL,
    password: SAAS_USER_PASSWORD,
    serverUrl: getKeycloakUrl(),
    realmName: SAAS_REALM,
    clientId: SAAS_CLIENT_ID,
  });
});

describe('Admin list principals', () => {
  it('should return 401 without auth token', async () => {
    const res = await admin.request(app, 'get', '/api/v1/admin/principals', { token: null });
    expect(res.status).toBe(401);
  });

  it('should return list of principals with valid token', async () => {
    const res = await admin.request(app, 'get', '/api/v1/admin/principals');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body).toHaveProperty('pagination');
  });
});

describe(`Admin provision account with platform=${PLATFORM_KUBERNETES}`, () => {
  let platformProviderUid: string;
  let platformProviderRegionUid: string | null;

  beforeAll(async () => {
    const provider = await findPlatformProvider(PLATFORM_KUBERNETES);
    platformProviderUid = provider.uid;
    platformProviderRegionUid = provider.regions?.[0]?.uid ?? null;
  });

  it('should return 201 on successful account provisioning', async () => {
    const res = await admin.request(app, 'post', '/api/v1/admin/accounts', {
      body: {
        platformProviderUid,
        platformProviderRegionUid,
        accountName: 'ACME Kubernetes account',
        accountPlan: 'enterprise',
        extAccountId: PLATFORM_KUBERNETES_EXT_ACCOUNT_ID,
        createInitialAccountOwner: true,
        initialAccountOwnerEmail: TENANT_EMAIL,
      },
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('workflowId');
  });
});

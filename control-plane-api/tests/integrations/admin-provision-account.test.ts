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

  // it('should return 401 with invalid token', async () => {
  //   const res = await admin.request(app, 'get', '/api/v1/admin/principals', { token: 'invalid-token' });
  //   expect(res.status).toBe(401);
  // });

  it('should return list of principals with valid token', async () => {
    const res = await admin.request(app, 'get', '/api/v1/admin/principals');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body).toHaveProperty('pagination');
  });
});

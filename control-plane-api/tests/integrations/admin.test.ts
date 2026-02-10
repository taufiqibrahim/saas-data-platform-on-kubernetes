import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

import app from '../../src/app';
import { getTestToken, setupKeycloakTestRealm, teardownKeycloakTestRealm } from './helpers/auth';
import { migrateAndSeed } from './helpers/setup';

let token: string;

beforeAll(async () => {
  // 1. Migrate + seed the test DB
  migrateAndSeed();

  // 2. Set up Keycloak test realm with a user matching the seeded principal
  await setupKeycloakTestRealm();

  // 3. Get a valid JWT
  token = await getTestToken();
}, 120_000);

afterAll(async () => {
  await teardownKeycloakTestRealm();
});

describe('GET /api/v1/admin/principals', () => {
  it('should return 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/admin/principals');
    expect(res.status).toBe(401);
  });

  it('should return list of principals with valid token', async () => {
    const res = await request(app)
      .get('/api/v1/admin/principals')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    // Seeded principal should be in the list
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body).toHaveProperty('pagination');
  });
});

describe('GET /api/v1/admin/accounts', () => {
  it('should return 401 without auth token', async () => {
    const res = await request(app).get('/api/v1/admin/accounts');
    expect(res.status).toBe(401);
  });

  it('should return list of accounts with valid token', async () => {
    const res = await request(app)
      .get('/api/v1/admin/accounts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('pagination');
  });
});

describe('POST /api/v1/admin/accounts', () => {
  it('should return 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/admin/accounts')
      .send({ name: 'test' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/admin/accounts', () => {
  it('should return 400 when provision account with empty initialAccountOwnerEmail', async () => {
    const res = await request(app)
      .post('/api/v1/admin/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        platformProviderUid: '',
        platformProviderRegionUid: '',
        accountName: 'testAccountKubernetes',
        accountPlan: 'enterprise',
        createInitialAccountOwner: true,
        initialAccountOwnerEmail: '',
      });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/admin/accounts', () => {
  it('should able to provision kubernetes native account', async () => {
    const res = await request(app)
      .post('/api/v1/admin/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        platformProviderUid: '',
        platformProviderRegionUid: '',
        accountName: 'testAccountKubernetes',
        accountPlan: 'enterprise',
        createInitialAccountOwner: true,
        initialAccountOwnerEmail: '',
      });
    expect(res.status).toBe(201);
  });
});

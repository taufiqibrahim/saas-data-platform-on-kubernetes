import { describe, it } from 'vitest';
import request from 'supertest';
import app from '../../src/app';

describe('Health', () => {
  it('returns 200', async () => {
    await request(app)
      .get('/health')
      .expect(200);
  });
});

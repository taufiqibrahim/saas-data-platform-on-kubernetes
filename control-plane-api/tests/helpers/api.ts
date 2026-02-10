import app from '@/app';
import request from 'supertest';

/**
 * Find a platform provider (and optionally its first region) by name.
 */
export async function findPlatformProvider(name: string) {
  const res = await request(app).get('/api/v1/platformProviders');
  const provider = res.body.data.find((p: any) => p.name === name);
  return provider;
}

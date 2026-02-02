import { default as parentLogger } from '@config/logger';
import IORedis from 'ioredis';

import config from '@/config/config';

const logger = parentLogger.child({ module: 'redis.client' });
const { host, port, password } = config.redis;

const redisClient = new IORedis({
  host,
  port,
  password,
  maxRetriesPerRequest: null, // Required for BullMQ
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redisClient.on('connect', () => logger.info('Redis client connected'));
redisClient.on('error', (err: any) => logger.error({ err }, 'Redis error'));

export default redisClient;

import Redis from 'ioredis';
import { env } from './env';

let redis: Redis | null = null;

function getRedisClient(): Redis {
  if (!redis) {
    const redisConfig: any = {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    };
    if (env.REDIS_PASSWORD) {
      redisConfig.password = env.REDIS_PASSWORD;
    }
    redis = new Redis(redisConfig);

    // Handle connection errors to prevent unhandled error events
    redis.on('error', (err) => {
      logger.error('Redis connection error in cache helper', {
        error: err.message,
      });
    });
  }
  return redis;
}

export const cache = {
  async get(key: string): Promise<string | null> {
    return getRedisClient().get(key);
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    // Support optional TTL; if not provided, perform a plain SET
    if (typeof ttlSeconds === 'number') {
      await getRedisClient().set(key, value, 'EX', ttlSeconds);
      return;
    }

    await getRedisClient().set(key, value);
  },

  async del(key: string): Promise<void> {
    await getRedisClient().del(key);
  },
};

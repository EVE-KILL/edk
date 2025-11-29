import Redis from 'ioredis';
import { env } from './env';

const redisConfig: any = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
};
if (env.REDIS_PASSWORD) {
  redisConfig.password = env.REDIS_PASSWORD;
}

const redis = new Redis(redisConfig);

export const cache = {
  async get(key: string): Promise<string | null> {
    return redis.get(key);
  },

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await redis.set(key, value, 'EX', ttlSeconds);
  },

  async del(key: string): Promise<void> {
    await redis.del(key);
  },
};

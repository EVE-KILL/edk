import Redis from 'ioredis';
import { createStorage } from 'unstorage';
import redisDriver from 'unstorage/drivers/redis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

export function createRedisClient() {
  return new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    db: 0,
  });
}

export const storage = createStorage({
  driver: redisDriver({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
  }),
});

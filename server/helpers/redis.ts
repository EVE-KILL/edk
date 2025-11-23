import Redis from 'ioredis';
import { createStorage } from 'unstorage';
import redisDriver from 'unstorage/drivers/redis';
import { requestContext } from '../utils/request-context';
import { env } from './env';

const REDIS_HOST = env.REDIS_HOST;
const REDIS_PORT = env.REDIS_PORT;

export function createRedisClient() {
  return new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: env.REDIS_PASSWORD || 'redis_password',
    db: 0,
  });
}

const baseStorage = createStorage({
  driver: redisDriver({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: env.REDIS_PASSWORD || 'redis_password',
  }),
});

/**
 * Tracked Redis storage wrapper
 * Automatically tracks Redis operations for performance monitoring
 */
class TrackedStorage {
  private trackOperation<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const performance = requestContext.getStore()?.performance;
    const spanId = performance?.startSpan(`redis:${operation}`, 'cache', { operation });

    return fn().finally(() => {
      if (spanId) performance?.endSpan(spanId);
    });
  }

  async getItem<T = any>(key: string): Promise<T | null> {
    return this.trackOperation('get', () => baseStorage.getItem<T>(key));
  }

  async setItem(key: string, value: any): Promise<void> {
    return this.trackOperation('set', () => baseStorage.setItem(key, value));
  }

  async removeItem(key: string): Promise<void> {
    return this.trackOperation('del', () => baseStorage.removeItem(key));
  }

  async hasItem(key: string): Promise<boolean> {
    return this.trackOperation('exists', () => baseStorage.hasItem(key));
  }

  async getKeys(base?: string): Promise<string[]> {
    return this.trackOperation('keys', () => baseStorage.getKeys(base));
  }

  async clear(base?: string): Promise<void> {
    return this.trackOperation('clear', () => baseStorage.clear(base));
  }

  async getMeta(key: string): Promise<any> {
    return baseStorage.getMeta(key);
  }

  async setMeta(key: string, value: any): Promise<void> {
    return baseStorage.setMeta(key, value);
  }

  async removeMeta(key: string): Promise<void> {
    return baseStorage.removeMeta(key);
  }

  async getItemRaw(key: string): Promise<any> {
    return this.trackOperation('get', () => baseStorage.getItemRaw(key));
  }

  async setItemRaw(key: string, value: any): Promise<void> {
    return this.trackOperation('set', () => baseStorage.setItemRaw(key, value));
  }

  mount(base: string, driver: any) {
    return baseStorage.mount(base, driver);
  }

  async unmount(base: string, dispose?: boolean): Promise<void> {
    return baseStorage.unmount(base, dispose);
  }

  async dispose(): Promise<void> {
    return baseStorage.dispose();
  }

  watch(callback: (event: any, key: string) => void): Promise<() => void> {
    return baseStorage.watch(callback);
  }

  async unwatch(): Promise<void> {
    return baseStorage.unwatch();
  }

  // Additional methods used by rate limiter and other parts of the app
  async increment(key: string): Promise<number> {
    return this.trackOperation('incr', async () => {
      // unstorage doesn't have increment, so we implement it
      const current = (await baseStorage.getItem<number>(key)) || 0;
      const newValue = current + 1;
      await baseStorage.setItem(key, newValue);
      return newValue;
    });
  }

  async setTTL(key: string, ttl: number): Promise<void> {
    return this.trackOperation('expire', async () => {
      // unstorage handles TTL via driver options, we'll use setMeta
      await baseStorage.setMeta(key, { ttl });
    });
  }
}

export const storage = new TrackedStorage();

import Redis from 'ioredis';
import { createStorage } from 'unstorage';
import redisDriver from 'unstorage/drivers/redis';
import { requestContext } from '../utils/request-context';
import { env } from './env';

const REDIS_HOST = env.REDIS_HOST;
const REDIS_PORT = env.REDIS_PORT;

export function createRedisClient() {
  const config: any = {
    host: REDIS_HOST,
    port: REDIS_PORT,
    db: 0,
    lazyConnect: true,
  };
  if (env.REDIS_PASSWORD) {
    config.password = env.REDIS_PASSWORD;
  }
  return new Redis(config);
}

let baseStorage: ReturnType<typeof createStorage> | null = null;

function getBaseStorage() {
  if (!baseStorage) {
    const storageConfig: any = {
      host: REDIS_HOST,
      port: REDIS_PORT,
      lazyConnect: true,
    };
    if (env.REDIS_PASSWORD) {
      storageConfig.password = env.REDIS_PASSWORD;
    }
    baseStorage = createStorage({
      driver: redisDriver(storageConfig),
    });
  }
  return baseStorage;
}

/**
 * Tracked Redis storage wrapper
 * Automatically tracks Redis operations for performance monitoring
 */
class TrackedStorage {
  private trackOperation<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const performance = requestContext.getStore()?.performance;
    const spanId = performance?.startSpan(`redis:${operation}`, 'cache', {
      operation,
    });

    return fn().finally(() => {
      if (spanId) performance?.endSpan(spanId);
    });
  }

  async getItem<T = any>(key: string): Promise<T | null> {
    return this.trackOperation('get', () => getBaseStorage().getItem<T>(key));
  }

  async setItem(key: string, value: any): Promise<void> {
    return this.trackOperation('set', () =>
      getBaseStorage().setItem(key, value)
    );
  }

  async removeItem(key: string): Promise<void> {
    return this.trackOperation('del', () => getBaseStorage().removeItem(key));
  }

  async hasItem(key: string): Promise<boolean> {
    return this.trackOperation('exists', () => getBaseStorage().hasItem(key));
  }

  async getKeys(base?: string): Promise<string[]> {
    return this.trackOperation('keys', () => getBaseStorage().getKeys(base));
  }

  async clear(base?: string): Promise<void> {
    return this.trackOperation('clear', () => getBaseStorage().clear(base));
  }

  async getMeta(key: string): Promise<any> {
    return getBaseStorage().getMeta(key);
  }

  async setMeta(key: string, value: any): Promise<void> {
    return getBaseStorage().setMeta(key, value);
  }

  async removeMeta(key: string): Promise<void> {
    return getBaseStorage().removeMeta(key);
  }

  async getItemRaw(key: string): Promise<any> {
    return this.trackOperation('get', () => getBaseStorage().getItemRaw(key));
  }

  async setItemRaw(key: string, value: any): Promise<void> {
    return this.trackOperation('set', () =>
      getBaseStorage().setItemRaw(key, value)
    );
  }

  mount(base: string, driver: any) {
    return getBaseStorage().mount(base, driver);
  }

  async unmount(base: string, dispose?: boolean): Promise<void> {
    return getBaseStorage().unmount(base, dispose);
  }

  async dispose(): Promise<void> {
    return getBaseStorage().dispose();
  }

  watch(callback: (event: any, key: string) => void): Promise<() => void> {
    return getBaseStorage().watch(callback);
  }

  async unwatch(): Promise<void> {
    return getBaseStorage().unwatch();
  }

  // Additional methods used by rate limiter and other parts of the app
  async increment(key: string): Promise<number> {
    return this.trackOperation('incr', async () => {
      // unstorage doesn't have increment, so we implement it
      const storage = getBaseStorage();
      const current = (await storage.getItem<number>(key)) || 0;
      const newValue = current + 1;
      await storage.setItem(key, newValue);
      return newValue;
    });
  }

  async setTTL(key: string, ttl: number): Promise<void> {
    return this.trackOperation('expire', async () => {
      // unstorage handles TTL via driver options, we'll use setMeta
      await getBaseStorage().setMeta(key, { ttl });
    });
  }
}

export const storage = new TrackedStorage();

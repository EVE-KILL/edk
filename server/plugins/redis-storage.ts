import redisDriver from 'unstorage/drivers/redis';
import { env } from '../helpers/env';

export default defineNitroPlugin(() => {
  const storage = useStorage();

  // Only mount Redis storage if Redis is configured
  if (env.REDIS_HOST && env.REDIS_PORT) {
    try {
      const storageConfig: any = {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        lazyConnect: true,
      };

      if (env.REDIS_PASSWORD) {
        storageConfig.password = env.REDIS_PASSWORD;
      }

      storage.mount('redis', redisDriver(storageConfig));
      logger.info('Redis storage mounted successfully');
    } catch (error) {
      logger.warn('Failed to mount Redis storage, continuing without cache', {
        error: (error as Error).message,
      });
    }
  } else {
    logger.warn('Redis configuration missing, skipping storage mount');
  }
});

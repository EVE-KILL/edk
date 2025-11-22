import { defineEventHandler } from 'h3';
import { database } from '../helpers/database';
import { cache } from '../helpers/cache';

import { handleError } from '../utils/error';

export default defineEventHandler(async (event) => {
  try {
    // Test Postgres connection
    const dbConnected = await database.ping();

    // Test Redis cache
    const cacheKey = 'test:connection';
    await cache.set(
      cacheKey,
      { timestamp: Date.now(), message: 'Hello from cache!' },
      60
    );
    const cachedData = await cache.get(cacheKey);

    // Get some basic Postgres info
    let dbInfo: any = null;
    if (dbConnected) {
      const [result] = await database.sql<
        { version: string }[]
      >`SELECT version() as version`;
      dbInfo = result;
    }

    return {
      status: 'ok',
      services: {
        postgres: {
          connected: dbConnected,
          version: dbInfo?.version || 'unknown',
        },
        redis: {
          connected: cachedData !== null,
          testData: cachedData,
        },
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return handleError(event, error);
  }
});

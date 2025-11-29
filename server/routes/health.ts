import { defineEventHandler } from 'h3';
import { database } from '../helpers/database';
import { cache } from '../helpers/cache';
import { statfs, readFile } from 'fs/promises';
import { Queue } from 'bullmq';
import { env } from '../helpers/env';

async function getDbStatus() {
  const startTime = Date.now();
  try {
    await database.sql`SELECT 1`;
    const latency = Date.now() - startTime;
    return { status: 'ok', latency: `${latency}ms` };
  } catch (error) {
    logger.error('Error checking database status:', {
      error: (error as Error).message,
    });
    const latency = Date.now() - startTime;
    return {
      status: 'error',
      latency: `${latency}ms`,
      error: 'Connection failed',
    };
  }
}

async function getRedisStatus() {
  const startTime = Date.now();
  try {
    await cache.get('healthcheck');
    const latency = Date.now() - startTime;
    return { status: 'ok', latency: `${latency}ms` };
  } catch (error) {
    logger.error('Error checking Redis status:', {
      error: (error as Error).message,
    });
    const latency = Date.now() - startTime;
    return {
      status: 'error',
      latency: `${latency}ms`,
      error: 'Connection failed',
    };
  }
}

async function getQueueStatus() {
  const REDIS_CONFIG = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    db: 0,
  };

  const queueNames = [
    'alliance',
    'character',
    'corporation',
    'killmail',
    'price',
  ];
  const status: Record<
    string,
    { waiting: number; active: number; failed: number }
  > = {};

  for (const name of queueNames) {
    try {
      const queue = new Queue(name, { connection: REDIS_CONFIG });
      const [waiting, active, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getFailedCount(),
      ]);
      status[name] = { waiting, active, failed };
      await queue.close();
    } catch {
      status[name] = { waiting: -1, active: -1, failed: -1 };
    }
  }
  return status;
}

async function getMemoryUsage() {
  try {
    const memUsage = process.memoryUsage();
    return {
      used: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`,
      heap_total: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
    };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

async function getDiskSpace() {
  try {
    const stats = await statfs('/');
    const free = stats.bavail * stats.bsize;
    const total = stats.blocks * stats.bsize;
    const used = total - free;
    return {
      total: `${(total / 1024 / 1024 / 1024).toFixed(2)}GB`,
      used: `${(used / 1024 / 1024 / 1024).toFixed(2)}GB`,
      free: `${(free / 1024 / 1024 / 1024).toFixed(2)}GB`,
      used_percentage: `${((used / total) * 100).toFixed(2)}%`,
    };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export default defineEventHandler(async () => {
  const [dbStatus, redisStatus, queues, memory, disk] = await Promise.all([
    getDbStatus(),
    getRedisStatus(),
    getQueueStatus(),
    getMemoryUsage(),
    getDiskSpace(),
  ]);

  const overallStatus =
    dbStatus.status === 'ok' && redisStatus.status === 'ok'
      ? 'healthy'
      : 'unhealthy';
  const packageJson = JSON.parse(await readFile('./package.json', 'utf-8'));

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: packageJson.version || 'unknown',
    // Grab the package version from package.json
    git_commit: packageJson.version || 'unknown',
    checks: {
      database: dbStatus,
      redis: redisStatus,
      queues,
      memory,
      disk,
    },
  };
});


import { defineEventHandler } from 'h3';
import { database } from '../helpers/database';
import { cache } from '../helpers/cache';
import { promisify } from 'util';
import { exec } from 'child_process';
import { statfs, readFile } from 'fs/promises';
import { Queue } from 'bullmq';
import { env } from '../helpers/env';

const execAsync = promisify(exec);

async function getGitCommitHash() {
  try {
    const { stdout } = await execAsync('git rev-parse --short HEAD');
    return stdout.trim();
  } catch (error) {
    console.error('Error getting git commit hash:', error);
    return 'unknown';
  }
}

async function getDbStatus() {
  const startTime = Date.now();
  try {
    await database.sql`SELECT 1`;
    const latency = Date.now() - startTime;
    return { status: 'ok', latency: `${latency}ms` };
  } catch (error) {
    console.error('Error checking database status:', error);
    const latency = Date.now() - startTime;
    return { status: 'error', latency: `${latency}ms`, error: "Connection failed" };
  }
}

async function getRedisStatus() {
  const startTime = Date.now();
  try {
    await cache.get('healthcheck');
    const latency = Date.now() - startTime;
    return { status: 'ok', latency: `${latency}ms` };
  } catch (error) {
    console.error('Error checking Redis status:', error);
    const latency = Date.now() - startTime;
    return { status: 'error', latency: `${latency}ms`, error: "Connection failed" };
  }
}

async function getQueueStatus() {
    const REDIS_CONFIG = {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD,
        db: 0,
    };

    const queueNames = ['alliance', 'character', 'corporation', 'killmail', 'price'];
    const status: Record<string, { waiting: number; active: number; failed: number }> = {};

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
        } catch (error) {
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
            used_percentage: `${((used / total) * 100).toFixed(2)}%`
        }
    } catch (error) {
        return { error: (error as Error).message };
    }
}


export default defineEventHandler(async () => {
    const [
        dbStatus,
        redisStatus,
        queues,
        memory,
        disk,
        commitHash,
    ] = await Promise.all([
        getDbStatus(),
        getRedisStatus(),
        getQueueStatus(),
        getMemoryUsage(),
        getDiskSpace(),
        getGitCommitHash(),
    ]);

    const overallStatus = dbStatus.status === 'ok' && redisStatus.status === 'ok' ? 'healthy' : 'unhealthy';
    const packageJson = JSON.parse(await readFile('./package.json', 'utf-8'));

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: packageJson.version || 'unknown',
    git_commit: commitHash,
    checks: {
      database: dbStatus,
      redis: redisStatus,
      queues,
      memory,
      disk,
    },
  };
});

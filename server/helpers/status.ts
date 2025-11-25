import { Queue } from 'bullmq';
import { database } from './database';
import { createRedisClient } from './redis';
import { QueueType } from './queue';
import { env } from './env';
import { logger } from './logger';

export interface DatabaseStats {
  tables: Array<{ name: string; count: number; size: string }>;
  recentKillmails24h: number;
  activeConnections: number;
  databaseSize: string;
  killmailsRelatedSize: string;
}

export interface QueueStats {
  [key: string]: {
    active: number;
    waiting: number;
    prioritized: number;
    completed: number;
    failed: number;
    delayed: number;
  };
}

export interface RedisStats {
  connected: boolean;
  usedMemory: string;
  keys: number;
  uptime: number;
}

export interface WebSocketStats {
  connectedClients: number;
  available: boolean;
}

export interface SystemStats {
  uptimeSeconds: number;
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
}

export interface StatusSnapshot {
  timestamp: string;
  database: DatabaseStats;
  queues: QueueStats;
  redis: RedisStats;
  websocket: WebSocketStats;
  system: SystemStats;
}

const TABLES_TO_CHECK = [
  'killmails',
  'characters',
  'corporations',
  'alliances',
  'attackers',
  'items',
  'prices',
  'types',
  'solarsystems',
];

async function fetchDatabaseStats(): Promise<DatabaseStats> {
  try {
    const tableStats = await Promise.all(
      TABLES_TO_CHECK.map(async (tableName) => {
        const countResult = await database.findOne<{ count: number }>(
          `SELECT COALESCE(reltuples::bigint, 0) as count 
           FROM pg_class 
           WHERE relname = :tableName`,
          { tableName }
        );

        const sizeResult = await database.findOne<{ size: string }>(
          `SELECT pg_size_pretty(SUM(pg_total_relation_size(quote_ident(tablename)))) as size
           FROM pg_tables 
           WHERE schemaname = 'public' 
             AND (tablename = :tableName OR tablename LIKE :partitionPattern)`,
          { tableName, partitionPattern: `${tableName}\\_%` }
        );

        return {
          name: tableName,
          count: Number(countResult?.count) || 0,
          size: sizeResult?.size || '0 bytes',
        };
      })
    );

    tableStats.sort((a, b) => b.count - a.count);

    const [recentKillmails, activeConns, dbSizeResult, kmRelatedSize] =
      await Promise.all([
        database.findOne<{ count: number }>(
          `SELECT COUNT(*) as count FROM killmails WHERE "killmailTime" > NOW() - INTERVAL '24 hours'`
        ),
        database.findOne<{ count: number }>(
          "SELECT COUNT(*) as count FROM pg_stat_activity WHERE state = 'active'"
        ),
        database.findOne<{ size: string }>(
          'SELECT pg_size_pretty(pg_database_size(current_database())) as size'
        ),
        database.findOne<{ size: string }>(
          `SELECT pg_size_pretty(SUM(pg_total_relation_size(quote_ident(tablename)))) as size
           FROM pg_tables 
           WHERE schemaname = 'public' 
             AND (tablename LIKE 'killmails%' OR tablename LIKE 'attackers%' OR tablename LIKE 'items%')`
        ),
      ]);

    return {
      tables: tableStats,
      recentKillmails24h: Number(recentKillmails?.count) || 0,
      activeConnections: Number(activeConns?.count) || 0,
      databaseSize: dbSizeResult?.size || 'N/A',
      killmailsRelatedSize: kmRelatedSize?.size || 'N/A',
    };
  } catch (error) {
    logger.error('status: failed to fetch database stats', { error });
    return {
      tables: [],
      recentKillmails24h: 0,
      activeConnections: 0,
      databaseSize: 'N/A',
      killmailsRelatedSize: 'N/A',
    };
  }
}

async function fetchQueueStats(): Promise<QueueStats> {
  const stats: QueueStats = {};
  const queues: Queue[] = [];

  try {
    const queueTypes = Object.values(QueueType);
    for (const queueType of queueTypes) {
      const queue = new Queue(queueType, {
        connection: {
          host: env.REDIS_HOST,
          port: env.REDIS_PORT,
          password: env.REDIS_PASSWORD,
        },
      });
      queues.push(queue);

      const counts = await queue.getJobCounts(
        'active',
        'waiting',
        'completed',
        'failed',
        'delayed',
        'prioritized'
      );

      stats[queueType] = {
        active: counts.active || 0,
        waiting: counts.waiting || 0,
        prioritized: counts.prioritized || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
      };
    }
  } catch (error) {
    logger.error('status: failed to fetch queue stats', { error });
  } finally {
    await Promise.all(queues.map((q) => q.close().catch(() => {})));
  }

  return stats;
}

async function fetchRedisStats(): Promise<RedisStats> {
  let redis = null;
  try {
    redis = createRedisClient();

    const [info, serverInfo, dbInfo] = await Promise.all([
      redis.info('memory'),
      redis.info('server'),
      redis.info('keyspace'),
    ]);

    const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
    const usedMemory = memoryMatch ? memoryMatch[1] : 'N/A';

    const uptimeMatch = serverInfo.match(/uptime_in_seconds:(\d+)/);
    const uptime = uptimeMatch ? Number.parseInt(uptimeMatch[1]) : 0;

    const keysMatch = dbInfo.match(/keys=(\d+)/);
    const keys = keysMatch ? Number.parseInt(keysMatch[1]) : 0;

    await redis.quit();

    return {
      connected: true,
      usedMemory,
      keys,
      uptime,
    };
  } catch (error) {
    logger.error('status: failed to fetch redis stats', { error });
    if (redis) {
      try {
        await redis.quit();
      } catch {
        // ignore
      }
    }
    return {
      connected: false,
      usedMemory: 'N/A',
      keys: 0,
      uptime: 0,
    };
  }
}

async function fetchWebSocketStats(): Promise<WebSocketStats> {
  let redis = null;
  try {
    redis = createRedisClient();
    const statsJson = await redis.get('ws:stats');
    await redis.quit();

    if (statsJson) {
      const stats = JSON.parse(statsJson);
      const age = Date.now() - stats.timestamp;
      if (age < 15000) {
        return {
          connectedClients: stats.connectedClients || 0,
          available: true,
        };
      }
    }

    return { connectedClients: 0, available: false };
  } catch (error) {
    logger.error('status: failed to fetch websocket stats', { error });
    if (redis) {
      try {
        await redis.quit();
      } catch {
        // ignore
      }
    }
    return { connectedClients: 0, available: false };
  }
}

async function fetchSystemStats(): Promise<SystemStats> {
  const memUsage = process.memoryUsage();
  return {
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssMb: Number((memUsage.rss / 1024 / 1024).toFixed(1)),
      heapUsedMb: Number((memUsage.heapUsed / 1024 / 1024).toFixed(1)),
      heapTotalMb: Number((memUsage.heapTotal / 1024 / 1024).toFixed(1)),
    },
  };
}

export async function collectStatusSnapshot(): Promise<StatusSnapshot> {
  const [databaseStats, queueStats, redisStats, websocketStats, systemStats] =
    await Promise.all([
      fetchDatabaseStats(),
      fetchQueueStats(),
      fetchRedisStats(),
      fetchWebSocketStats(),
      fetchSystemStats(),
    ]);

  return {
    timestamp: new Date().toISOString(),
    database: databaseStats,
    queues: queueStats,
    redis: redisStats,
    websocket: websocketStats,
    system: systemStats,
  };
}

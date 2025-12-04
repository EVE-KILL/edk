import { Queue } from 'bullmq';
import { database } from './database';
import { createRedisClient } from './redis';
import { QueueType } from './queue';
import { logger } from './logger';

export interface TablePartition {
  name: string;
  count: number;
  size: string;
  sizeBytes: number;
}

export interface GroupedTable {
  name: string;
  count: number;
  size: string;
  sizeBytes: number;
  isPartitioned: boolean;
  partitions?: TablePartition[];
  partitionCount?: number;
}

export interface DatabaseStats {
  tables: Array<{ name: string; count: number; size: string }>;
  groupedTables: GroupedTable[];
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

async function fetchDatabaseStats(): Promise<DatabaseStats> {
  try {
    // Get all tables with row counts and sizes using pg_class statistics
    // This uses relpages (approximate) which is much faster than pg_total_relation_size()
    // but still gives us real disk usage estimates
    const sql = database.sql;

    const allTablesData = await sql<
      Array<{
        tablename: string;
        row_count: string;
        size_bytes: string;
      }>
    >`
      SELECT
        t.tablename,
        COALESCE(c.reltuples::bigint, 0)::text as row_count,
        COALESCE((c.relpages::bigint * 8192), 0)::text as size_bytes
      FROM pg_tables t
      LEFT JOIN pg_class c ON c.relname = t.tablename
      WHERE t.schemaname = 'public'
      ORDER BY t.tablename
    `;

    // Helper function to format bytes to human-readable size
    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 bytes';
      const k = 1024;
      const sizes = ['bytes', 'kB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
    };

    // Build flat table stats (for backward compatibility)
    const tableStats = allTablesData.map((t) => ({
      name: t.tablename,
      count: parseInt(t.row_count, 10) || 0,
      size: formatBytes(parseInt(t.size_bytes, 10) || 0),
    }));

    // Group tables by base name (separate partitions from base tables)
    type TableData = {
      tablename: string;
      row_count: number;
      size_bytes: number;
    };

    const tableGroups = new Map<
      string,
      {
        base: TableData | null;
        partitions: TableData[];
      }
    >();

    for (const table of allTablesData) {
      const parsedTable: TableData = {
        tablename: table.tablename,
        row_count: parseInt(table.row_count, 10) || 0,
        size_bytes: parseInt(table.size_bytes, 10) || 0,
      };

      // Check if this is a partition
      // Matches: tablename_2024, tablename_2024_12, tablename_2024_pre_12
      const partitionMatch = table.tablename.match(
        /^(.+?)_(\d{4})(?:_(?:pre_)?(\d{2}))?$/
      );

      if (partitionMatch) {
        const baseName = partitionMatch[1];
        // This is a partition (has a year suffix)
        if (!tableGroups.has(baseName)) {
          tableGroups.set(baseName, { base: null, partitions: [] });
        }
        tableGroups.get(baseName)!.partitions.push(parsedTable);
      } else {
        // This is a base table
        if (!tableGroups.has(table.tablename)) {
          tableGroups.set(table.tablename, {
            base: parsedTable,
            partitions: [],
          });
        } else {
          tableGroups.get(table.tablename)!.base = parsedTable;
        }
      }
    }

    // Build grouped tables structure
    const groupedTables: GroupedTable[] = [];

    for (const [baseName, group] of tableGroups.entries()) {
      if (group.partitions.length > 0) {
        // This table has partitions - sum partition stats
        const totalCount = group.partitions.reduce(
          (sum, p) => sum + (p.row_count || 0),
          0
        );
        const totalBytes =
          (group.base?.size_bytes || 0) +
          group.partitions.reduce((sum, p) => sum + (p.size_bytes || 0), 0);

        groupedTables.push({
          name: baseName,
          count: totalCount,
          size: formatBytes(totalBytes),
          sizeBytes: totalBytes,
          isPartitioned: true,
          partitionCount: group.partitions.length,
          partitions: group.partitions
            .map((p) => ({
              name: p.tablename,
              count: p.row_count,
              size: formatBytes(p.size_bytes),
              sizeBytes: p.size_bytes,
            }))
            .sort((a, b) => b.sizeBytes - a.sizeBytes),
        });
      } else if (group.base) {
        // Regular table without partitions
        groupedTables.push({
          name: group.base.tablename,
          count: group.base.row_count,
          size: formatBytes(group.base.size_bytes),
          sizeBytes: group.base.size_bytes,
          isPartitioned: false,
        });
      }
    }

    // Sort grouped tables by size descending
    groupedTables.sort((a, b) => b.sizeBytes - a.sizeBytes);
    tableStats.sort((a, b) => b.count - a.count);

    // Get current and previous month partition names for 24h estimate
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? year - 1 : year;
    const prevMonthStr = String(prevMonth).padStart(2, '0');

    // Use partition reltuples for fast 24h estimate (assume uniform distribution)
    const currentPartition = `killmails_${year}_${month}`;
    const prevPartition = `killmails_${prevYear}_${prevMonthStr}`;

    const [recentKillmailsEstimate, activeConns, dbSizeResult] =
      await Promise.all([
        // Estimate based on partition row counts (much faster than COUNT(*))
        database.findOne<{ estimate: number }>(
          `SELECT
            COALESCE(
              (SELECT reltuples FROM pg_class WHERE relname = '${currentPartition}'), 0
            ) * 0.033 + -- ~1/30th of current month
            COALESCE(
              (SELECT reltuples FROM pg_class WHERE relname = '${prevPartition}'), 0
            ) * 0.033 -- ~1/30th of previous month for overlap
            as estimate`
        ),
        database.findOne<{ count: number }>(
          "SELECT COUNT(*) as count FROM pg_stat_activity WHERE state = 'active'"
        ),
        database.findOne<{ size: string }>(
          'SELECT pg_size_pretty(pg_database_size(current_database())) as size'
        ),
      ]);

    // Calculate killmail-related size from grouped tables (actual disk usage from relpages)
    const kmTables = groupedTables.filter(
      (t) =>
        t.name.startsWith('killmails') ||
        t.name.startsWith('attackers') ||
        t.name.startsWith('items')
    );
    const kmRelatedBytes = kmTables.reduce((sum, t) => sum + t.sizeBytes, 0);

    return {
      tables: tableStats,
      groupedTables,
      recentKillmails24h: Math.round(
        Number(recentKillmailsEstimate?.estimate) || 0
      ),
      activeConnections: Number(activeConns?.count) || 0,
      databaseSize: dbSizeResult?.size || 'N/A',
      killmailsRelatedSize: formatBytes(kmRelatedBytes),
    };
  } catch (error) {
    logger.error('status: failed to fetch database stats', { error });
    return {
      tables: [],
      groupedTables: [],
      recentKillmails24h: 0,
      activeConnections: 0,
      databaseSize: 'N/A',
      killmailsRelatedSize: 'N/A',
    };
  }
}

async function fetchQueueStats(redisClient: any): Promise<QueueStats> {
  const stats: QueueStats = {};
  const queues: Queue[] = [];

  try {
    const queueTypes = Object.values(QueueType);

    // Create all queue instances upfront
    for (const queueType of queueTypes) {
      const queue = new Queue(queueType, {
        connection: redisClient, // Reuse the passed Redis client
      });
      queues.push(queue);
    }

    // Fetch all counts in parallel for better performance
    const countsPromises = queues.map((queue) =>
      queue.getJobCounts(
        'active',
        'waiting',
        'completed',
        'failed',
        'delayed',
        'prioritized'
      )
    );

    const allCounts = await Promise.all(countsPromises);

    // Map results back to queue types
    queueTypes.forEach((queueType, index) => {
      const counts = allCounts[index];
      stats[queueType] = {
        active: counts.active || 0,
        waiting: counts.waiting || 0,
        prioritized: counts.prioritized || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
      };
    });
  } catch (error) {
    logger.error('status: failed to fetch queue stats', { error });
  } finally {
    await Promise.all(queues.map((q) => q.close().catch(() => {})));
  }

  return stats;
}

async function fetchRedisStats(redisClient: any): Promise<RedisStats> {
  try {
    const [info, serverInfo, dbInfo] = await Promise.all([
      redisClient.info('memory'),
      redisClient.info('server'),
      redisClient.info('keyspace'),
    ]);

    const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
    const usedMemory = memoryMatch ? memoryMatch[1] : 'N/A';

    const uptimeMatch = serverInfo.match(/uptime_in_seconds:(\d+)/);
    const uptime = uptimeMatch ? Number.parseInt(uptimeMatch[1]) : 0;

    const keysMatch = dbInfo.match(/keys=(\d+)/);
    const keys = keysMatch ? Number.parseInt(keysMatch[1]) : 0;

    return {
      connected: true,
      usedMemory,
      keys,
      uptime,
    };
  } catch (error) {
    logger.error('status: failed to fetch redis stats', { error });
    return {
      connected: false,
      usedMemory: 'N/A',
      keys: 0,
      uptime: 0,
    };
  }
}

async function fetchWebSocketStats(redisClient: any): Promise<WebSocketStats> {
  try {
    const statsJson = await redisClient.get('ws:stats');

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
  // Create a single Redis client for this status check request
  const redisClient = createRedisClient();

  try {
    const [databaseStats, queueStats, redisStats, websocketStats, systemStats] =
      await Promise.all([
        fetchDatabaseStats(),
        fetchQueueStats(redisClient),
        fetchRedisStats(redisClient),
        fetchWebSocketStats(redisClient),
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
  } finally {
    // Ensure the Redis client is closed after all stats are collected
    await redisClient.quit().catch(() => {});
  }
}

import chalk from 'chalk';
import { database } from '../server/helpers/database';
import { getRedis } from '../server/helpers/redis';
import { QueueType, getQueueStats, getAllQueues } from '../server/helpers/queue';
import { logger } from '../server/helpers/logger';
import { registry } from '../server/helpers/metrics';

/**
 * EDK Stats Dashboard Command
 * 
 * Displays a live dashboard with key metrics:
 * - Database stats (tables, connections, size)
 * - Queue stats (all queue types)
 * - WebSocket stats (if available)
 * - Redis stats
 * - System metrics from Prometheus
 * 
 * Usage:
 *   bun cli stats              # Show stats once
 *   bun cli stats --watch      # Live updating dashboard
 *   bun cli stats --interval 5 # Custom update interval (seconds)
 */
export default {
  description: 'Display live EDK system statistics dashboard',
  
  options: [
    {
      flags: '-w, --watch',
      description: 'Enable live updating dashboard (updates every 2 seconds)',
    },
    {
      flags: '-i, --interval <seconds>',
      description: 'Update interval in seconds (default: 2, requires --watch)',
    },
  ],

  action: async (options: any) => {
    const dashboard = new StatsDashboard();
    await dashboard.run(options);
  },
};

interface DatabaseStats {
  totalKillmails: number;
  totalCharacters: number;
  totalCorporations: number;
  totalAlliances: number;
  totalAttackers: number;
  totalItems: number;
  recentKillmails24h: number;
  activeConnections: number;
  databaseSize: string;
  killmailsTableSize: string;
}

interface QueueStats {
  [key: string]: {
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
  };
}

interface RedisStats {
  connected: boolean;
  usedMemory: string;
  keys: number;
  uptime: number;
}

class StatsDashboard {
  private running = false;
  private updateInterval: NodeJS.Timeout | null = null;

  async run(options: any): Promise<void> {
    const watch = options.watch || false;
    const interval = Number.parseInt(options.interval) || 2;

    if (watch) {
      this.running = true;
      console.log(chalk.blue.bold('📊 EDK Stats Dashboard - Live Mode'));
      console.log(chalk.dim(`Updating every ${interval} seconds. Press Ctrl+C to exit.\n`));

      // Handle graceful shutdown
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());

      // Update loop
      while (this.running) {
        await this.displayStats();
        await this.sleep(interval * 1000);
      }
    } else {
      console.log(chalk.blue.bold('📊 EDK Stats Dashboard - Snapshot\n'));
      await this.displayStats();
    }
  }

  private async displayStats(): Promise<void> {
    try {
      // Clear console in watch mode
      if (this.running) {
        console.clear();
        console.log(chalk.blue.bold('📊 EDK Stats Dashboard - Live Mode'));
        console.log(chalk.dim(`Updated: ${new Date().toLocaleString()}\n`));
      }

      // Fetch all stats in parallel
      const [dbStats, queueStats, redisStats] = await Promise.all([
        this.getDatabaseStats(),
        this.getQueueStats(),
        this.getRedisStats(),
      ]);

      // Display sections
      this.displayDatabaseStats(dbStats);
      this.displayQueueStats(queueStats);
      this.displayRedisStats(redisStats);
      this.displayPrometheusMetrics();

    } catch (error) {
      logger.error('Failed to fetch stats', { error });
      console.log(chalk.red(`\n❌ Error fetching stats: ${error}`));
    }
  }

  private async getDatabaseStats(): Promise<DatabaseStats> {
    const sql = database.sql;

    // Get table counts
    const [killmails, characters, corporations, alliances, attackers, items] = await Promise.all([
      database.queryValue<number>('SELECT COUNT(*) FROM killmails'),
      database.queryValue<number>('SELECT COUNT(*) FROM characters'),
      database.queryValue<number>('SELECT COUNT(*) FROM corporations'),
      database.queryValue<number>('SELECT COUNT(*) FROM alliances'),
      database.queryValue<number>('SELECT COUNT(*) FROM attackers'),
      database.queryValue<number>('SELECT COUNT(*) FROM items'),
    ]);

    // Get recent killmails (last 24 hours)
    const recentKillmails = await database.queryValue<number>(
      `SELECT COUNT(*) FROM killmails WHERE "killmailTime" > NOW() - INTERVAL '24 hours'`
    );

    // Get active connections
    const activeConns = await database.queryValue<number>(
      'SELECT COUNT(*) FROM pg_stat_activity WHERE state = \'active\''
    );

    // Get database size
    const dbSizeResult = await database.findOne<{ size: string }>(
      'SELECT pg_size_pretty(pg_database_size(current_database())) as size'
    );

    // Get killmails table size
    const kmTableSizeResult = await database.findOne<{ size: string }>(
      'SELECT pg_size_pretty(pg_total_relation_size(\'killmails\')) as size'
    );

    return {
      totalKillmails: killmails || 0,
      totalCharacters: characters || 0,
      totalCorporations: corporations || 0,
      totalAlliances: alliances || 0,
      totalAttackers: attackers || 0,
      totalItems: items || 0,
      recentKillmails24h: recentKillmails || 0,
      activeConnections: activeConns || 0,
      databaseSize: dbSizeResult?.size || 'N/A',
      killmailsTableSize: kmTableSizeResult?.size || 'N/A',
    };
  }

  private async getQueueStats(): Promise<QueueStats> {
    const stats: QueueStats = {};

    try {
      // Get stats for all queue types
      const queueTypes = Object.values(QueueType);
      
      await Promise.all(
        queueTypes.map(async (queueType) => {
          try {
            const queueStats = await getQueueStats(queueType);
            stats[queueType] = queueStats;
          } catch (error) {
            // Queue might not exist yet, that's ok
            stats[queueType] = {
              active: 0,
              waiting: 0,
              completed: 0,
              failed: 0,
              delayed: 0,
            };
          }
        })
      );
    } catch (error) {
      logger.error('Failed to fetch queue stats', { error });
    }

    return stats;
  }

  private async getRedisStats(): Promise<RedisStats> {
    try {
      const redis = getRedis();
      
      // Get Redis INFO
      const info = await redis.info('memory');
      const serverInfo = await redis.info('server');
      
      // Parse used memory
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const usedMemory = memoryMatch ? memoryMatch[1] : 'N/A';
      
      // Parse uptime
      const uptimeMatch = serverInfo.match(/uptime_in_seconds:(\d+)/);
      const uptime = uptimeMatch ? Number.parseInt(uptimeMatch[1]) : 0;

      // Get key count (approximate)
      const dbInfo = await redis.info('keyspace');
      const keysMatch = dbInfo.match(/keys=(\d+)/);
      const keys = keysMatch ? Number.parseInt(keysMatch[1]) : 0;

      return {
        connected: true,
        usedMemory,
        keys,
        uptime,
      };
    } catch (error) {
      return {
        connected: false,
        usedMemory: 'N/A',
        keys: 0,
        uptime: 0,
      };
    }
  }

  private displayDatabaseStats(stats: DatabaseStats): void {
    console.log(chalk.cyan.bold('━━━ DATABASE ━━━'));
    console.log(chalk.white('  Storage:'));
    console.log(`    Total Size:      ${chalk.yellow(stats.databaseSize)}`);
    console.log(`    Killmails Table: ${chalk.yellow(stats.killmailsTableSize)}`);
    console.log(chalk.white('  Counts:'));
    console.log(`    Killmails:       ${chalk.green(stats.totalKillmails.toLocaleString())}`);
    console.log(`    Characters:      ${chalk.green(stats.totalCharacters.toLocaleString())}`);
    console.log(`    Corporations:    ${chalk.green(stats.totalCorporations.toLocaleString())}`);
    console.log(`    Alliances:       ${chalk.green(stats.totalAlliances.toLocaleString())}`);
    console.log(`    Attackers:       ${chalk.green(stats.totalAttackers.toLocaleString())}`);
    console.log(`    Items:           ${chalk.green(stats.totalItems.toLocaleString())}`);
    console.log(chalk.white('  Activity:'));
    console.log(`    Last 24h:        ${chalk.magenta(stats.recentKillmails24h.toLocaleString())} killmails`);
    console.log(`    Active Conns:    ${chalk.blue(stats.activeConnections.toString())}`);
    console.log('');
  }

  private displayQueueStats(stats: QueueStats): void {
    console.log(chalk.cyan.bold('━━━ QUEUES ━━━'));
    
    const queueOrder = [
      QueueType.KILLMAIL,
      QueueType.CHARACTER,
      QueueType.CORPORATION,
      QueueType.ALLIANCE,
      QueueType.PRICE,
    ];

    for (const queueType of queueOrder) {
      if (stats[queueType]) {
        const s = stats[queueType];
        const total = s.active + s.waiting + s.delayed;
        const statusColor = total > 0 ? chalk.yellow : chalk.gray;
        
        console.log(chalk.white(`  ${queueType.toUpperCase()}:`));
        console.log(`    Active:    ${statusColor(s.active.toLocaleString())}`);
        console.log(`    Waiting:   ${statusColor(s.waiting.toLocaleString())}`);
        console.log(`    Delayed:   ${chalk.gray(s.delayed.toLocaleString())}`);
        console.log(`    Completed: ${chalk.green(s.completed.toLocaleString())}`);
        console.log(`    Failed:    ${s.failed > 0 ? chalk.red(s.failed.toLocaleString()) : chalk.gray('0')}`);
      }
    }
    console.log('');
  }

  private displayRedisStats(stats: RedisStats): void {
    console.log(chalk.cyan.bold('━━━ REDIS ━━━'));
    
    if (stats.connected) {
      console.log(`  Status:      ${chalk.green('✓ Connected')}`);
      console.log(`  Memory:      ${chalk.yellow(stats.usedMemory)}`);
      console.log(`  Keys:        ${chalk.blue(stats.keys.toLocaleString())}`);
      console.log(`  Uptime:      ${chalk.white(this.formatUptime(stats.uptime))}`);
    } else {
      console.log(`  Status:      ${chalk.red('✗ Disconnected')}`);
    }
    console.log('');
  }

  private displayPrometheusMetrics(): void {
    try {
      // Get Prometheus metrics (these are synchronously available)
      const metrics = registry.getSingleMetric('http_requests_total');
      const dbMetrics = registry.getSingleMetric('database_active_connections');

      console.log(chalk.cyan.bold('━━━ PROMETHEUS METRICS ━━━'));
      
      if (metrics) {
        console.log(chalk.white('  HTTP Requests: Available'));
      }
      
      if (dbMetrics) {
        console.log(chalk.white('  DB Metrics: Available'));
      }
      
      console.log(chalk.dim(`  Full metrics: GET /metrics`));
      console.log('');
    } catch (error) {
      // Silently ignore if metrics aren't available
    }
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  private shutdown(): void {
    console.log(chalk.yellow('\n\n👋 Shutting down stats dashboard...'));
    this.running = false;
    if (this.updateInterval) {
      clearTimeout(this.updateInterval);
    }
    process.exit(0);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

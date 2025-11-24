import chalk from 'chalk';
import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { Queue } from 'bullmq';
import { database } from '../server/helpers/database';
import { createRedisClient } from '../server/helpers/redis';
import { QueueType, getAllQueues } from '../server/helpers/queue';
import { logger } from '../server/helpers/logger';
import { registry } from '../server/helpers/metrics';
import { env } from '../server/helpers/env';

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
      flags: '--snapshot',
      description: 'Show single snapshot instead of live TUI',
    },
    {
      flags: '-i, --interval <seconds>',
      description: 'Update interval in seconds (default: 5)',
    },
  ],

  action: async (options: any) => {
    const dashboard = new StatsDashboard();
    await dashboard.run(options);
  },
};

interface DatabaseStats {
  tables: Array<{ name: string; count: number; size: string }>;
  recentKillmails24h: number;
  activeConnections: number;
  databaseSize: string;
  killmailsRelatedSize: string;
}

interface QueueStats {
  [key: string]: {
    active: number;
    waiting: number;
    prioritized: number;
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

interface WebSocketStats {
  connectedClients: number;
  available: boolean;
}

class StatsDashboard {
  private running = false;
  private updateInterval: NodeJS.Timeout | null = null;
  private screen: any = null;
  private widgets: any = {};
  private previousQueueStats: QueueStats | null = null;

  async run(options: any): Promise<void> {
    const snapshot = options.snapshot || false;
    const interval = Number.parseInt(options.interval) || 5;

    if (snapshot) {
      console.log(chalk.blue.bold('📊 EDK Stats Dashboard - Snapshot\n'));
      await this.displayStats();
    } else {
      await this.runTUI(interval);
    }
  }

  private async runTUI(interval: number): Promise<void> {
    this.running = true;
    
    // Create blessed screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'EDK Stats Dashboard',
    });

    // Create grid layout
    const grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

    // Create widgets
    this.createWidgets(grid);

    // Handle quit
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.shutdown();
    });

    // Initial render
    this.screen.render();

    // Update loop
    while (this.running) {
      await this.updateTUI();
      this.screen.render();
      await this.sleep(interval * 1000);
    }
  }

  private createWidgets(grid: any): void {
    // Header box
    this.widgets.header = grid.set(0, 0, 1, 12, blessed.box, {
      content: '{center}📊 EDK Stats Dashboard - Live Mode{/center}',
      tags: true,
      style: {
        fg: 'cyan',
        bold: true,
        border: { fg: 'cyan' },
      },
    });

    // Database Stats - Top Left
    this.widgets.dbCounts = grid.set(1, 0, 4, 4, blessed.box, {
      label: ' Database Counts ',
      tags: true,
      border: { type: 'line' },
      style: {
        fg: 'white',
        border: { fg: 'cyan' },
      },
    });

    // Database Storage - Top Middle
    this.widgets.dbStorage = grid.set(1, 4, 4, 4, blessed.box, {
      label: ' Database Storage ',
      tags: true,
      border: { type: 'line' },
      style: {
        fg: 'white',
        border: { fg: 'cyan' },
      },
    });

    // Database Activity - Top Right
    this.widgets.dbActivity = grid.set(1, 8, 4, 4, blessed.box, {
      label: ' Database Activity ',
      tags: true,
      border: { type: 'line' },
      style: {
        fg: 'white',
        border: { fg: 'cyan' },
      },
    });

    // Queue Stats - Middle section (takes full width)
    this.widgets.queues = grid.set(5, 0, 4, 12, blessed.box, {
      label: ' Queue Statistics ',
      tags: true,
      border: { type: 'line' },
      style: {
        fg: 'white',
        border: { fg: 'cyan' },
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: '█',
        style: { fg: 'cyan' },
      },
    });

    // Redis Stats - Bottom Left
    this.widgets.redis = grid.set(9, 0, 3, 6, blessed.box, {
      label: ' Redis ',
      tags: true,
      border: { type: 'line' },
      style: {
        fg: 'white',
        border: { fg: 'cyan' },
      },
    });

    // System Info - Bottom Right
    this.widgets.system = grid.set(9, 6, 3, 6, blessed.box, {
      label: ' System ',
      tags: true,
      border: { type: 'line' },
      style: {
        fg: 'white',
        border: { fg: 'cyan' },
      },
    });
  }

  private async updateTUI(): Promise<void> {
    try {
      // Fetch all stats
      const [dbStats, queueStats, redisStats, wsStats] = await Promise.all([
        this.getDatabaseStats(),
        this.getQueueStats(),
        this.getRedisStats(),
        this.getWebSocketStats(),
      ]);

      // Update header with timestamp
      const timestamp = new Date().toLocaleString();
      this.widgets.header.setContent(`{center}📊 EDK Stats Dashboard - ${timestamp}{/center}`);

      // Update database counts (show top 6 by count)
      let countsContent = '';
      for (let i = 0; i < Math.min(6, dbStats.tables.length); i++) {
        const table = dbStats.tables[i];
        const name = table.name.charAt(0).toUpperCase() + table.name.slice(1);
        countsContent += `  {green-fg}${name.padEnd(14)}{/} ${table.count.toLocaleString().padStart(10)} {gray-fg}(${table.size}){/}\n`;
      }
      this.widgets.dbCounts.setContent(countsContent);

      // Update database storage
      this.widgets.dbStorage.setContent(
        `  {yellow-fg}Total Database:{/}\n` +
        `  ${dbStats.databaseSize}\n\n` +
        `  {yellow-fg}Killmail Tables:{/}\n` +
        `  {gray-fg}(km+attackers+items){/}\n` +
        `  ${dbStats.killmailsRelatedSize}\n\n` +
        `  {yellow-fg}Entity Tables:{/}\n` +
        dbStats.tables.filter(t => ['characters', 'corporations', 'alliances'].includes(t.name))
          .map(t => `  {gray-fg}${t.name}:{/} ${t.size}`)
          .join('\n')
      );

      // Update database activity
      this.widgets.dbActivity.setContent(
        `  {magenta-fg}Last 24h:{/}\n` +
        `  ${dbStats.recentKillmails24h.toLocaleString()} killmails\n\n` +
        `  {blue-fg}Active Connections:{/}\n` +
        `  ${dbStats.activeConnections}`
      );

      // Update queue stats
      const queueContent = this.formatQueueStats(queueStats);
      this.widgets.queues.setContent(queueContent);

      // Update Redis stats
      if (redisStats.connected) {
        this.widgets.redis.setContent(
          `  {green-fg}Status:{/} Connected\n\n` +
          `  {yellow-fg}Memory:{/} ${redisStats.usedMemory}\n` +
          `  {blue-fg}Keys:{/} ${redisStats.keys.toLocaleString()}\n` +
          `  {white-fg}Uptime:{/} ${this.formatUptime(redisStats.uptime)}`
        );
      } else {
        this.widgets.redis.setContent(`  {red-fg}Status:{/} Disconnected`);
      }

      // Update system info with WebSocket stats
      const memUsage = process.memoryUsage();
      let systemContent = `  {cyan-fg}System:{/}\n`;
      systemContent += `  RSS: ${(memUsage.rss / 1024 / 1024).toFixed(0)} MB\n`;
      systemContent += `  Heap: ${(memUsage.heapUsed / 1024 / 1024).toFixed(0)}/${(memUsage.heapTotal / 1024 / 1024).toFixed(0)} MB\n\n`;
      
      if (wsStats.available) {
        systemContent += `  {cyan-fg}WebSocket:{/}\n`;
        systemContent += `  Clients: ${wsStats.connectedClients}\n\n`;
      } else {
        systemContent += `  {gray-fg}WebSocket: Not running{/}\n\n`;
      }
      
      systemContent += `  {gray-fg}Press 'q' or ESC{/}`;
      this.widgets.system.setContent(systemContent);

    } catch (error) {
      if (this.widgets.header) {
        this.widgets.header.setContent('{center}{red-fg}⚠ Error fetching stats{/}{/center}');
      }
    }
  }

  private formatQueueStats(stats: QueueStats): string {
    const queueOrder = [
      QueueType.KILLMAIL,
      QueueType.CHARACTER,
      QueueType.CORPORATION,
      QueueType.ALLIANCE,
      QueueType.PRICE,
    ];

    let content = '';

    // Header row - aligned with data columns (each column is 18 chars: 10 for number + 8 for delta)
    content += '  {bold}Queue{/}            {bold}Active{/}            {bold}Waiting{/}           {bold}Prioritized{/}       {bold}Completed{/}         {bold}Failed{/}\n';
    content += '  ' + '─'.repeat(110) + '\n';

    for (const queueType of queueOrder) {
      if (stats[queueType]) {
        const s = stats[queueType];
        const prev = this.previousQueueStats?.[queueType];
        
        const name = queueType.toUpperCase().padEnd(12);
        
        // Format numbers with deltas - EXACTLY 18 chars total per column
        const formatWithDelta = (current: number, previous: number | undefined, color: string = 'yellow'): string => {
          // Number part: 10 chars
          const numStr = current.toLocaleString().padStart(10);
          
          if (previous === undefined) {
            const coloredNum = current > 0 ? `{${color}-fg}${numStr}{/}` : `{gray-fg}${numStr}{/}`;
            return coloredNum + '        '; // 8 spaces for delta
          }
          
          const delta = current - previous;
          if (delta > 0) {
            const deltaStr = `+${Math.abs(delta).toLocaleString()}`.padStart(8);
            return `{${color}-fg}${numStr}{/}{green-fg}${deltaStr}{/}`;
          } else if (delta < 0) {
            const deltaStr = `-${Math.abs(delta).toLocaleString()}`.padStart(8);
            return `{${color}-fg}${numStr}{/}{red-fg}${deltaStr}{/}`;
          }
          const coloredNum = current > 0 ? `{${color}-fg}${numStr}{/}` : `{gray-fg}${numStr}{/}`;
          return coloredNum + '        '; // 8 spaces when no change
        };
        
        const active = formatWithDelta(s.active, prev?.active);
        const waiting = formatWithDelta(s.waiting, prev?.waiting);
        const prioritized = formatWithDelta(s.prioritized, prev?.prioritized, 'magenta');
        const completed = formatWithDelta(s.completed, prev?.completed, 'green');
        const failed = formatWithDelta(s.failed, prev?.failed, 'red');
        
        content += `  ${name} ${active} ${waiting} ${prioritized} ${completed} ${failed}\n`;
      }
    }

    // Store current stats for next comparison
    this.previousQueueStats = JSON.parse(JSON.stringify(stats));

    return content;
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
      const [dbStats, queueStats, redisStats, wsStats] = await Promise.all([
        this.getDatabaseStats(),
        this.getQueueStats(),
        this.getRedisStats(),
        this.getWebSocketStats(),
      ]);

      // Display sections
      this.displayDatabaseStats(dbStats);
      this.displayQueueStats(queueStats);
      this.displayRedisStats(redisStats);
      this.displayWebSocketStats(wsStats);
      this.displayPrometheusMetrics();

    } catch (error) {
      logger.error('Failed to fetch stats', { error });
      console.log(chalk.red(`\n❌ Error fetching stats: ${error}`));
    }
  }

  private async getDatabaseStats(): Promise<DatabaseStats> {
    const sql = database.sql;

    // Get table counts and sizes for key tables (including partitions)
    const tablesToCheck = [
      'killmails', 'characters', 'corporations', 'alliances', 
      'attackers', 'items', 'prices', 'types', 'solarsystems'
    ];

    const tableStats = await Promise.all(
      tablesToCheck.map(async (tableName) => {
        // Use approximate count from pg_class.reltuples (MUCH faster)
        const countResult = await database.findOne<{ count: number }>(
          `SELECT COALESCE(reltuples::bigint, 0) as count 
           FROM pg_class 
           WHERE relname = :tableName`,
          { tableName }
        );
        
        // Get size including all partitions
        const sizeResult = await database.findOne<{ size: string }>(
          `SELECT pg_size_pretty(SUM(pg_total_relation_size(quote_ident(tablename)))) as size
           FROM pg_tables 
           WHERE schemaname = 'public' 
           AND (tablename = '${tableName}' OR tablename LIKE '${tableName}\\_%')`
        );
        
        return {
          name: tableName,
          count: Number(countResult?.count) || 0,
          size: sizeResult?.size || '0 bytes'
        };
      })
    );

    // Sort by count descending
    tableStats.sort((a, b) => b.count - a.count);

    // Get recent killmails (last 24 hours) - use exact count since it's filtered
    const recentKillmails = await database.findOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM killmails WHERE "killmailTime" > NOW() - INTERVAL '24 hours'`
    );

    // Get active connections
    const activeConns = await database.findOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM pg_stat_activity WHERE state = \'active\''
    );

    // Get database size
    const dbSizeResult = await database.findOne<{ size: string }>(
      'SELECT pg_size_pretty(pg_database_size(current_database())) as size'
    );

    // Get combined killmails related tables size (including all partitions)
    const kmRelatedSize = await database.findOne<{ size: string }>(
      `SELECT pg_size_pretty(SUM(pg_total_relation_size(quote_ident(tablename)))) as size
       FROM pg_tables 
       WHERE schemaname = 'public' 
       AND (tablename LIKE 'killmails%' OR tablename LIKE 'attackers%' OR tablename LIKE 'items%')`
    );

    return {
      tables: tableStats,
      recentKillmails24h: Number(recentKillmails?.count) || 0,
      activeConnections: Number(activeConns?.count) || 0,
      databaseSize: dbSizeResult?.size || 'N/A',
      killmailsRelatedSize: kmRelatedSize?.size || 'N/A',
    };
  }

  private async getQueueStats(): Promise<QueueStats> {
    const stats: QueueStats = {};
    const queues: Queue[] = [];

    try {
      const queueTypes = Object.values(QueueType);
      
      // Create Queue instances and get stats from BullMQ directly
      for (const queueType of queueTypes) {
        try {
          const queue = new Queue(queueType, {
            connection: {
              host: env.REDIS_HOST,
              port: env.REDIS_PORT,
              password: env.REDIS_PASSWORD,
            }
          });
          queues.push(queue);
          
          // Use BullMQ's getJobCounts method (includes prioritized!)
          const counts = await queue.getJobCounts();
          
          stats[queueType] = {
            active: counts.active || 0,
            waiting: counts.waiting || 0,
            prioritized: counts.prioritized || 0,
            completed: counts.completed || 0,
            failed: counts.failed || 0,
            delayed: counts.delayed || 0,
          };
        } catch (error) {
          stats[queueType] = {
            active: 0,
            waiting: 0,
            prioritized: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
          };
        }
      }
      
      // Close all queue connections
      await Promise.all(queues.map(q => q.close()));
    } catch (error) {
      // Clean up any open queues
      await Promise.all(queues.map(q => q.close().catch(() => {})));
      logger.error('Failed to fetch queue stats', { error });
    }

    return stats;
  }

  private async getRedisStats(): Promise<RedisStats> {
    let redis = null;
    try {
      redis = createRedisClient();
      
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

      await redis.quit();

      return {
        connected: true,
        usedMemory,
        keys,
        uptime,
      };
    } catch (error) {
      if (redis) {
        try {
          await redis.quit();
        } catch {}
      }
      return {
        connected: false,
        usedMemory: 'N/A',
        keys: 0,
        uptime: 0,
      };
    }
  }

  private async getWebSocketStats(): Promise<WebSocketStats> {
    let redis = null;
    try {
      redis = createRedisClient();
      
      // Check for stats in Redis (updated by WS server every 10s)
      const statsJson = await redis.get('ws:stats');
      await redis.quit();
      
      if (statsJson) {
        const stats = JSON.parse(statsJson);
        // Check if stats are recent (within 15 seconds)
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
      if (redis) {
        try {
          await redis.quit();
        } catch {}
      }
      return { connectedClients: 0, available: false };
    }
  }

  private displayDatabaseStats(stats: DatabaseStats): void {
    console.log(chalk.cyan.bold('━━━ DATABASE ━━━'));
    console.log(chalk.white('  Storage:'));
    console.log(`    Total Size:           ${chalk.yellow(stats.databaseSize)}`);
    console.log(`    Killmail Tables:      ${chalk.yellow(stats.killmailsRelatedSize)} ${chalk.dim('(km+attackers+items)')}`);
    console.log(chalk.white('  Counts (Top Tables):'));
    for (const table of stats.tables.slice(0, 6)) {
      const name = table.name.charAt(0).toUpperCase() + table.name.slice(1);
      console.log(`    ${name.padEnd(16)} ${chalk.green(table.count.toLocaleString().padStart(10))} ${chalk.dim(`(${table.size})`)}`);
    }
    console.log(chalk.white('  Activity:'));
    console.log(`    Last 24h:             ${chalk.magenta(stats.recentKillmails24h.toLocaleString())} killmails`);
    console.log(`    Active Connections:   ${chalk.blue(stats.activeConnections.toString())}`);
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
        const total = s.active + s.waiting + s.prioritized;
        const statusColor = total > 0 ? chalk.yellow : chalk.gray;
        
        console.log(chalk.white(`  ${queueType.toUpperCase()}:`));
        console.log(`    Active:       ${statusColor(s.active.toLocaleString())}`);
        console.log(`    Waiting:      ${statusColor(s.waiting.toLocaleString())}`);
        console.log(`    Prioritized:  ${chalk.magenta(s.prioritized.toLocaleString())}`);
        console.log(`    Completed:    ${chalk.green(s.completed.toLocaleString())}`);
        console.log(`    Failed:       ${s.failed > 0 ? chalk.red(s.failed.toLocaleString()) : chalk.gray('0')}`);
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

  private displayWebSocketStats(stats: WebSocketStats): void {
    console.log(chalk.cyan.bold('━━━ WEBSOCKET ━━━'));
    
    if (stats.available) {
      console.log(`  Status:      ${chalk.green('✓ Running')}`);
      console.log(`  Clients:     ${chalk.blue(stats.connectedClients.toString())}`);
    } else {
      console.log(`  Status:      ${chalk.gray('Not running')}`);
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
      
      console.log(chalk.gray(`  Full metrics: GET /metrics`));
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
    this.running = false;
    if (this.updateInterval) {
      clearTimeout(this.updateInterval);
    }
    if (this.screen) {
      this.screen.destroy();
    }
    process.exit(0);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

import chalk from 'chalk';
import blessed from 'blessed';
import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';

/**
 * EDK Database Top Command
 * 
 * Displays real-time database statistics:
 * - Currently running queries
 * - Connection stats
 * - Database size and activity
 * - Slow queries
 * - Lock information
 * 
 * Usage:
 *   bun cli db:top              # Live updating dashboard
 *   bun cli db:top --interval 2 # Custom update interval (seconds)
 */
export default {
  description: 'Display live database statistics and running queries',
  
  options: [
    {
      flags: '-i, --interval <seconds>',
      description: 'Update interval in seconds (default: 2)',
    },
  ],

  action: async (options: any) => {
    const dashboard = new DatabaseTopDashboard();
    await dashboard.run(options);
  },
};

interface QueryInfo {
  pid: number;
  duration: string;
  state: string;
  query: string;
  appName: string;
  clientAddr: string;
}

interface ConnectionStats {
  total: number;
  active: number;
  idle: number;
  idleInTransaction: number;
  waiting: number;
}

interface DatabaseInfo {
  size: string;
  connections: ConnectionStats;
  recentKillmails: number;
  transactionsPerSecond: number;
  cacheHitRatio: number;
}

class DatabaseTopDashboard {
  private running = false;
  private screen: any = null;
  private widgets: any = {};

  async run(options: any): Promise<void> {
    const interval = Number.parseInt(options.interval) || 2;
    await this.runTUI(interval);
  }

  private async runTUI(interval: number): Promise<void> {
    this.running = true;
    
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'EDK Database Top',
    });

    this.createWidgets();

    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.shutdown();
    });

    this.screen.render();

    while (this.running) {
      await this.updateTUI();
      this.screen.render();
      await this.sleep(interval * 1000);
    }
  }

  private createWidgets(): void {
    // Header
    this.widgets.header = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '{center}🗄️  EDK Database Top - Live Mode{/center}',
      tags: true,
      style: {
        fg: 'cyan',
        bold: true,
      },
    });

    // Database Info - Top section (3 lines)
    this.widgets.dbInfo = blessed.box({
      top: 1,
      left: 0,
      width: '100%',
      height: 3,
      border: { type: 'line' },
      label: ' Database Info ',
      tags: true,
      style: {
        fg: 'white',
        border: { fg: 'cyan' },
      },
    });

    // Connection Stats - Next section (5 lines)
    this.widgets.connections = blessed.box({
      top: 4,
      left: 0,
      width: '100%',
      height: 5,
      border: { type: 'line' },
      label: ' Connections ',
      tags: true,
      style: {
        fg: 'white',
        border: { fg: 'cyan' },
      },
    });

    // Running Queries - Takes remaining space
    this.widgets.queries = blessed.box({
      top: 9,
      left: 0,
      width: '100%',
      height: '100%-10',
      border: { type: 'line' },
      label: ' Running Queries ',
      tags: true,
      style: {
        fg: 'white',
        border: { fg: 'cyan' },
      },
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      vi: true,
      mouse: true,
      scrollbar: {
        ch: '█',
        style: { fg: 'cyan' },
      },
    });

    // Footer
    this.widgets.footer = blessed.box({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '{center}{gray-fg}Press \'q\' or ESC to exit | Arrow keys to scroll{/}{/center}',
      tags: true,
      style: {
        fg: 'white',
      },
    });

    this.screen.append(this.widgets.header);
    this.screen.append(this.widgets.dbInfo);
    this.screen.append(this.widgets.connections);
    this.screen.append(this.widgets.queries);
    this.screen.append(this.widgets.footer);
  }

  private async updateTUI(): Promise<void> {
    try {
      const [dbInfo, queries] = await Promise.all([
        this.getDatabaseInfo(),
        this.getRunningQueries(),
      ]);

      const timestamp = new Date().toLocaleString();
      this.widgets.header.setContent(`{center}🗄️  EDK Database Top - ${timestamp}{/center}`);

      // Update database info
      this.widgets.dbInfo.setContent(
        `  {yellow-fg}Size:{/} ${dbInfo.size}  ` +
        `{cyan-fg}Cache Hit:{/} ${dbInfo.cacheHitRatio.toFixed(1)}%  ` +
        `{magenta-fg}Recent KMs (24h):{/} ${dbInfo.recentKillmails.toLocaleString()}`
      );

      // Update connection stats
      const conn = dbInfo.connections;
      const connColor = (val: number, warn: number, danger: number) => {
        if (val >= danger) return 'red';
        if (val >= warn) return 'yellow';
        return 'green';
      };
      
      this.widgets.connections.setContent(
        `  {white-fg}Total:{/} {${connColor(conn.total, 50, 80)}-fg}${conn.total}{/}  ` +
        `{green-fg}Active:{/} {${connColor(conn.active, 20, 40)}-fg}${conn.active}{/}  ` +
        `{blue-fg}Idle:{/} ${conn.idle}  ` +
        `{yellow-fg}Idle in Txn:{/} ${conn.idleInTransaction}` +
        (conn.waiting > 0 ? `  {red-fg}Waiting:{/} ${conn.waiting}` : '')
      );

      // Update running queries
      let queriesContent = '';
      if (queries.length === 0) {
        queriesContent = '\n  {gray-fg}No active queries{/}';
      } else {
        for (const q of queries) {
          const stateColor = q.state === 'active' ? 'green' : 'yellow';
          const durationColor = this.getDurationColor(q.duration);
          
          queriesContent += `  {${stateColor}-fg}●{/} `;
          queriesContent += `{white-fg}PID ${q.pid}{/} `;
          queriesContent += `{${durationColor}-fg}[${q.duration}]{/} `;
          queriesContent += `{gray-fg}${q.appName}{/}`;
          if (q.clientAddr) {
            queriesContent += ` {dim}(${q.clientAddr}){/}`;
          }
          queriesContent += '\n';
          
          // Format query - truncate if too long, remove newlines
          const cleanQuery = q.query.replace(/\s+/g, ' ').trim();
          const maxLen = 120;
          const displayQuery = cleanQuery.length > maxLen 
            ? cleanQuery.substring(0, maxLen) + '...' 
            : cleanQuery;
          
          queriesContent += `    {cyan-fg}${displayQuery}{/}\n\n`;
        }
      }
      this.widgets.queries.setContent(queriesContent);

    } catch (error) {
      if (this.widgets.header) {
        this.widgets.header.setContent('{center}{red-fg}⚠ Error fetching database stats{/}{/center}');
      }
      logger.error('Failed to update database top', { 
        error, 
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined 
      });
    }
  }

  private getDurationColor(duration: string): string {
    const match = duration.match(/^(\d+):(\d+):(\d+)/);
    if (!match) return 'white';
    
    const hours = Number.parseInt(match[1]);
    const minutes = Number.parseInt(match[2]);
    const seconds = Number.parseInt(match[3]);
    
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    
    if (totalSeconds > 60) return 'red';
    if (totalSeconds > 10) return 'yellow';
    return 'green';
  }

  private async getDatabaseInfo(): Promise<DatabaseInfo> {
    const [sizeResult, connStats, recentKMs, stats] = await Promise.all([
      database.query<{ size: string }>(
        'SELECT pg_size_pretty(pg_database_size(current_database())) as size'
      ),
      this.getConnectionStats(),
      database.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM killmails WHERE "killmailTime" > NOW() - INTERVAL '24 hours'`
      ),
      database.query<{ 
        blks_hit: string;
        blks_read: string;
      }>(
        'SELECT sum(blks_hit) as blks_hit, sum(blks_read) as blks_read FROM pg_stat_database WHERE datname = current_database()'
      ),
    ]);

    const blksHit = Number.parseFloat(stats[0]?.blks_hit || '0');
    const blksRead = Number.parseFloat(stats[0]?.blks_read || '0');
    const cacheHitRatio = blksHit + blksRead > 0 
      ? (blksHit / (blksHit + blksRead)) * 100 
      : 0;

    return {
      size: sizeResult[0]?.size || 'N/A',
      connections: connStats,
      recentKillmails: Number(recentKMs[0]?.count) || 0,
      transactionsPerSecond: 0,
      cacheHitRatio,
    };
  }

  private async getConnectionStats(): Promise<ConnectionStats> {
    const result = await database.query<{
      total: string;
      active: string;
      idle: string;
      idle_in_transaction: string;
      waiting: string;
    }>(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE state = 'active') as active,
        COUNT(*) FILTER (WHERE state = 'idle') as idle,
        COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
        COUNT(*) FILTER (WHERE wait_event_type IS NOT NULL) as waiting
      FROM pg_stat_activity 
      WHERE datname = current_database()`
    );

    return {
      total: Number(result[0]?.total) || 0,
      active: Number(result[0]?.active) || 0,
      idle: Number(result[0]?.idle) || 0,
      idleInTransaction: Number(result[0]?.idle_in_transaction) || 0,
      waiting: Number(result[0]?.waiting) || 0,
    };
  }

  private async getRunningQueries(): Promise<QueryInfo[]> {
    const results = await database.query<{
      pid: number;
      duration: string;
      state: string;
      query: string;
      application_name: string;
      client_addr: string;
    }>(
      `SELECT 
        pid,
        COALESCE(clock_timestamp() - query_start, interval '0') as duration,
        state,
        query,
        application_name,
        client_addr::text
      FROM pg_stat_activity 
      WHERE datname = current_database()
        AND pid != pg_backend_pid()
        AND state != 'idle'
        AND query NOT ILIKE '%pg_stat_activity%'
      ORDER BY duration DESC
      LIMIT 50`
    );

    return results.map(r => ({
      pid: r.pid,
      duration: this.formatInterval(r.duration),
      state: r.state,
      query: r.query,
      appName: r.application_name || 'unknown',
      clientAddr: r.client_addr || '',
    }));
  }

  private formatInterval(interval: string): string {
    const match = interval.match(/(\d+):(\d+):(\d+)\.(\d+)/);
    if (!match) return interval;
    
    const hours = Number.parseInt(match[1]);
    const minutes = Number.parseInt(match[2]);
    const seconds = Number.parseInt(match[3]);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private shutdown(): void {
    this.running = false;
    if (this.screen) {
      this.screen.destroy();
    }
    process.exit(0);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

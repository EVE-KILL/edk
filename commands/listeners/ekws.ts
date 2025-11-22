import { enqueueJob } from '../server/helpers/queue';
import { QueueType } from '../server/helpers/queue';
import { killmailExists } from '../server/models/killmails';
import chalk from 'chalk';
import { logger } from '../server/helpers/logger';

/**
 * EVE-KILL WebSocket Listener Command
 *
 * Connects to EVE-KILL's WebSocket stream for real-time killmails.
 * When a killmail is received:
 * 1. Check if it already exists in database
 * 2. If new, enqueue it for processing
 * 3. Killmail queue worker will fetch all entity/price data then store it
 *
 * Usage:
 *   bun cli ekws
 */
export default {
  description: 'Listen to EVE-KILL WebSocket for real-time killmails',

  options: [
    {
      flags: '--filter <entities>',
      description:
        'Filter by entity IDs (format: character:123,corporation:456)',
    },
  ],

  action: async (options: any) => {
    const listener = new EkwsListener();
    await listener.execute(options);
  },
};

class EkwsListener {
  private readonly WS_URL = 'wss://ws.eve-kill.com/killmails';
  private running = false;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly RECONNECT_DELAY = 5000; // 5 seconds

  private stats = {
    received: 0,
    new: 0,
    duplicate: 0,
    processed: 0,
    pings: 0,
    errors: 0,
  };

  private followedEntities: Map<string, Set<number>> = new Map();
  private filteringEnabled = false;

  constructor() {
    // Initialize entity filters
    this.followedEntities.set('character', new Set());
    this.followedEntities.set('corporation', new Set());
    this.followedEntities.set('alliance', new Set());
  }

  async execute(options: any): Promise<void> {
    // Parse filter if provided
    if (options.filter) {
      this.parseFilter(options.filter);
    }

    this.log(chalk.blue.bold('🚀 Starting EVE-KILL WebSocket listener'));
    this.log(`📡 WebSocket URL: ${chalk.cyan(this.WS_URL)}`);

    if (this.filteringEnabled) {
      this.log(chalk.yellow('🔍 Filtering enabled for followed entities:'));
      for (const [type, ids] of this.followedEntities) {
        if (ids.size > 0) {
          this.log(`   ${type}s: ${chalk.green(Array.from(ids).join(', '))}`);
        }
      }
    } else {
      this.log(chalk.cyan('📡 No filtering - importing all killmails'));
    }

    this.log(chalk.dim('Press Ctrl+C to stop'));

    // Handle graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());

    this.running = true;
    await this.connect();
  }

  /**
   * Parse filter string
   */
  private parseFilter(filterStr: string): void {
    const parts = filterStr.split(',');
    for (const part of parts) {
      const [type, id] = part.split(':');
      if (type && id) {
        const numId = Number.parseInt(id);
        if (!Number.isNaN(numId)) {
          if (this.followedEntities.has(type)) {
            this.followedEntities.get(type)!.add(numId);
            this.filteringEnabled = true;
          }
        }
      }
    }
  }

  /**
   * Connect to WebSocket with automatic reconnection
   */
  private async connect(): Promise<void> {
    while (this.running) {
      try {
        await this.connectWebSocket();
      } catch (error) {
        this.stats.errors++;
        this.error(`WebSocket error: ${error}`);

        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
          this.reconnectAttempts++;
          this.log(
            chalk.yellow(
              `🔄 Reconnecting (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`
            )
          );
          await this.sleep(this.RECONNECT_DELAY);
        } else {
          this.error('Max reconnection attempts reached. Giving up.');
          this.running = false;
          break;
        }
      }
    }
  }

  /**
   * Establish WebSocket connection and listen for messages
   */
  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.WS_URL);

        this.ws.onopen = () => {
          this.success('Connected to EVE-KILL WebSocket');
          this.reconnectAttempts = 0;

          // Send subscription message
          this.ws!.send('all');
          this.log(chalk.cyan('📡 Subscribed to "all" killmails'));
        };

        this.ws.onmessage = (event) => {
          try {
            this.handleMessage(event.data);
          } catch (error) {
            this.error(`Error handling message: ${error}`);
            this.stats.errors++;
          }
        };

        this.ws.onerror = (event) => {
          this.error(`WebSocket error: ${event}`);
          reject(new Error('WebSocket error'));
        };

        this.ws.onclose = () => {
          this.log(chalk.gray('🔌 WebSocket disconnected'));
          resolve();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'info':
          this.log(chalk.blue(`ℹ️  ${message.message}`));
          if (
            message.data?.validTopics &&
            Array.isArray(message.data.validTopics)
          ) {
            this.log(
              `   Valid topics: ${chalk.cyan(message.data.validTopics.join(', '))}`
            );
          }
          break;

        case 'subscribed':
          this.success(
            `Subscribed to topics: ${chalk.green(message.data?.topics?.join(', '))}`
          );
          break;

        case 'ping':
          this.stats.pings++;
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'pong' }));
          }
          break;

        case 'killmail':
          this.processKillmailNotification(message.data);
          this.printStats();
          break;

        default:
          this.log(`Unknown message type: ${chalk.yellow(message.type)}`);
      }
    } catch (error) {
      this.error(`Failed to parse message: ${error}`);
      this.error(`Raw data: ${data.substring(0, 200)}...`);
    }
  }

  /**
   * Process a killmail notification from WebSocket
   */
  private async processKillmailNotification(data: any): Promise<void> {
    const killmail = data?.killmail;

    if (!killmail) {
      this.error(`⚠️  Invalid killmail data (no killmail object)`);
      return;
    }

    const killmailId = killmail.killmail_id;
    const hash = killmail.killmail_hash;

    if (!killmailId || !hash) {
      this.error(
        `⚠️  Invalid killmail (missing ID or hash): ${JSON.stringify(killmail).substring(0, 100)}...`
      );
      return;
    }

    // Filter killmail if filtering is enabled
    if (this.filteringEnabled && !this.isRelevantKillmail(killmail)) {
      return;
    }

    // Check if killmail already exists
    try {
      const existing = await killmailExists(killmailId);

      if (existing) {
        this.stats.duplicate++;
        return;
      }
    } catch (error) {
      this.error(`Failed to check if killmail exists: ${error}`);
      this.stats.errors++;
      return;
    }

    this.stats.received++;
    this.stats.new++;

    // Fetch complete killmail data
    await this.fetchAndProcessKillmail(killmailId, hash);
  }

  /**
   * Fetch complete killmail from ESI API and process it
   */
  private async fetchAndProcessKillmail(
    killmailId: number,
    hash: string
  ): Promise<void> {
    try {
      // Enqueue killmail for processing
      // The killmail queue worker will:
      // 1. Fetch killmail from ESI
      // 2. Fetch all entity data (characters, corporations, alliances)
      // 3. Fetch all price data
      // 4. Store killmail (materialized view will have complete data)
      await enqueueJob(QueueType.KILLMAIL, { killmailId, hash });

      this.stats.processed++;
      this.success(`Enqueued killmail ${killmailId} for processing`);
    } catch (error) {
      this.error(`Failed to enqueue killmail ${killmailId}: ${error}`);
      this.stats.errors++;
    }
  }

  /**
   * Check if a killmail involves any followed entities
   */
  private isRelevantKillmail(killmail: any): boolean {
    const victim = killmail.victim;

    // Check victim
    if (victim) {
      if (
        this.followedEntities.get('character')?.has(victim.character_id) ||
        this.followedEntities.get('corporation')?.has(victim.corporation_id) ||
        (victim.alliance_id &&
          this.followedEntities.get('alliance')?.has(victim.alliance_id))
      ) {
        return true;
      }
    }

    // Check attackers
    const attackers = killmail.attackers || [];
    for (const attacker of attackers) {
      if (
        this.followedEntities.get('character')?.has(attacker.character_id) ||
        this.followedEntities
          .get('corporation')
          ?.has(attacker.corporation_id) ||
        (attacker.alliance_id &&
          this.followedEntities.get('alliance')?.has(attacker.alliance_id))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Print statistics
   */
  private printStats(): void {
    if (this.stats.received % 25 === 0) {
      this.log('');
      logger.info('Stats (every 25 killmails):', {
        received: this.stats.received,
        new: this.stats.new,
        duplicate: this.stats.duplicate,
        enqueued: this.stats.processed, // Changed: now counts enqueued jobs
        pings: this.stats.pings,
        errors: this.stats.errors,
      });
      this.log('');
    }
  }

  /**
   * Graceful shutdown
   */
  private shutdown(): void {
    this.log('');
    logger.warn('Shutting down EVE-KILL WebSocket listener...');
    this.running = false;

    // Close WebSocket connection
    if (this.ws) {
      this.ws.close();
    }

    // Print final stats
    this.log('');
    logger.info('Final Stats:', {
      received: this.stats.received,
      new: this.stats.new,
      duplicate: this.stats.duplicate,
      processed: this.stats.processed,
      pings: this.stats.pings,
      errors: this.stats.errors,
    });

    process.exit(0);
  }

  /**
   * Utility methods
   */
  private log(message: string): void {
    console.log(message);
  }

  private error(message: string): void {
    logger.error(message);
  }

  private success(message: string): void {
    logger.success(message);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

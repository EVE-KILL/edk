import { enqueueJob } from '../server/helpers/queue';
import { QueueType } from '../server/helpers/queue';
import { killmailExists } from '../server/models/killmails';
import chalk from 'chalk';
import { logger } from '../server/helpers/logger';
import Redis from 'ioredis';

/**
 * RedisQ Killmail Importer Command
 *
 * Connects to a Redis list and listens for killmail packages from zKillboard's redisq.
 * When a killmail is received:
 * 1. Check if it already exists in the database.
 * 2. If new, enqueue it for processing.
 *
 * Usage:
 *   bun cli redisq
 */
export default {
  description: 'Listen to a Redis list for killmail packages',

  action: async () => {
    const importer = new RedisQImporter();
    await importer.execute();
  }
};

class RedisQImporter {
  private running = false;
  private redis: Redis;

  private stats = {
    received: 0,
    new: 0,
    duplicate: 0,
    processed: 0,
    errors: 0
  };

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0
    });
  }

  async execute(): Promise<void> {
    this.log(chalk.blue.bold('🚀 Starting RedisQ killmail importer'));
    this.log(`📡 Redis Host: ${chalk.cyan(this.redis.options.host)}`);

    this.log(chalk.dim('Press Ctrl+C to stop'));

    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());

    this.running = true;
    this.listen();
  }

  private async listen(): Promise<void> {
    while (this.running) {
      try {
        const data = await this.redis.blpop('zkillboard:killmail', 0);
        if (data && data[1]) {
          this.processKillmailPackage(JSON.parse(data[1]));
        }
      } catch (error) {
        this.error(`Error during blpop: ${error}`);
        this.stats.errors++;
        await this.sleep(5000); // Wait 5 seconds before retrying
      }
    }
  }

  private async processKillmailPackage(pkg: any): Promise<void> {
    if (!pkg || !pkg.killmail_id || !pkg.zkb || !pkg.zkb.hash) {
      this.error('Invalid killmail package received');
      return;
    }

    const killmailId = pkg.killmail_id;
    const hash = pkg.zkb.hash;

    this.stats.received++;

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

    this.stats.new++;

    try {
      await enqueueJob(QueueType.KILLMAIL, { killmailId, hash });
      this.stats.processed++;
      this.success(`Enqueued killmail ${killmailId} for processing`);
    } catch (error) {
      this.error(`Failed to enqueue killmail ${killmailId}: ${error}`);
      this.stats.errors++;
    }

    this.printStats();
  }

  private printStats(): void {
    if (this.stats.received % 25 === 0) {
      this.log('');
      logger.info('Stats (every 25 killmails):', { ...this.stats });
      this.log('');
    }
  }

  private shutdown(): void {
    this.log('');
    logger.warn('Shutting down RedisQ importer...');
    this.running = false;
    this.redis.disconnect();

    this.log('');
    logger.info('Final Stats:', { ...this.stats });
    process.exit(0);
  }

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

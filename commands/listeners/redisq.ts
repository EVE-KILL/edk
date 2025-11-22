import chalk from 'chalk';
import { enqueueJob } from '../../server/helpers/queue';
import { QueueType } from '../../server/helpers/queue';
import { killmailExists } from '../../server/models/killmails';
import { logger } from '../../server/helpers/logger';

/**
 * RedisQ Killmail Importer Command
 *
 * Connects to zKillboard's RedisQ HTTP stream and listens for killmail packages.
 * When a killmail is received:
 * 1. Check if it already exists in the database.
 * 2. If new, enqueue it for processing.
 *
 * Usage:
 *   bun cli redisq
 */
export default {
  description: 'Listen to zKillboard RedisQ for killmails',

  action: async () => {
    const importer = new RedisQImporter();
    await importer.execute();
  },
};

class RedisQImporter {
  private running = false;
  private readonly queueUrl: string;

  private stats = {
    received: 0,
    new: 0,
    duplicate: 0,
    processed: 0,
    errors: 0,
  };

  constructor() {
    if (!process.env.REDISQ_ID) {
      throw new Error('REDISQ_ID environment variable is not set.');
    }
    this.queueUrl = `https://zkillredisq.stream/listen.php?queueID=${process.env.REDISQ_ID}`;
  }

  async execute(): Promise<void> {
    this.log(chalk.blue.bold('🚀 Starting RedisQ killmail importer'));
    this.log(`📡 Listening to URL: ${chalk.cyan(this.queueUrl)}`);

    this.log(chalk.dim('Press Ctrl+C to stop'));

    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());

    this.running = true;
    this.poll();
  }

  private async poll(): Promise<void> {
    while (this.running) {
      try {
        const response = await fetch(this.queueUrl, {
          headers: { 'User-Agent': 'EVE-KILL' },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data && data.package) {
          this.processKillmailPackage(data.package);
        }
      } catch (error) {
        this.error(`Error fetching from RedisQ: ${error}`);
        this.stats.errors++;
        // Wait 5 seconds before retrying on error
        await this.sleep(5000);
      }
    }
  }

  private async processKillmailPackage(pkg: any): Promise<void> {
    // Note: The original example used killID, but the zKillboard documentation shows killmail_id
    const killmailId = pkg?.killmail_id || pkg?.killID;

    if (!pkg || !killmailId || !pkg.zkb || !pkg.zkb.hash) {
      this.error(
        `Invalid killmail package received: ${JSON.stringify(pkg).substring(0, 200)}`
      );
      return;
    }

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
    if (this.stats.received % 25 === 0 && this.stats.received > 0) {
      this.log('');
      logger.info('Stats (every 25 killmails):', { ...this.stats });
      this.log('');
    }
  }

  private shutdown(): void {
    this.log('');
    logger.warn('Shutting down RedisQ importer...');
    this.running = false;

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

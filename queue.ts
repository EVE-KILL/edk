import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'bullmq';
import chalk from 'chalk';
import { env } from './server/helpers/env';

/**
 * Queue Runner - Main Entry Point
 *
 * Auto-discovers and loads queue processors from ./queue directory
 * Starts all workers or a specific worker based on CLI argument
 *
 * Usage:
 *   bun queue                    # Start all queues
 *   bun queue character          # Start only character queue
 *   bun queue character --limit 5  # Process only 5 jobs then exit
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const QUEUE_DIR = join(__dirname, 'queue');

const REDIS_CONFIG = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || 'redis_password',
  db: 0,
};

interface QueueModule {
  name: string;
  processor: (job: any) => Promise<void>;
  createWorker: (connection?: any, options?: { concurrency?: number }) => Worker;
}

interface QueueOptions {
  limit?: number;
}

/**
 * Load queue modules from directory
 */
async function loadQueueModules(): Promise<Map<string, QueueModule>> {
  const queues = new Map<string, QueueModule>();

  try {
    const files = readdirSync(QUEUE_DIR).filter(
      (f) => f.endsWith('.ts') && f !== 'queue.ts'
    );

    for (const file of files) {
      const queueName = file.replace('.ts', '');
      const modulePath = join(QUEUE_DIR, file);

      try {
        const module = await import(modulePath);

        if (!module.name || !module.processor || !module.createWorker) {
          console.warn(
            `⚠️  Queue module ${file} missing required exports (name, processor, createWorker)`
          );
          continue;
        }

        queues.set(queueName, module as QueueModule);
        console.log(`✅ Loaded queue: ${chalk.cyan(queueName)}`);
      } catch (error) {
        console.error(`❌ Failed to load queue ${file}:`, error);
      }
    }
  } catch (error) {
    console.error(`❌ Failed to read queue directory:`, error);
  }

  return queues;
}

/**
 * Start queue workers
 */
async function startQueues(
  queueNames?: string[],
  options: QueueOptions = {}
): Promise<Worker[]> {
  const queues = await loadQueueModules();

  if (queues.size === 0) {
    console.error('❌ No queues found');
    process.exit(1);
  }

  const workers: Worker[] = [];
  const jobCounts = new Map<string, number>();

  // If specific queues requested, filter to those
  let queuesToStart = Array.from(queues.keys());
  if (queueNames && queueNames.length > 0) {
    queuesToStart = queuesToStart.filter((q) => queueNames.includes(q));

    if (queuesToStart.length === 0) {
      console.error(`❌ No queues found matching: ${queueNames.join(', ')}`);
      console.error(
        `Available queues: ${Array.from(queues.keys()).join(', ')}`
      );
      process.exit(1);
    }
  }

  console.log('');
  console.log(chalk.blue.bold('🚀 Starting Queue Workers'));
  console.log(chalk.dim(`Queues to start: ${queuesToStart.join(', ')}`));
  if (options.limit) {
    console.log(chalk.dim(`Job limit: ${options.limit} per queue`));
  }
  console.log('');

  // Create and start workers
  for (const queueName of queuesToStart) {
    const module = queues.get(queueName)!;
    jobCounts.set(queueName, 0);

    try {
      // When limit is set, use concurrency=1 to process one at a time
      const worker = options.limit
        ? module.createWorker(REDIS_CONFIG, { concurrency: 1 })
        : module.createWorker(REDIS_CONFIG);

      // Add event listeners
      worker.on('completed', (job, _result) => {
        console.log(`✅ [${queueName}] Job ${job.id} completed`);

        // Track job count if limit is set
        if (options.limit) {
          const count = (jobCounts.get(queueName) || 0) + 1;
          jobCounts.set(queueName, count);

          if (count >= options.limit) {
            console.log(
              chalk.yellow(
                `⏹️  [${queueName}] Reached limit of ${options.limit} jobs, stopping worker...`
              )
            );
            worker.close().then(() => {
              // Check if all workers are done
              const allDone = workers.every((w) => w.isRunning() === false);
              if (allDone) {
                console.log(
                  chalk.green('✅ All workers finished processing limited jobs')
                );
                process.exit(0);
              }
            });
          }
        }
      });

      worker.on('failed', (job, error) => {
        console.error(
          `❌ [${queueName}] Job ${job?.id} failed:`,
          error.message
        );

        // Still count failed jobs towards the limit
        if (options.limit) {
          const count = (jobCounts.get(queueName) || 0) + 1;
          jobCounts.set(queueName, count);

          if (count >= options.limit) {
            console.log(
              chalk.yellow(
                `⏹️  [${queueName}] Reached limit of ${options.limit} jobs, stopping worker...`
              )
            );
            worker.close().then(() => {
              // Check if all workers are done
              const allDone = workers.every((w) => w.isRunning() === false);
              if (allDone) {
                console.log(
                  chalk.green('✅ All workers finished processing limited jobs')
                );
                process.exit(0);
              }
            });
          }
        }
      });

      worker.on('error', (error) => {
        console.error(`❌ [${queueName}] Worker error:`, error);
      });

      workers.push(worker);
      console.log(`▶️  Started worker for queue: ${chalk.green(queueName)}`);
    } catch (error) {
      console.error(`❌ Failed to start queue ${queueName}:`, error);
    }
  }

  console.log('');
  console.log(chalk.green(`✅ All ${workers.length} queue worker(s) started`));
  if (!options.limit) {
    console.log(chalk.dim('Press Ctrl+C to stop'));
  }
  console.log('');

  return workers;
}

/**
 * Graceful shutdown
 */
async function shutdown(workers: Worker[]) {
  console.log('');
  console.log(chalk.yellow('⏹️  Shutting down queue workers...'));

  for (const worker of workers) {
    try {
      await worker.close();
    } catch (error) {
      console.error(`Error closing worker:`, error);
    }
  }

  console.log(chalk.green('✅ All workers shut down'));
  process.exit(0);
}

/**
 * Main entry point
 */
async function main() {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  const queueNames: string[] = [];
  const options: QueueOptions = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && i + 1 < args.length) {
      options.limit = parseInt(args[i + 1]);
      i++; // Skip next arg as it's the limit value
    } else if (!args[i].startsWith('--')) {
      queueNames.push(args[i]);
    }
  }

  const workers = await startQueues(
    queueNames.length > 0 ? queueNames : undefined,
    options
  );

  // Handle graceful shutdown
  process.on('SIGINT', () => shutdown(workers));
  process.on('SIGTERM', () => shutdown(workers));

  // Keep process alive
  await new Promise(() => {
    // Process will exit on SIGINT/SIGTERM or when limit is reached
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

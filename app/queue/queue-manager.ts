import { eq, and, lte, lt, asc, sql } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { jobs, type Job } from "../../db/schema/jobs";
import type { BaseWorker } from "../../src/queue/base-worker";
import { logger } from "../../src/utils/logger";

/**
 * Queue Manager - Coordinates job processing across workers
 *
 * Responsibilities:
 * - Register workers for different queues
 * - Poll for available jobs
 * - Atomically claim jobs (preventing duplicate processing)
 * - Execute worker handlers
 * - Handle retries and failures
 * - Graceful shutdown
 */
export class QueueManager {
  private workers: Map<string, BaseWorker> = new Map();
  private running = false;
  private pollingIntervals: NodeJS.Timeout[] = [];
  private activeJobs = 0;

  constructor(private db: BunSQLiteDatabase<any>) {}

  /**
   * Register a worker to process jobs from a specific queue
   *
   * @example
   * ```typescript
   * queueManager.registerWorker(new KillmailProcessor());
   * queueManager.registerWorker(new ESIFetcher());
   * ```
   */
  registerWorker(worker: BaseWorker) {
    if (this.workers.has(worker.queueName)) {
      throw new Error(`Worker for queue "${worker.queueName}" already registered`);
    }

    this.workers.set(worker.queueName, worker);

    // Call optional onRegister hook
    if (worker.onRegister) {
      worker.onRegister();
    }

    logger.queue(`Registered worker: ${worker.queueName} (concurrency: ${worker.concurrency})`);
  }

  /**
   * Start processing jobs for all registered workers
   */
  async start() {
    if (this.running) {
      logger.warn("Queue manager already running");
      return;
    }

    this.running = true;

    for (const [queueName, worker] of this.workers) {
      // Each queue gets its own polling loop
      const interval = setInterval(
        () => this.processQueue(queueName, worker),
        worker.pollInterval
      );

      this.pollingIntervals.push(interval);
    }

    logger.success(`Queue manager started with ${this.workers.size} workers`);
  }

  /**
   * Stop processing jobs and wait for active jobs to finish
   *
   * @param timeout Maximum time to wait for active jobs (ms)
   */
  async stop(timeout = 30000) {
    if (!this.running) {
      return;
    }

    logger.info("🛑 Stopping queue manager...");
    this.running = false;

    // Stop polling for new jobs
    this.pollingIntervals.forEach(clearInterval);
    this.pollingIntervals = [];

    // Wait for in-flight jobs to finish
    await this.waitForActiveJobs(timeout);

    // Call optional onStop hooks
    for (const worker of this.workers.values()) {
      if (worker.onStop) {
        await worker.onStop();
      }
    }

    logger.success("Queue manager stopped");
  }

  /**
   * Get current status of the queue manager
   */
  getStatus() {
    return {
      running: this.running,
      workers: Array.from(this.workers.keys()),
      activeJobs: this.activeJobs,
    };
  }

  /**
   * Process jobs for a specific queue
   * Called repeatedly by the polling interval
   */
  private async processQueue(queueName: string, worker: BaseWorker) {
    if (!this.running) return;

    // Process multiple jobs in parallel (up to worker.concurrency)
    const concurrency = worker.concurrency || 1;
    const promises: Promise<void>[] = [];

    for (let i = 0; i < concurrency; i++) {
      promises.push(this.processNextJob(queueName, worker));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Process a single job from the queue
   * This is where the atomic job claiming happens
   */
  private async processNextJob(queueName: string, worker: BaseWorker) {
    try {
      // Atomically claim a job
      const job = await this.claimJob(queueName);

      if (!job) {
        // No jobs available
        return;
      }

      this.activeJobs++;
      logger.debug(`[${queueName}] Processing job #${job.id} (attempt ${job.attempts}/${job.maxAttempts})`);

      try {
        // Parse payload from JSON
        const payload = typeof job.payload === "string"
          ? JSON.parse(job.payload)
          : job.payload;

        // Execute the worker's handle method
        await worker.handle(payload, job);

        // Mark as completed
        await this.completeJob(job.id);

        logger.debug(`[${queueName}] ✅ Job #${job.id} completed`);
      } catch (error) {
        // Mark as failed (will retry if attempts < maxAttempts)
        await this.failJob(job.id, error);

        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(
          `[${queueName}] Job #${job.id} failed (${job.attempts}/${job.maxAttempts}): ${errorMessage}`
        );
      } finally {
        this.activeJobs--;
      }
    } catch (error) {
      logger.error(`[${queueName}] Error processing job:`, error);
    }
  }  /**
   * Atomically claim the next available job
   *
   * This is the CRITICAL section that prevents race conditions:
   * - Uses UPDATE with WHERE to claim only one job
   * - RETURNING gives us the claimed job
   * - SQLite's SERIALIZABLE isolation ensures only one worker succeeds
   *
   * @returns The claimed job, or null if no jobs available
   */
  private async claimJob(queueName: string): Promise<Job | null> {
    const now = new Date();

    const [job] = await this.db
      .update(jobs)
      .set({
        status: "processing",
        reservedAt: now,
        attempts: sql`${jobs.attempts} + 1`,
      })
      .where(
        and(
          eq(jobs.queue, queueName),
          eq(jobs.status, "pending"),
          lte(jobs.availableAt, now), // Job is available now
          lt(jobs.attempts, jobs.maxAttempts) // Not exhausted retries
        )
      )
      .orderBy(asc(jobs.priority), asc(jobs.id)) // Lower priority first, then FIFO
      .limit(1)
      .returning();

    return job || null;
  }

  /**
   * Mark job as completed
   */
  private async completeJob(jobId: number) {
    await this.db
      .update(jobs)
      .set({
        status: "completed",
        processedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));
  }

  /**
   * Mark job as failed and set up retry logic
   *
   * If job has remaining attempts, it will be retried with exponential backoff.
   * Otherwise, it's marked as permanently failed.
   */
  private async failJob(jobId: number, error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Get current job to check attempts
    const [job] = await this.db
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (!job) return;

    const willRetry = job.attempts < job.maxAttempts;

    if (willRetry) {
      // Retry with exponential backoff: attempt² seconds
      const delaySeconds = job.attempts * job.attempts;
      const availableAt = new Date(Date.now() + delaySeconds * 1000);

      await this.db
        .update(jobs)
        .set({
          status: "pending",
          error: errorMessage,
          availableAt,
        })
        .where(eq(jobs.id, jobId));
    } else {
      // Permanently failed
      await this.db
        .update(jobs)
        .set({
          status: "failed",
          error: errorMessage,
          processedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));
    }
  }

  /**
   * Wait for all active jobs to finish
   * Used during graceful shutdown
   */
  private async waitForActiveJobs(timeout = 30000) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (this.activeJobs === 0) {
        return;
      }

      logger.debug(`⏳ Waiting for ${this.activeJobs} active jobs to finish...`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    logger.warn(`Timeout waiting for ${this.activeJobs} active jobs to finish`);
  }
}

// Create singleton instance and register workers
import { DatabaseConnection } from "../../src/db";
import { KillmailFetcher } from "./killmail-fetcher";
import { ESIFetcher } from "./esi-fetcher";
import { PriceFetcher } from "./price-fetcher";

export const queueManager = new QueueManager(DatabaseConnection.getQueueInstance());

// Register all workers
queueManager.registerWorker(new KillmailFetcher());
queueManager.registerWorker(new ESIFetcher());
queueManager.registerWorker(new PriceFetcher());

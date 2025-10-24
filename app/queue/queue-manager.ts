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
  private activeJobsByQueue = new Map<string, Set<number>>(); // Track active jobs per queue
  private statsInterval?: NodeJS.Timeout;
  private jobsProcessed = 0;
  private lastStatsTime = Date.now();

  constructor(private db: BunSQLiteDatabase<any>) {}

  /**
   * Register a worker to process jobs from a specific queue
   *
   * @example
   * ```typescript
   * queueManager.registerWorker(new KillmailFetcher());
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
   * Setup queue database schema
   * Creates jobs table and indexes if they don't exist
   */
  private async setupQueueDatabase() {
    const { DatabaseConnection } = await import("../../src/db");
    const queueDb = DatabaseConnection.getRawQueueSqlite();

    if (!queueDb) {
      throw new Error("Failed to connect to queue database");
    }

    // Create jobs table (matching Drizzle schema exactly)
    queueDb.run(`
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        queue TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        available_at INTEGER NOT NULL,
        reserved_at INTEGER,
        processed_at INTEGER,
        created_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        error TEXT,
        priority INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Optimized indexes for fast job claiming
    // Primary index: covers all WHERE clauses for job selection
    queueDb.run(`
      CREATE INDEX IF NOT EXISTS idx_job_claim
      ON jobs(queue, status, available_at, attempts, priority, id)
      WHERE status = 'pending'
    `);

    // Secondary index: for cleanup and monitoring queries
    queueDb.run(`
      CREATE INDEX IF NOT EXISTS idx_status_processed
      ON jobs(status, processed_at)
      WHERE status IN ('completed', 'failed')
    `);

    logger.database("Queue database schema initialized");
  }

  /**
   * Start processing jobs for all registered workers
   */
  async start() {
    if (this.running) {
      logger.warn("Queue manager already running");
      return;
    }

    // Ensure queue database is set up
    await this.setupQueueDatabase();

    this.running = true;

    for (const [queueName, worker] of this.workers) {
      // Each queue gets its own polling loop
      const interval = setInterval(
        () => this.processQueue(queueName, worker),
        worker.pollInterval
      );

      this.pollingIntervals.push(interval);
    }

    // Start periodic stats logging (every 30 seconds)
    this.statsInterval = setInterval(() => this.logStats(), 30000);

    logger.success(`Queue manager started with ${this.workers.size} queues`);
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

    this.running = false;

    // Stop polling for new jobs
    this.pollingIntervals.forEach(clearInterval);
    this.pollingIntervals = [];

    // Stop stats logging
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = undefined;
    }

    // Wait for in-flight jobs to finish
    await this.waitForActiveJobs(timeout);

    // Call optional onStop hooks
    for (const worker of this.workers.values()) {
      if (worker.onStop) {
        await worker.onStop();
      }
    }
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

    // Count how many jobs are currently processing for this queue
    const activeCount = this.getActiveJobCount(queueName);
    const concurrency = worker.concurrency || 1;
    const slotsAvailable = concurrency - activeCount;

    // Only start new jobs if we have slots available
    if (slotsAvailable <= 0) {
      return; // All slots full, wait for next poll
    }

    // Use batch claiming if multiple slots available (more efficient)
    if (slotsAvailable >= 3) {
      try {
        const claimedJobs = await this.claimJobsBatch(queueName, slotsAvailable);

        if (claimedJobs.length > 0) {
          // Process all claimed jobs concurrently
          for (const job of claimedJobs) {
            this.executeJob(queueName, worker, job).catch((error: Error) => {
              logger.error(`[${queueName}] Unhandled error in job processing:`, error);
            });
          }
        }
      } catch (error) {
        logger.error(`[${queueName}] Batch claim error:`, error);
        // Fall back to single job claiming
        this.processNextJob(queueName, worker).catch((error: Error) => {
          logger.error(`[${queueName}] Unhandled error in job processing:`, error);
        });
      }
    } else {
      // Single job claiming for small slot counts (fire and forget - don't await!)
      for (let i = 0; i < slotsAvailable; i++) {
        this.processNextJob(queueName, worker).catch((error: Error) => {
          logger.error(`[${queueName}] Unhandled error in job processing:`, error);
        });
      }
    }
  }

  /**
   * Get count of active jobs for a specific queue
   */
  private getActiveJobCount(queueName: string): number {
    const activeSet = this.activeJobsByQueue.get(queueName);
    return activeSet ? activeSet.size : 0;
  }

  /**
   * Track a job as active for a queue
   */
  private trackActiveJob(queueName: string, jobId: number): void {
    if (!this.activeJobsByQueue.has(queueName)) {
      this.activeJobsByQueue.set(queueName, new Set());
    }
    this.activeJobsByQueue.get(queueName)!.add(jobId);
    this.activeJobs++;
  }

  /**
   * Remove a job from active tracking
   */
  private untrackActiveJob(queueName: string, jobId: number): void {
    const activeSet = this.activeJobsByQueue.get(queueName);
    if (activeSet) {
      activeSet.delete(jobId);
    }
    this.activeJobs--;
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

      // Execute the job
      await this.executeJob(queueName, worker, job);
    } catch (error) {
      logger.error(`[${queueName}] Error processing job:`, error);
    }
  }

  /**
   * Execute a single claimed job
   * Shared logic for both single and batch job processing
   */
  private async executeJob(
    queueName: string,
    worker: BaseWorker,
    job: Job
  ) {
    let jobId: number | null = null;

    try {
      jobId = job.id;
      this.trackActiveJob(queueName, jobId);

      try {
        // Parse payload from JSON
        const payload = typeof job.payload === "string"
          ? JSON.parse(job.payload)
          : job.payload;

        // Execute the worker's handle method
        await worker.handle(payload, job);

        // Mark as completed
        await this.completeJob(job.id);
        this.jobsProcessed++;
      } catch (error) {
        // Mark as failed (will retry if attempts < maxAttempts)
        await this.failJob(job.id, error);

        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(
          `[${queueName}] Job #${job.id} failed (${job.attempts}/${job.maxAttempts}): ${errorMessage}`
        );
      } finally {
        if (jobId !== null) {
          this.untrackActiveJob(queueName, jobId);
        }
      }
    } catch (error) {
      logger.error(`[${queueName}] Error executing job:`, error);
      if (jobId !== null) {
        this.untrackActiveJob(queueName, jobId);
      }
    }
  }  /**
   * Atomically claim the next available job using two-phase strategy
   *
   * Phase 1: Fast SELECT to find candidate job (uses index, no write lock)
   * Phase 2: Quick UPDATE by ID (minimal lock time)
   *
   * This is much faster than UPDATE...ORDER BY...LIMIT with large tables because:
   * - SELECT can use covering index efficiently
   * - UPDATE by primary key is instant
   * - Reduces lock contention time by 10-100x
   *
   * @returns The claimed job, or null if no jobs available
   */
  private async claimJob(queueName: string): Promise<Job | null> {
    const now = new Date();
    const nowUnix = Math.floor(now.getTime() / 1000);

    try {
      // Phase 1: Fast SELECT to find candidate job ID
      // This uses the optimized index and doesn't hold write locks
      const { DatabaseConnection } = await import("../../src/db");
      const queueDb = DatabaseConnection.getRawQueueSqlite();

      if (!queueDb) {
        return null;
      }

      // Raw SQL for maximum performance - finds first available job
      // ORDER BY: priority ASC (0 = highest priority), then id DESC (newest first)
      const candidate = queueDb
        .query(
          `SELECT id
           FROM jobs
           WHERE queue = ?
             AND status = 'pending'
             AND available_at <= ?
             AND attempts < max_attempts
           ORDER BY priority ASC, id DESC
           LIMIT 1`
        )
        .get(queueName, nowUnix) as { id: number } | null;

      if (!candidate) {
        return null; // No jobs available
      }

      // Phase 2: Atomic UPDATE by ID (very fast, minimal lock)
      // Race condition: Another worker might claim the same job
      // That's OK - the UPDATE will affect 0 rows and we return null
      const [job] = await this.db
        .update(jobs)
        .set({
          status: "processing",
          reservedAt: now,
          attempts: sql`${jobs.attempts} + 1`,
        })
        .where(
          and(
            eq(jobs.id, candidate.id),
            eq(jobs.status, "pending") // Double-check it's still pending
          )
        )
        .returning();

      return job || null;
    } catch (error) {
      // SQLITE_BUSY errors can still happen but should be rare
      if (error instanceof Error && error.message.includes("BUSY")) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Batch claim multiple jobs at once (reduces query overhead)
   *
   * Phase 1: SELECT multiple candidate IDs
   * Phase 2: UPDATE all candidates in one transaction
   *
   * This is more efficient when concurrency > 1 because:
   * - Fewer queries overall
   * - Less lock contention
   * - Better throughput under load
   *
   * @param queueName Queue to claim from
   * @param count Number of jobs to claim (typically = worker concurrency)
   * @returns Array of claimed jobs
   */
  private async claimJobsBatch(queueName: string, count: number): Promise<Job[]> {
    if (count <= 0) return [];

    const now = new Date();
    const nowUnix = Math.floor(now.getTime() / 1000);

    try {
      const { DatabaseConnection } = await import("../../src/db");
      const queueDb = DatabaseConnection.getRawQueueSqlite();

      if (!queueDb) {
        return [];
      }

      // Phase 1: SELECT multiple candidate IDs
      // ORDER BY: priority ASC (0 = highest priority), then id DESC (newest first)
      const candidates = queueDb
        .query(
          `SELECT id
           FROM jobs
           WHERE queue = ?
             AND status = 'pending'
             AND available_at <= ?
             AND attempts < max_attempts
           ORDER BY priority ASC, id DESC
           LIMIT ?`
        )
        .all(queueName, nowUnix, count) as { id: number }[];

      if (candidates.length === 0) {
        return [];
      }

      const candidateIds = candidates.map(c => c.id);

      // Phase 2: Batch UPDATE by IDs
      // Use Drizzle ORM with inArray for type safety
      const updatedCount = await this.db
        .update(jobs)
        .set({
          status: "processing",
          reservedAt: now,
          attempts: sql`${jobs.attempts} + 1`,
        })
        .where(
          and(
            sql`${jobs.id} IN (${sql.join(candidateIds.map(id => sql`${id}`), sql`, `)})`,
            eq(jobs.status, "pending") // Double-check still pending
          )
        );

      // Fetch the claimed jobs
      const claimedJobs = await this.db
        .select()
        .from(jobs)
        .where(
          and(
            sql`${jobs.id} IN (${sql.join(candidateIds.map(id => sql`${id}`), sql`, `)})`,
            eq(jobs.status, "processing"),
            eq(jobs.reservedAt, now)
          )
        );

      return claimedJobs;
    } catch (error) {
      if (error instanceof Error && error.message.includes("BUSY")) {
        return [];
      }
      throw error;
    }
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

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    logger.warn(`Timeout waiting for ${this.activeJobs} active jobs to finish`);
  }

  /**
   * Log current processing statistics
   * Called periodically to show activity
   */
  private async logStats() {
    const now = Date.now();
    const elapsed = (now - this.lastStatsTime) / 1000; // seconds
    const rate = this.jobsProcessed / elapsed;

    // Get queue stats
    const queueStats: Record<string, { pending: number; processing: number }> = {};

    for (const queueName of this.workers.keys()) {
      const [stats] = await this.db
        .select({
          pending: sql<number>`count(*) filter (where ${jobs.status} = 'pending')`,
          processing: sql<number>`count(*) filter (where ${jobs.status} = 'processing')`,
        })
        .from(jobs)
        .where(eq(jobs.queue, queueName));

      queueStats[queueName] = stats || { pending: 0, processing: 0 };
    }

    logger.info(`Queue: ${rate.toFixed(2)} jobs/sec, ${this.activeJobs} active`);

    // Reset counters
    this.jobsProcessed = 0;
    this.lastStatsTime = now;
  }
}

// Create singleton instance and register workers
import { DatabaseConnection } from "../../src/db";
import { KillmailFetcher } from "./killmail-fetcher";
import { KillmailValueUpdater } from "./killmail-value-updater";
import { WebSocketEmitter } from "./websocket-emitter";
import { ESIFetcher } from "./esi-fetcher";

export const queueManager = new QueueManager(DatabaseConnection.getQueueInstance());

// Register all workers
queueManager.registerWorker(new KillmailFetcher());
queueManager.registerWorker(new KillmailValueUpdater());
queueManager.registerWorker(new WebSocketEmitter());
queueManager.registerWorker(new ESIFetcher());

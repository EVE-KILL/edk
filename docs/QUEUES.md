# Queue System Design

## Overview

A **SQLite-based job queue** that runs in the same process as the web server. Uses database transactions and row-level locking to safely distribute jobs across multiple workers without conflicts.

## Why SQLite for Queues?

**Advantages:**
- ✅ No additional infrastructure (Redis/RabbitMQ/SQS)
- ✅ Transactional safety - jobs can't be lost
- ✅ Persistent - survives restarts
- ✅ `RETURNING` clause for atomic take operations
- ✅ Simple deployment - just one database file
- ✅ Perfect for low-to-medium throughput (thousands of jobs/sec)

**Limitations:**
- ⚠️ Not ideal for extremely high throughput (100k+ jobs/sec)
- ⚠️ Single writer at a time (but WAL mode helps)
- ⚠️ No built-in pub/sub like Redis

**Good for EVE Kill:**
- Processing incoming killmails from zkill websocket
- Fetching character/corporation/alliance data from ESI
- Generating statistics
- Updating search indexes
- Sending notifications

## Architecture

```
app/
  queue/
    schema/
      jobs.ts              # Jobs table schema
      job-locks.ts         # Optional: distributed locks
    workers/
      base-worker.ts       # Base worker class
      killmail-fetcher.ts  # Fetches killmails from ESI
      esi-fetcher.ts       # Fetches entity data from ESI
      price-fetcher.ts     # Fetches price data
      index.ts             # Worker registry
    queue-manager.ts       # Queue coordination
    job-dispatcher.ts      # Enqueue jobs
    index.ts               # Public API
```

## Schema Design

### Jobs Table

```typescript
export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  // Job identification
  queue: text("queue").notNull(), // e.g., "killmails", "esi", "stats"
  type: text("type").notNull(),   // e.g., "process", "fetch", "update"

  // Job data
  payload: text("payload", { mode: "json" }).notNull(), // JSON data

  // Status tracking
  status: text("status").notNull().default("pending"),
  // pending -> processing -> completed/failed

  // Timing
  availableAt: integer("available_at", { mode: "timestamp" }).notNull(),
  // When job becomes available (for delayed jobs)

  reservedAt: integer("reserved_at", { mode: "timestamp" }),
  // When worker claimed the job

  processedAt: integer("processed_at", { mode: "timestamp" }),
  // When job finished (success or failure)

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),

  // Retry logic
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),

  // Error tracking
  error: text("error"), // Last error message

  // Priority (lower = higher priority)
  priority: integer("priority").notNull().default(0),
}, (table) => ({
  // Composite index for efficient job fetching
  statusQueuePriorityIdx: index("status_queue_priority_idx")
    .on(table.status, table.queue, table.priority, table.availableAt),

  // Index for cleanup queries
  statusProcessedIdx: index("status_processed_idx")
    .on(table.status, table.processedAt),

  // Index for monitoring
  queueStatusIdx: index("queue_status_idx")
    .on(table.queue, table.status),
}));

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
```

## Key Technique: Atomic Job Taking

The **critical trick** is using SQLite's `RETURNING` clause with `UPDATE`:

```typescript
// This is ATOMIC - only ONE worker can claim a job
const [job] = await db
  .update(jobs)
  .set({
    status: "processing",
    reservedAt: new Date(),
    attempts: sql`${jobs.attempts} + 1`,
  })
  .where(
    and(
      eq(jobs.queue, queueName),
      eq(jobs.status, "pending"),
      lte(jobs.availableAt, new Date()), // Job is available
      lt(jobs.attempts, jobs.maxAttempts), // Not exhausted retries
    )
  )
  .orderBy(asc(jobs.priority), asc(jobs.id))
  .limit(1)
  .returning();

// job is either:
// - The claimed job (this worker got it)
// - undefined (another worker got it, or no jobs available)
```

**Why this works:**
1. SQLite's default isolation level is SERIALIZABLE
2. The UPDATE acquires a write lock
3. Only ONE worker's UPDATE succeeds per job
4. `RETURNING` gives us the updated row
5. Other workers get `undefined` and try the next job

## Queue Manager

```typescript
export class QueueManager {
  private workers: Map<string, BaseWorker> = new Map();
  private running = false;
  private pollingIntervals: NodeJS.Timeout[] = [];

  constructor(private db: Database) {}

  // Register workers
  registerWorker(worker: BaseWorker) {
    this.workers.set(worker.queueName, worker);
  }

  // Start all workers
  async start() {
    this.running = true;

    for (const [queueName, worker] of this.workers) {
      // Each queue gets its own polling loop
      const interval = setInterval(
        () => this.processQueue(queueName, worker),
        worker.pollInterval || 1000
      );

      this.pollingIntervals.push(interval);
    }

    console.log(`✅ Queue manager started with ${this.workers.size} workers`);
  }

  // Stop all workers
  async stop() {
    this.running = false;
    this.pollingIntervals.forEach(clearInterval);
    this.pollingIntervals = [];

    // Wait for in-flight jobs to finish
    await this.waitForActiveJobs();

    console.log("✅ Queue manager stopped");
  }

  // Process a single queue
  private async processQueue(queueName: string, worker: BaseWorker) {
    if (!this.running) return;

    // Process multiple jobs in parallel (up to worker.concurrency)
    const concurrency = worker.concurrency || 1;
    const promises: Promise<void>[] = [];

    for (let i = 0; i < concurrency; i++) {
      promises.push(this.processNextJob(queueName, worker));
    }

    await Promise.all(promises);
  }

  // Process a single job
  private async processNextJob(queueName: string, worker: BaseWorker) {
    try {
      // Atomically claim a job
      const job = await this.claimJob(queueName);

      if (!job) {
        // No jobs available
        return;
      }

      console.log(`[${queueName}] Processing job #${job.id}`);

      try {
        // Execute the worker's handle method
        await worker.handle(job.payload, job);

        // Mark as completed
        await this.completeJob(job.id);

        console.log(`[${queueName}] ✅ Job #${job.id} completed`);
      } catch (error) {
        // Mark as failed (will retry if attempts < maxAttempts)
        await this.failJob(job.id, error);

        console.error(`[${queueName}] ❌ Job #${job.id} failed:`, error);
      }
    } catch (error) {
      console.error(`[${queueName}] Error processing job:`, error);
    }
  }

  // Atomically claim the next available job
  private async claimJob(queueName: string): Promise<Job | null> {
    const [job] = await this.db
      .update(jobs)
      .set({
        status: "processing",
        reservedAt: new Date(),
        attempts: sql`${jobs.attempts} + 1`,
      })
      .where(
        and(
          eq(jobs.queue, queueName),
          eq(jobs.status, "pending"),
          lte(jobs.availableAt, new Date()),
          lt(jobs.attempts, jobs.maxAttempts),
        )
      )
      .orderBy(asc(jobs.priority), asc(jobs.id))
      .limit(1)
      .returning();

    return job || null;
  }

  // Mark job as completed
  private async completeJob(jobId: number) {
    await this.db
      .update(jobs)
      .set({
        status: "completed",
        processedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));
  }

  // Mark job as failed (will retry if possible)
  private async failJob(jobId: number, error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await this.db
      .update(jobs)
      .set({
        status: sql`CASE
          WHEN ${jobs.attempts} >= ${jobs.maxAttempts} THEN 'failed'
          ELSE 'pending'
        END`,
        error: errorMessage,
        processedAt: sql`CASE
          WHEN ${jobs.attempts} >= ${jobs.maxAttempts} THEN ${new Date().getTime()}
          ELSE NULL
        END`,
        // Exponential backoff for retries
        availableAt: sql`datetime('now', '+' || (${jobs.attempts} * ${jobs.attempts}) || ' seconds')`,
      })
      .where(eq(jobs.id, jobId));
  }

  // Wait for all active jobs to finish
  private async waitForActiveJobs(timeout = 30000) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const activeCount = await this.db
        .select({ count: sql`count(*)` })
        .from(jobs)
        .where(eq(jobs.status, "processing"))
        .then(([row]) => row.count as number);

      if (activeCount === 0) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.warn("⚠️ Timeout waiting for active jobs to finish");
  }
}
```

## Base Worker

```typescript
export abstract class BaseWorker<TPayload = any> {
  abstract queueName: string;

  // How often to poll for jobs (ms)
  pollInterval = 1000;

  // How many jobs to process in parallel
  concurrency = 1;

  // The actual work
  abstract handle(payload: TPayload, job: Job): Promise<void>;
}
```

## Job Dispatcher

```typescript
export class JobDispatcher {
  constructor(private db: Database) {}

  // Enqueue a new job
  async dispatch<TPayload>(
    queue: string,
    type: string,
    payload: TPayload,
    options: {
      priority?: number;
      delay?: number; // Delay in seconds
      maxAttempts?: number;
    } = {}
  ): Promise<Job> {
    const now = new Date();
    const availableAt = options.delay
      ? new Date(now.getTime() + options.delay * 1000)
      : now;

    const [job] = await this.db
      .insert(jobs)
      .values({
        queue,
        type,
        payload: JSON.stringify(payload),
        status: "pending",
        availableAt,
        createdAt: now,
        attempts: 0,
        maxAttempts: options.maxAttempts || 3,
        priority: options.priority || 0,
      })
      .returning();

    return job;
  }

  // Bulk enqueue (more efficient)
  async dispatchMany<TPayload>(
    queue: string,
    type: string,
    payloads: TPayload[],
    options: { priority?: number; maxAttempts?: number } = {}
  ): Promise<Job[]> {
    const now = new Date();

    return await this.db
      .insert(jobs)
      .values(
        payloads.map(payload => ({
          queue,
          type,
          payload: JSON.stringify(payload),
          status: "pending" as const,
          availableAt: now,
          createdAt: now,
          attempts: 0,
          maxAttempts: options.maxAttempts || 3,
          priority: options.priority || 0,
        }))
      )
      .returning();
  }

  // Get queue statistics
  async getStats(queue?: string) {
    const where = queue ? eq(jobs.queue, queue) : undefined;

    const stats = await this.db
      .select({
        status: jobs.status,
        count: sql`count(*)`,
      })
      .from(jobs)
      .where(where)
      .groupBy(jobs.status);

    return {
      pending: stats.find(s => s.status === "pending")?.count || 0,
      processing: stats.find(s => s.status === "processing")?.count || 0,
      completed: stats.find(s => s.status === "completed")?.count || 0,
      failed: stats.find(s => s.status === "failed")?.count || 0,
    };
  }

  // Cleanup old jobs
  async cleanup(olderThanDays = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await this.db
      .delete(jobs)
      .where(
        and(
          or(eq(jobs.status, "completed"), eq(jobs.status, "failed")),
          lt(jobs.processedAt, cutoff)
        )
      );

    return result.changes;
  }
}
```

## Example Workers

### Killmail Fetcher

```typescript
export class KillmailFetcher extends BaseWorker<{
  killmailId: number;
  hash: string;
}> {
  queueName = "killmail-fetch";
  concurrency = 5; // Fetch 5 killmails at once
  pollInterval = 1000;

  private killmailService = new KillmailService();

  async handle(payload, job) {
    const { killmailId, hash } = payload;

    try {
      // Fetch from ESI and save to database
      const killmail = await this.killmailService.getKillmail(killmailId, hash);

      if (!killmail) {
        console.log(`Killmail ${killmailId} not found`);
        return;
      }

      console.log(`Fetched and saved killmail ${killmailId}`);

      // Enqueue price fetch job
      await queue.dispatch("prices", "fetch", {
        killmailId,
        killmailTime: killmail.killmail.killmailTime,
        itemTypeIds: this.getItemTypeIds(killmail),
      });

      // Enqueue ESI fetch jobs for related entities
      await this.enqueueESIFetches(killmail);
    } catch (error) {
      console.error(`Failed to fetch killmail ${killmailId}:`, error);
      throw error;
    }
  }
}
```

### ESI Data Fetcher

```typescript
export class ESIFetcher extends BaseWorker<{
  type: "character" | "corporation" | "alliance";
  id: number;
}> {
  queueName = "esi";
  concurrency = 10; // ESI allows good concurrency
  pollInterval = 500; // Poll faster for ESI jobs

  async handle(payload, job) {
    const { type, id } = payload;

    const url = `https://esi.evetech.net/latest/${type}s/${id}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`ESI returned ${response.status}`);
    }

    const data = await response.json();

    // Store in cache or database
    await this.cache.set(`esi:${type}:${id}`, data, 3600);
  }
}
```

## Integration with Web Server

```typescript
// index.ts
import { QueueManager } from "./app/queue";
import { KillmailFetcher, ESIFetcher, PriceFetcher } from "./app/queue/workers";

const queueManager = new QueueManager(db);

// Register workers
queueManager.registerWorker(new KillmailFetcher());
queueManager.registerWorker(new ESIFetcher());
queueManager.registerWorker(new PriceFetcher());

// Start queue processing
await queueManager.start();

// Start web server
Bun.serve({
  port: 3000,
  fetch: router.handle.bind(router),
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down gracefully...");
  await queueManager.stop();
  process.exit(0);
});
```

## Usage Examples

```typescript
// In a controller - enqueue a job
import { queue } from "./app/queue";

export class ZKillWebhookController extends ApiController {
  async handle() {
    const killmail = await this.request.json();

    // Enqueue for processing
    await queue.dispatch("killmails", "process", {
      killmailId: killmail.killmail_id,
      hash: killmail.zkb.hash,
      data: killmail,
    });

    return this.json({ status: "queued" });
  }
}

// Bulk enqueue
await queue.dispatchMany(
  "esi",
  "fetch",
  characterIds.map(id => ({ type: "character", id }))
);

// Delayed job (fetch in 5 minutes)
await queue.dispatch(
  "esi",
  "fetch",
  { type: "alliance", id: 123 },
  { delay: 300 }
);

// High priority job
await queue.dispatch(
  "stats",
  "recalculate",
  { date: "2025-10-19" },
  { priority: -10 } // Lower = higher priority
);
```

## Monitoring & Admin

### Queue Stats Endpoint

```typescript
export class QueueStatsController extends ApiController {
  async handle() {
    const stats = await queue.getStats();
    const byQueue = {
      killmails: await queue.getStats("killmails"),
      esi: await queue.getStats("esi"),
      stats: await queue.getStats("stats"),
    };

    return this.json({
      overall: stats,
      queues: byQueue,
    });
  }
}

// GET /api/queue/stats
// {
//   "overall": { "pending": 42, "processing": 5, "completed": 1234, "failed": 3 },
//   "queues": {
//     "killmails": { "pending": 20, "processing": 3, ... },
//     "esi": { "pending": 22, "processing": 2, ... }
//   }
// }
```

### Failed Jobs Viewer

```typescript
export class FailedJobsController extends ApiController {
  async handle() {
    const failedJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.status, "failed"))
      .orderBy(desc(jobs.processedAt))
      .limit(50);

    return this.json({ jobs: failedJobs });
  }
}
```

### Retry Failed Jobs

```typescript
export class RetryJobController extends ApiController {
  async handle() {
    const { jobId } = await this.request.json();

    await db
      .update(jobs)
      .set({
        status: "pending",
        attempts: 0,
        error: null,
        availableAt: new Date(),
      })
      .where(eq(jobs.id, jobId));

    return this.json({ status: "retrying" });
  }
}
```

## Performance Considerations

### 1. Same Process vs Separate Workers

**Same Process (Recommended for MVP):**
- ✅ Simple deployment
- ✅ Shares cache with web server
- ✅ No network overhead
- ⚠️ CPU-bound jobs can slow web requests
- ⚠️ Crash takes down both

**Solution:** Keep workers lightweight. For heavy work, spawn Bun subprocess:

```typescript
async handle(payload) {
  // Spawn isolated process for CPU-intensive work
  const proc = Bun.spawn(["bun", "run", "workers/heavy-task.ts"], {
    stdin: "pipe",
  });

  proc.stdin.write(JSON.stringify(payload));
  proc.stdin.end();

  await proc.exited;
}
```

### 2. Polling Interval

- Fast jobs (ESI fetches): 100-500ms
- Normal jobs (killmail processing): 1000ms
- Slow jobs (statistics): 5000ms

### 3. Concurrency

- I/O-bound (ESI): High concurrency (10-50)
- Database-bound: Medium concurrency (3-10)
- CPU-bound: Low concurrency (1-2)

### 4. Database Contention

SQLite's write lock is rarely an issue because:
- Workers mostly READ (claim jobs)
- WAL mode allows concurrent reads
- Job updates are fast (microseconds)

If you hit limits (~10k jobs/sec), consider:
- Separate queue database file
- Move to PostgreSQL
- Use Redis for hot queues

## Dead Letter Queue

For permanently failed jobs:

```typescript
// After max attempts, move to DLQ
if (job.attempts >= job.maxAttempts) {
  await db.insert(deadLetterQueue).values({
    originalJobId: job.id,
    queue: job.queue,
    payload: job.payload,
    error: job.error,
    attempts: job.attempts,
    failedAt: new Date(),
  });
}
```

## Testing

```typescript
describe("Queue System", () => {
  it("should process jobs in order", async () => {
    await queue.dispatch("test", "job1", { data: 1 }, { priority: 0 });
    await queue.dispatch("test", "job2", { data: 2 }, { priority: -10 });

    // Start processing
    await queueManager.start();
    await sleep(2000);

    // job2 should be processed first (higher priority)
  });

  it("should retry failed jobs", async () => {
    let attempts = 0;

    class FailingWorker extends BaseWorker {
      queueName = "test";
      async handle() {
        attempts++;
        if (attempts < 3) throw new Error("Fail");
      }
    }

    // Should succeed on 3rd attempt
  });
});
```

## Future Enhancements

- [ ] Web UI for queue monitoring
- [ ] Job progress tracking (0-100%)
- [ ] Scheduled/cron jobs
- [ ] Job dependencies (job B waits for job A)
- [ ] Rate limiting per queue
- [ ] Job timeouts
- [ ] Metrics (Prometheus/Grafana)
- [ ] Multi-database sharding for extreme scale

## Summary

**SQLite-based queues work great for EVE Kill because:**

1. **Simple** - No external services needed
2. **Reliable** - Transactional guarantees
3. **Fast enough** - Handles thousands of jobs/sec
4. **Debuggable** - Jobs are just database rows
5. **Portable** - Easy to migrate to Redis/Postgres later

The atomic job claiming (UPDATE...RETURNING) prevents race conditions, and running in-process keeps deployment simple while you validate the architecture.

Start with this, scale later if needed! 🚀

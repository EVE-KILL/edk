# Queue System

EVE-KILL uses BullMQ on Redis for asynchronous job processing. The queue system handles killmail processing, entity updates, and other background tasks.

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    Job Producers                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Routes     │  │   Commands   │  │  Cron Jobs       │   │
│  │  (API/Web)   │  │  (Listeners) │  │  (Scheduled)     │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────┘   │
└─────────┼──────────────────┼────────────────────┼───────────┘
          │                  │                    │
          └──────────────────┼────────────────────┘
                             ▼
                    ┌────────────────────┐
                    │  Redis (BullMQ)    │
                    │                    │
                    │  ┌──────────────┐  │
                    │  │  killmail    │  │ Priority: HIGH
                    │  ├──────────────┤  │
                    │  │  character   │  │ Priority: LOW
                    │  ├──────────────┤  │
                    │  │  corporation │  │ Priority: LOW
                    │  ├──────────────┤  │
                    │  │  alliance    │  │ Priority: LOW
                    │  ├──────────────┤  │
                    │  │  price       │  │ Priority: LOW
                    │  └──────────────┘  │
                    └─────────┬──────────┘
                              ▼
                    ┌────────────────────┐
                    │  Queue Workers     │
                    │  (queue.ts)        │
                    │                    │
                    │  - Auto-discovery  │
                    │  - Concurrency     │
                    │  - Error handling  │
                    └────────────────────┘
```

## Queue Types

Defined in `server/helpers/queue.ts`:

```typescript
export enum QueueType {
  KILLMAIL = 'killmail',
  CHARACTER = 'character',
  CORPORATION = 'corporation',
  ALLIANCE = 'alliance',
  PRICE = 'price',
}
```

Each queue type has a corresponding processor in `queue/` directory.

## Priority System

Jobs are prioritized to ensure real-time data is processed faster:

```typescript
export enum JobPriority {
  HIGH = 1, // Real-time killmails
  NORMAL = 5, // Background tasks
  LOW = 10, // Batch updates, backfills
}
```

**Priority Usage**:

- **HIGH**: Real-time killmails from RedisQ/WebSocket
- **NORMAL**: Manual operations, one-off tasks
- **LOW**: Entity updates, price updates, backfills

## Job Options

All jobs support these options:

```typescript
interface JobOptions {
  priority?: JobPriority; // Job priority (1-10)
  delay?: number; // Delay in milliseconds
  attempts?: number; // Retry attempts (default: 3)
  backoff?: {
    // Retry backoff strategy
    type: 'exponential';
    delay: number;
  };
  repeat?: {
    // Recurring jobs
    cron?: string; // Cron pattern
    every?: number; // Interval in ms
  };
  jobId?: string; // Unique job ID (for deduplication)
}
```

## Enqueuing Jobs

### Single Job

```typescript
import { enqueueJob, QueueType, JobPriority } from '@/helpers/queue';

// High priority killmail
await enqueueJob(
  QueueType.KILLMAIL,
  { killmailId: 123, hash: 'abc...' },
  { priority: JobPriority.HIGH }
);

// Delayed entity update
await enqueueJob(
  QueueType.CHARACTER,
  { id: 90000001 },
  {
    priority: JobPriority.LOW,
    delay: 10000, // 10 seconds
  }
);
```

### Batch Jobs

More efficient for multiple jobs:

```typescript
import { enqueueJobMany, QueueType, JobPriority } from '@/helpers/queue';

const characterIds = [90000001, 90000002, 90000003];
await enqueueJobMany(
  QueueType.CHARACTER,
  characterIds.map((id) => ({ id })),
  {
    priority: JobPriority.LOW,
    delay: 10000,
  }
);
```

### Scheduled Jobs

For recurring tasks:

```typescript
import { scheduleJob, QueueType, JobPriority } from '@/helpers/queue';

// Daily price update at midnight
await scheduleJob(
  QueueType.PRICE,
  'daily-price-update',
  { typeId: 0 }, // Job data
  {
    priority: JobPriority.LOW,
    repeat: {
      cron: '0 0 * * *', // Midnight UTC
    },
  }
);
```

## Queue Processors

### Processor Structure

Each processor in `queue/` exports:

```typescript
import type { Job, Worker } from 'bullmq';
import { connection } from '@/helpers/queue';

export const name = 'character';

export const processor = async (job: Job<{ id: number }>) => {
  const { id } = job.data;

  // Do work
  const result = await updateCharacter(id);

  // Return result (logged on success)
  return result;
};

export function createWorker(): Worker {
  return new Worker(name, processor, {
    connection,
    concurrency: 5, // Process 5 jobs at once
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000, // Per second
    },
  });
}
```

### Auto-Discovery

Workers are auto-loaded by `queue.ts`:

1. Scans `queue/` directory
2. Loads `.ts` files
3. Creates workers from exports
4. Starts processing

```bash
# Start all workers
bun queue

# Start specific worker
bun queue character

# Start multiple workers
bun queue killmail character
```

## Error Handling

### Automatic Retries

Failed jobs are automatically retried:

```typescript
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000 // Start at 1 second, double each retry
  }
}
```

**Retry Schedule**:

- Attempt 1: Immediate
- Attempt 2: After 1 second
- Attempt 3: After 2 seconds
- Attempt 4: After 4 seconds (if attempts set to 4)

### Error Handling in Processors

```typescript
export const processor = async (job: Job<{ id: number }>) => {
  try {
    const result = await doWork(job.data);
    return { success: true, result };
  } catch (error) {
    logger.error('Job failed', {
      queue: name,
      jobId: job.id,
      error: error.message,
    });

    // Throw to trigger retry
    throw error;
  }
};
```

### Failed Job Handling

After all retries exhausted:

1. Job moves to "failed" queue
2. Error logged with full context
3. Manual intervention required

```bash
# View failed jobs
bun cli queue:failed killmail

# Retry failed jobs
bun cli queue:retry killmail --failed

# Clear failed jobs
bun cli queue:clear killmail --failed
```

## Queue Monitoring

### Queue Stats

```typescript
import { getQueueStats, QueueType } from '@/helpers/queue';

const stats = await getQueueStats(QueueType.KILLMAIL);
console.log(stats);
// {
//   waiting: 150,
//   active: 10,
//   completed: 50000,
//   failed: 25
// }
```

### Job Progress

Track long-running jobs:

```typescript
export const processor = async (job: Job<{ id: number }>) => {
  const total = 100;

  for (let i = 0; i < total; i++) {
    await processItem(i);
    await job.updateProgress((i / total) * 100);
  }

  return { processed: total };
};
```

### Events

Workers emit events for monitoring:

```typescript
worker.on('completed', (job) => {
  logger.info('Job completed', { jobId: job.id });
});

worker.on('failed', (job, error) => {
  logger.error('Job failed', { jobId: job.id, error });
});

worker.on('stalled', (jobId) => {
  logger.warn('Job stalled', { jobId });
});
```

## Job Deduplication

Prevent duplicate jobs using `jobId`:

```typescript
await enqueueJob(
  QueueType.CHARACTER,
  { id: 90000001 },
  {
    jobId: `character:90000001`, // Unique ID
  }
);

// Second enqueue with same jobId is ignored
await enqueueJob(
  QueueType.CHARACTER,
  { id: 90000001 },
  {
    jobId: `character:90000001`, // Ignored (duplicate)
  }
);
```

## Concurrency Configuration

### Per-Worker Concurrency

Set in `createWorker()`:

```typescript
export function createWorker(): Worker {
  return new Worker(name, processor, {
    connection,
    concurrency: 10, // Process 10 jobs simultaneously
  });
}
```

**Recommendations**:

- **Killmail**: 10 (ESI rate limits)
- **Character**: 5 (ESI rate limits)
- **Corporation**: 5 (ESI rate limits)
- **Alliance**: 5 (ESI rate limits)
- **Price**: 10 (can be higher)

### Rate Limiting

Prevent overwhelming external APIs:

```typescript
export function createWorker(): Worker {
  return new Worker(name, processor, {
    connection,
    concurrency: 5,
    limiter: {
      max: 150, // Max 150 jobs
      duration: 1000, // Per second (ESI limit)
    },
  });
}
```

## Queue Patterns

### Fan-Out Pattern

After processing one job, create many related jobs:

```typescript
// Killmail processor
export const processor = async (job: Job<{ killmailId: number }>) => {
  const killmail = await processKillmail(job.data.killmailId);

  // Fan out to entity queues
  const characterIds = extractCharacterIds(killmail);
  await enqueueJobMany(
    QueueType.CHARACTER,
    characterIds.map((id) => ({ id })),
    { priority: JobPriority.LOW }
  );

  return { processed: true };
};
```

### Delayed Processing

Defer work to reduce contention:

```typescript
// Don't update entities immediately after killmail
await enqueueJobMany(
  QueueType.CHARACTER,
  characterIds.map((id) => ({ id })),
  {
    priority: JobPriority.LOW,
    delay: 10000, // Wait 10 seconds
  }
);
```

### Scheduled Maintenance

Run periodic tasks:

```typescript
// Update prices daily
await scheduleJob(
  QueueType.PRICE,
  'daily-price-update',
  { full: true },
  {
    repeat: {
      cron: '0 2 * * *', // 2 AM UTC
    },
  }
);
```

## CLI Commands

```bash
# Start all workers
bun queue

# Start specific workers
bun queue killmail character

# View queue stats
bun cli queue:stats

# Clear queue
bun cli queue:clear killmail --all

# Retry failed jobs
bun cli queue:retry killmail --failed

# Pause/resume queue
bun cli queue:pause killmail
bun cli queue:resume killmail
```

## Best Practices

1. **Use appropriate priorities** - HIGH for real-time, LOW for background
2. **Batch enqueue operations** - Use `enqueueJobMany()` for multiple jobs
3. **Set job IDs for idempotency** - Prevent duplicate processing
4. **Handle errors gracefully** - Log context, throw for retry
5. **Monitor queue depths** - Alert on unusual backlog
6. **Rate limit external APIs** - Respect ESI limits (150 req/s)
7. **Use delays strategically** - Reduce contention on shared resources
8. **Test processors independently** - Unit test processor functions

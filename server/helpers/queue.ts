import { Queue } from 'bullmq';

/**
 * Queue Types Enum
 * Add new queue types here for type-safe queue operations
 */
export enum QueueType {
  KILLMAIL = 'killmail',
  CHARACTER = 'character',
  CORPORATION = 'corporation',
  ALLIANCE = 'alliance',
  PRICE = 'price',
}

/**
 * Type-safe queue job data types
 * Each queue type maps to its job data structure
 */
export interface QueueJobData {
  [QueueType.KILLMAIL]: { killmailId: number; hash: string };
  [QueueType.CHARACTER]: { id: number };
  [QueueType.CORPORATION]: { id: number };
  [QueueType.ALLIANCE]: { id: number };
  [QueueType.PRICE]: { typeId: number; date?: number };
}

/**
 * Redis connection config
 */
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0,
};

/**
 * Queue instances cache
 */
const queues = new Map<QueueType, Queue>();

/**
 * Get or create a queue instance
 */
function getQueue<T extends QueueType>(queueType: T): Queue {
  if (!queues.has(queueType)) {
    queues.set(
      queueType,
      new Queue(queueType, {
        connection: REDIS_CONFIG,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      })
    );
  }

  return queues.get(queueType)!;
}

/**
 * Create a sanitized job ID without colons (BullMQ restriction)
 */
function createJobId(queueType: QueueType, data: any): string {
  // Convert data to a string without colons
  const dataStr = JSON.stringify(data).replace(/:/g, '_');
  return `${queueType}-${dataStr}`;
}

/**
 * Enqueue a single job
 * Type-safe job enqueuing for a specific queue
 */
export async function enqueueJob<T extends QueueType>(
  queueType: T,
  data: QueueJobData[T]
): Promise<void> {
  const queue = getQueue(queueType);

  // Use data properties as unique job ID to prevent duplicates
  const jobId = createJobId(queueType, data);

  await queue.add(queueType, data, {
    jobId,
    removeOnComplete: true,
  });
}

/**
 * Enqueue multiple jobs for the same queue
 * Type-safe batch enqueuing
 */
export async function enqueueJobMany<T extends QueueType>(
  queueType: T,
  dataArray: QueueJobData[T][]
): Promise<void> {
  const queue = getQueue(queueType);

  const jobs = dataArray.map((data) => ({
    name: queueType,
    data,
    opts: {
      jobId: createJobId(queueType, data),
      removeOnComplete: true,
    },
  }));

  await queue.addBulk(jobs);
}

/**
 * Close all queue connections
 */
export async function closeAllQueues(): Promise<void> {
  for (const queue of queues.values()) {
    await queue.close();
  }
  queues.clear();
}

/**
 * Get queue statistics
 */
export async function getQueueStats(queueType: QueueType): Promise<{
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = getQueue(queueType);

  const counts = await queue.getJobCounts(
    'active',
    'waiting',
    'completed',
    'failed',
    'delayed'
  );

  return {
    active: counts.active,
    waiting: counts.waiting,
    completed: counts.completed,
    failed: counts.failed,
    delayed: counts.delayed,
  };
}

/**
 * Get all queues for monitoring
 */
export function getAllQueues(): Map<QueueType, Queue> {
  return queues;
}

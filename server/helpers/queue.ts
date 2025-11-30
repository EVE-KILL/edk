import { Queue, JobsOptions, RepeatOptions } from 'bullmq';
import { env } from './env';
import { als } from './als';

/**
 * Queue Types Enum
 */
export enum QueueType {
  KILLMAIL = 'killmail',
  CHARACTER = 'character',
  CORPORATION = 'corporation',
  ALLIANCE = 'alliance',
  PRICE = 'price',
  AUTH = 'auth',
  ENTITY_STATS = 'entity_stats',
}

/**
 * Type-safe queue job data types
 */
export interface QueueJobData {
  [QueueType.KILLMAIL]: { killmailId: number; hash: string; warId?: number };
  [QueueType.CHARACTER]: { id: number };
  [QueueType.CORPORATION]: { id: number };
  [QueueType.ALLIANCE]: { id: number };
  [QueueType.PRICE]: { typeId: number; date?: number };
  [QueueType.AUTH]: { userId: number };
  [QueueType.ENTITY_STATS]: {
    killmailId: number;
    killmailTime: string;
    entities: Array<{
      entityId: number;
      entityType:
        | 'character'
        | 'corporation'
        | 'alliance'
        | 'faction'
        | 'group'
        | 'type';
      isKill: boolean;
    }>;
    totalValue: number;
    isSolo: boolean;
    isNpc: boolean;
  };
}

/**
 * Redis connection config
 */
const REDIS_CONFIG: any = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  db: 0,
};
if (env.REDIS_PASSWORD) {
  REDIS_CONFIG.password = env.REDIS_PASSWORD;
}

/**
 * Queue instances cache
 */
const queues = new Map<QueueType, Queue | any>();

/**
 * Get or create a queue instance
 */
function getQueue<T extends QueueType>(queueType: T): Queue {
  if (env.NODE_ENV === 'test') {
    if (!queues.has(queueType)) {
      // In test mode, return a mock queue that does nothing
      const mockQueue = {
        add: async () => {},
        addBulk: async () => {},
        close: async () => {},
        getJobCounts: async () => ({
          active: 0,
          waiting: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
        }),
      };
      queues.set(queueType, mockQueue);
    }
    return queues.get(queueType)!;
  }
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
  const dataStr = JSON.stringify(data).replace(/:/g, '_');
  return `${queueType}-${dataStr}`;
}

/**
 * Enqueue a single job
 */
export enum JobPriority {
  HIGH = 1,
  NORMAL = 5,
  LOW = 10,
}

/**
 * Job Options Interface
 */
export interface JobOptions {
  priority?: JobPriority;
  delay?: number;
  repeat?: RepeatOptions;
}

export async function enqueueJob<T extends QueueType>(
  queueType: T,
  data: QueueJobData[T],
  options?: JobOptions
): Promise<void> {
  const queue = getQueue(queueType);
  const jobId = createJobId(queueType, data);
  const store = als.getStore();

  const jobData = {
    ...data,
    _meta: {
      correlationId: store?.correlationId,
    },
  };
  const bullOptions: JobsOptions = {
    jobId,
    removeOnComplete: true,
    ...options,
  };
  await queue.add(queueType, jobData, bullOptions);
}

/**
 * Enqueue multiple jobs for the same queue
 */
export async function enqueueJobMany<T extends QueueType>(
  queueType: T,
  dataArray: QueueJobData[T][],
  options?: JobOptions
): Promise<void> {
  const queue = getQueue(queueType);
  const store = als.getStore();

  const jobs = dataArray.map((data) => {
    const jobData = {
      ...data,
      _meta: {
        correlationId: store?.correlationId,
      },
    };
    const bullOptions: JobsOptions = {
      jobId: createJobId(queueType, data),
      removeOnComplete: true,
      ...options,
    };
    return {
      name: queueType,
      data: jobData,
      opts: bullOptions,
    };
  });
  await queue.addBulk(jobs);
}

/**
 * Schedule a recurring job
 */
export async function scheduleJob<T extends QueueType>(
  queueType: T,
  jobId: string,
  data: QueueJobData[T],
  options: {
    priority?: JobPriority;
    repeat: RepeatOptions;
  }
): Promise<void> {
  const queue = getQueue(queueType);
  await queue.add(queueType, data, {
    jobId,
    ...options,
  });
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
  return queues as Map<QueueType, Queue>;
}

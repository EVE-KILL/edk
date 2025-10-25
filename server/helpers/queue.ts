import { Queue } from 'bullmq'

/**
 * Queue Types Enum
 * Add new queue types here for type-safe queue operations
 */
export enum QueueType {
  CHARACTER = 'character',
  CORPORATION = 'corporation',
  ALLIANCE = 'alliance'
}

/**
 * Type-safe queue job data types
 * Each queue type maps to its job data structure
 */
export interface QueueJobData {
  [QueueType.CHARACTER]: { id: number }
  [QueueType.CORPORATION]: { id: number }
  [QueueType.ALLIANCE]: { id: number }
}

/**
 * Redis connection config
 */
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0
}

/**
 * Queue instances cache
 */
const queues = new Map<QueueType, Queue>()

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
            delay: 2000
          },
          removeOnComplete: true,
          removeOnFail: false
        }
      })
    )
  }

  return queues.get(queueType)!
}

/**
 * Enqueue a single job
 * Type-safe job enqueuing for a specific queue
 */
export async function enqueueJob<T extends QueueType>(
  queueType: T,
  data: QueueJobData[T]
): Promise<void> {
  const queue = getQueue(queueType)

  // Use data properties as unique job ID to prevent duplicates
  const jobId = `${queueType}:${JSON.stringify(data)}`

  await queue.add(queueType, data, {
    jobId,
    removeOnComplete: true
  })
}

/**
 * Enqueue multiple jobs for the same queue
 * Type-safe batch enqueuing
 */
export async function enqueueJobMany<T extends QueueType>(
  queueType: T,
  dataArray: QueueJobData[T][]
): Promise<void> {
  const queue = getQueue(queueType)

  const jobs = dataArray.map((data) => ({
    name: queueType,
    data,
    opts: {
      jobId: `${queueType}:${JSON.stringify(data)}`,
      removeOnComplete: true
    }
  }))

  await queue.addBulk(jobs)
}

/**
 * Close all queue connections
 */
export async function closeAllQueues(): Promise<void> {
  for (const queue of queues.values()) {
    await queue.close()
  }
  queues.clear()
}

/**
 * Get queue statistics
 */
export async function getQueueStats(queueType: QueueType): Promise<{
  active: number
  waiting: number
  completed: number
  failed: number
  delayed: number
}> {
  const queue = getQueue(queueType)

  const [active, waiting, completed, failed, delayed] = await Promise.all([
    queue.count('active'),
    queue.count('waiting'),
    queue.count('completed'),
    queue.count('failed'),
    queue.count('delayed')
  ])

  return { active, waiting, completed, failed, delayed }
}

/**
 * Get all queues for monitoring
 */
export function getAllQueues(): Map<QueueType, Queue> {
  return queues
}

/**
 * Price Queue Worker
 *
 * Fetches and stores price data from eve-kill.com API
 */

import { Worker, type Job } from 'bullmq'
import type { QueueJobData } from '../server/helpers/queue'
import { QueueType } from '../server/helpers/queue'
import { logger } from '../server/helpers/logger'
import { fetchPrices } from '../server/fetchers/price'
import { storePrices } from '../server/models/prices'

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0
}

/**
 * Process price fetch job
 */
async function processor(job: Job<QueueJobData[QueueType.PRICE]>) {
  const { typeId, date } = job.data

  logger.info(`[Price Queue] Processing price fetch for type ${typeId}`, { date })

  try {
    // Fetch prices from eve-kill.com API
    const prices = await fetchPrices(typeId, 14, date)

    if (prices.length === 0) {
      logger.warn(`[Price Queue] No price data found for type ${typeId}`)
      return
    }

    // Store prices in database
    await storePrices(prices)

    logger.success(`[Price Queue] Stored ${prices.length} price records for type ${typeId}`)
  } catch (error) {
    logger.error(`[Price Queue] Error processing type ${typeId}:`, { error })
    throw error // Let BullMQ handle retry logic
  }
}

/**
 * Create worker instance
 */
export function createWorker() {
  const worker = new Worker(QueueType.PRICE, processor, {
    connection: REDIS_CONFIG,
    concurrency: 5, // Process up to 5 price fetches concurrently
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000 // Per second
    }
  })

  worker.on('completed', (job) => {
    logger.debug(`[Price Queue] Job ${job.id} completed`)
  })

  worker.on('failed', (job, err) => {
    logger.error(`[Price Queue] Job ${job?.id} failed:`, { error: err })
  })

  worker.on('error', (err) => {
    logger.error(`[Price Queue] Worker error:`, { error: err })
  })

  logger.info('[Price Queue] Worker started')

  return worker
}

// Export for auto-discovery
export const name = QueueType.PRICE
export { processor }

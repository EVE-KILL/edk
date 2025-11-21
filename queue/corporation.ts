import { Worker, Job } from 'bullmq'
import { fetchAndStoreCorporation } from '../server/fetchers/corporation'

/**
 * Corporation Queue Processor
 *
 * Processes corporation entity update jobs
 * Fetches corporation data from EVE-KILL/ESI and stores it
 */

export const name = 'corporation'

export async function processor(job: Job): Promise<void> {
  const { id } = job.data as { id: number }

  console.log(`[corporation] Processing corporation ${id}...`)

  try {
    const result = await fetchAndStoreCorporation(id)

    if (result) {
      console.log(`✅ [corporation] Successfully processed corporation ${id}`)
    } else {
      console.warn(`⚠️  [corporation] Corporation ${id} not found or failed to fetch`)
    }
  } catch (error) {
    console.error(`❌ [corporation] Error processing corporation ${id}:`, error)
    throw error // Re-throw for BullMQ retry handling
  }
}

/**
 * Create worker instance
 * Used by main queue.ts runner
 */
export function createWorker(connection: any) {
  return new Worker(name, processor, {
    connection,
    concurrency: 5,
    lockDuration: 30000,
    lockRenewTime: 15000,
    maxStalledCount: 2,
    stalledInterval: 5000
  })
}

import { readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Worker } from 'bullmq'
import chalk from 'chalk'

/**
 * Queue Runner - Main Entry Point
 *
 * Auto-discovers and loads queue processors from ./queue directory
 * Starts all workers or a specific worker based on CLI argument
 *
 * Usage:
 *   bun queue              # Start all queues
 *   bun queue character    # Start only character queue
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const QUEUE_DIR = join(__dirname, 'queue')

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0
}

interface QueueModule {
  name: string
  processor: (job: any) => Promise<void>
  createWorker: (connection: any) => Worker
}

/**
 * Load queue modules from directory
 */
async function loadQueueModules(): Promise<Map<string, QueueModule>> {
  const queues = new Map<string, QueueModule>()

  try {
    const files = readdirSync(QUEUE_DIR).filter((f) => f.endsWith('.ts') && f !== 'queue.ts')

    for (const file of files) {
      const queueName = file.replace('.ts', '')
      const modulePath = join(QUEUE_DIR, file)

      try {
        const module = await import(modulePath)

        if (!module.name || !module.processor || !module.createWorker) {
          console.warn(`⚠️  Queue module ${file} missing required exports (name, processor, createWorker)`)
          continue
        }

        queues.set(queueName, module as QueueModule)
        console.log(`✅ Loaded queue: ${chalk.cyan(queueName)}`)
      } catch (error) {
        console.error(`❌ Failed to load queue ${file}:`, error)
      }
    }
  } catch (error) {
    console.error(`❌ Failed to read queue directory:`, error)
  }

  return queues
}

/**
 * Start queue workers
 */
async function startQueues(queueNames?: string[]): Promise<Worker[]> {
  const queues = await loadQueueModules()

  if (queues.size === 0) {
    console.error('❌ No queues found')
    process.exit(1)
  }

  const workers: Worker[] = []

  // If specific queues requested, filter to those
  let queuesToStart = Array.from(queues.keys())
  if (queueNames && queueNames.length > 0) {
    queuesToStart = queuesToStart.filter((q) => queueNames.includes(q))

    if (queuesToStart.length === 0) {
      console.error(`❌ No queues found matching: ${queueNames.join(', ')}`)
      console.error(`Available queues: ${Array.from(queues.keys()).join(', ')}`)
      process.exit(1)
    }
  }

  console.log('')
  console.log(chalk.blue.bold('🚀 Starting Queue Workers'))
  console.log(chalk.dim(`Queues to start: ${queuesToStart.join(', ')}`))
  console.log('')

  // Create and start workers
  for (const queueName of queuesToStart) {
    const module = queues.get(queueName)!

    try {
      const worker = module.createWorker(REDIS_CONFIG)

      // Add event listeners
      worker.on('completed', (job, result) => {
        console.log(`✅ [${queueName}] Job ${job.id} completed`)
      })

      worker.on('failed', (job, error) => {
        console.error(`❌ [${queueName}] Job ${job?.id} failed:`, error?.message)
      })

      worker.on('error', (error) => {
        console.error(`❌ [${queueName}] Worker error:`, error)
      })

      workers.push(worker)
      console.log(`▶️  Started worker for queue: ${chalk.green(queueName)}`)
    } catch (error) {
      console.error(`❌ Failed to start queue ${queueName}:`, error)
    }
  }

  console.log('')
  console.log(chalk.green(`✅ All ${workers.length} queue worker(s) started`))
  console.log(chalk.dim('Press Ctrl+C to stop'))
  console.log('')

  return workers
}

/**
 * Graceful shutdown
 */
async function shutdown(workers: Worker[]) {
  console.log('')
  console.log(chalk.yellow('⏹️  Shutting down queue workers...'))

  for (const worker of workers) {
    try {
      await worker.close()
    } catch (error) {
      console.error(`Error closing worker:`, error)
    }
  }

  console.log(chalk.green('✅ All workers shut down'))
  process.exit(0)
}

/**
 * Main entry point
 */
async function main() {
  // Get queue names from CLI arguments (skip node and script path)
  const queueArgs = process.argv.slice(2)

  const workers = await startQueues(queueArgs)

  // Handle graceful shutdown
  process.on('SIGINT', () => shutdown(workers))
  process.on('SIGTERM', () => shutdown(workers))

  // Keep process alive
  await new Promise(() => {
    // Process will exit on SIGINT/SIGTERM
  })
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

#!/usr/bin/env bun
/**
 * Cron Jobs Runner
 *
 * Automatically discovers and runs cron jobs from the /cronjobs directory
 * Usage:
 *   bun cronjobs              - Run all cron jobs on their schedule
 *   bun cronjobs <job-name>   - Run a specific job immediately
 */

import { readdirSync, statSync } from 'fs'
import { join, parse } from 'path'
import { CronJob } from 'cron'

interface CronJobModule {
  name: string
  description: string
  schedule: string // 6-part cron expression (seconds minutes hours day month dayOfWeek)
  action: () => Promise<void>
}

const CRONJOBS_DIR = join(process.cwd(), 'cronjobs')

/**
 * Recursively discover all cron job files
 */
function discoverCronJobs(dir: string): Map<string, string> {
  const jobs = new Map<string, string>()

  try {
    const entries = readdirSync(dir)

    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        // Recursively scan subdirectories
        const subJobs = discoverCronJobs(fullPath)
        for (const [name, path] of subJobs) {
          jobs.set(name, path)
        }
      } else if (entry.endsWith('.ts') || entry.endsWith('.js')) {
        // Extract job name from filename
        const { name } = parse(entry)
        jobs.set(name, fullPath)
      }
    }
  } catch (error) {
    // Directory might not exist yet
    console.error(`⚠️  Could not scan directory ${dir}:`, error)
  }

  return jobs
}

/**
 * Load a cron job module
 */
async function loadCronJob(path: string): Promise<CronJobModule> {
  const module = await import(path)

  if (!module.name || !module.schedule || !module.action) {
    throw new Error(`Invalid cron job module: ${path}. Must export name, schedule, and action.`)
  }

  return {
    name: module.name,
    description: module.description || 'No description provided',
    schedule: module.schedule,
    action: module.action
  }
}

/**
 * Run a specific cron job immediately
 */
async function runJobImmediately(jobName: string, jobs: Map<string, string>) {
  const jobPath = jobs.get(jobName)

  if (!jobPath) {
    console.error(`❌ Cron job "${jobName}" not found`)
    console.log('\nAvailable jobs:')
    for (const [name] of jobs) {
      console.log(`  - ${name}`)
    }
    process.exit(1)
  }

  try {
    console.log(`🚀 Running cron job: ${jobName}`)
    const job = await loadCronJob(jobPath)
    console.log(`📋 Description: ${job.description}`)
    console.log(`⏰ Schedule: ${job.schedule}`)
    console.log('')

    await job.action()

    console.log(`\n✅ Cron job "${jobName}" completed successfully`)
    process.exit(0)
  } catch (error) {
    console.error(`\n❌ Cron job "${jobName}" failed:`, error)
    process.exit(1)
  }
}

/**
 * Start all cron jobs on their schedules
 */
async function startAllCronJobs(jobs: Map<string, string>) {
  const cronJobs: CronJob[] = []

  console.log(`📋 Discovered ${jobs.size} cron job(s)\n`)

  for (const [name, path] of jobs) {
    try {
      const job = await loadCronJob(path)

      console.log(`✅ Loaded cron job: ${name}`)
      console.log(`   Description: ${job.description}`)
      console.log(`   Schedule: ${job.schedule}`)

      // Create cron job
      const cronJob = new CronJob(
        job.schedule,
        async () => {
          console.log(`\n⏰ [${new Date().toISOString()}] Running scheduled job: ${name}`)
          try {
            await job.action()
            console.log(`✅ [${new Date().toISOString()}] Job "${name}" completed`)
          } catch (error) {
            console.error(`❌ [${new Date().toISOString()}] Job "${name}" failed:`, error)
          }
        },
        null, // onComplete
        false, // start
        'UTC' // timezone
      )

      cronJobs.push(cronJob)
    } catch (error) {
      console.error(`❌ Failed to load cron job "${name}":`, error)
    }
  }

  if (cronJobs.length === 0) {
    console.error('\n❌ No valid cron jobs found')
    process.exit(1)
  }

  console.log(`\n🚀 Starting ${cronJobs.length} cron job(s)...\n`)

  // Start all cron jobs
  for (const job of cronJobs) {
    job.start()
  }

  console.log('✅ All cron jobs started')
  console.log('Press Ctrl+C to stop\n')

  // Keep the process alive
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping all cron jobs...')
    for (const job of cronJobs) {
      job.stop()
    }
    console.log('✅ All cron jobs stopped')
    process.exit(0)
  })
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2)
  const specificJob = args[0]

  console.log('🕐 EVE-KILL Cron Jobs Runner\n')

  // Discover all cron jobs
  const jobs = discoverCronJobs(CRONJOBS_DIR)

  if (jobs.size === 0) {
    console.error('❌ No cron jobs found in /cronjobs directory')
    console.log('💡 Create cron jobs in /cronjobs/*.ts')
    process.exit(1)
  }

  if (specificJob) {
    // Run specific job immediately
    await runJobImmediately(specificJob, jobs)
  } else {
    // Start all jobs on their schedules
    await startAllCronJobs(jobs)
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})

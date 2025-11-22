import { database } from './database'
import { logger } from './logger'

/**
 * Partition Management Helper
 *
 * Creates and manages monthly partitions for killmails, attackers, and items tables.
 * Partitions range from December 2007 (first EVE killmail) through current + 3 months.
 */

interface PartitionInfo {
  tableName: string
  year: number
  month: number
}

/**
 * Generate partition name (e.g., "killmails_2024_11")
 */
function getPartitionName(tableName: string, year: number, month: number): string {
  const monthStr = month.toString().padStart(2, '0')
  return `${tableName}_${year}_${monthStr}`
}

/**
 * Get date range for a partition (YYYY-MM-01 to YYYY-MM+1-01)
 */
function getPartitionRange(year: number, month: number): { start: string; end: string } {
  const monthStr = month.toString().padStart(2, '0')
  const start = `${year}-${monthStr}-01`

  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endMonthStr = endMonth.toString().padStart(2, '0')
  const end = `${endYear}-${endMonthStr}-01`

  return { start, end }
}

/**
 * Check if a partition exists
 */
async function partitionExists(partitionName: string): Promise<boolean> {
  const result = await database.sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = ${partitionName}
      AND n.nspname = 'public'
    ) as exists
  `
  return result[0]?.exists || false
}

/**
 * Create a single partition if it doesn't exist
 */
export async function createPartition(
  tableName: string,
  year: number,
  month: number
): Promise<boolean> {
  const partitionName = getPartitionName(tableName, year, month)
  const exists = await partitionExists(partitionName)

  if (exists) {
    return false
  }

  const { start, end } = getPartitionRange(year, month)

  await database.sql.unsafe(`
    CREATE TABLE IF NOT EXISTS ${partitionName}
    PARTITION OF ${tableName}
    FOR VALUES FROM ('${start}') TO ('${end}')
  `)

  logger.debug(`Created partition: ${partitionName}`)
  return true
}

/**
 * Create partitions for a table from start date to end date
 */
export async function createPartitionsForTable(
  tableName: string,
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number
): Promise<number> {
  let currentYear = startYear
  let currentMonth = startMonth
  let created = 0

  while (
    currentYear < endYear ||
    (currentYear === endYear && currentMonth <= endMonth)
  ) {
    const wasCreated = await createPartition(tableName, currentYear, currentMonth)
    if (wasCreated) {
      created++
    }

    // Move to next month
    if (currentMonth === 12) {
      currentMonth = 1
      currentYear++
    } else {
      currentMonth++
    }
  }

  return created
}

/**
 * Create all missing partitions for killmails, attackers, and items
 * From December 2007 through current + 3 months
 */
export async function createMissingPartitions(): Promise<{
  killmails: number
  attackers: number
  items: number
}> {
  const startYear = 2007
  const startMonth = 12

  // Calculate end date (now + 3 months)
  const targetDate = new Date()
  targetDate.setMonth(targetDate.getMonth() + 3)
  const endYear = targetDate.getFullYear()
  const endMonth = targetDate.getMonth() + 1 // getMonth() is 0-indexed

  logger.info(
    `Creating partitions from ${startYear}-${startMonth} to ${endYear}-${endMonth}...`
  )

  const killmailsCreated = await createPartitionsForTable(
    'killmails',
    startYear,
    startMonth,
    endYear,
    endMonth
  )

  const attackersCreated = await createPartitionsForTable(
    'attackers',
    startYear,
    startMonth,
    endYear,
    endMonth
  )

  const itemsCreated = await createPartitionsForTable(
    'items',
    startYear,
    startMonth,
    endYear,
    endMonth
  )

  return {
    killmails: killmailsCreated,
    attackers: attackersCreated,
    items: itemsCreated,
  }
}

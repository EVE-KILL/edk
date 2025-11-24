import { database } from './database';
import { logger } from './logger';

/**
 * Partition Management Helper
 *
 * Creates and manages yearly partitions for killmails, attackers, and items tables.
 * Partitions range from 2007 (first EVE killmail) through current + 1 year.
 */

/**
 * Generate partition name (e.g., "killmails_2024")
 */
function getPartitionName(
  tableName: string,
  year: number
): string {
  return `${tableName}_${year}`;
}

/**
 * Get date range for a partition (YYYY-01-01 to YYYY+1-01-01)
 */
function getPartitionRange(
  year: number
): { start: string; end: string } {
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;

  return { start, end };
}

/**
 * Check if a partition exists
 */
async function partitionExists(partitionName: string): Promise<boolean> {
  const result = await database.findOne<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relname = :partitionName
         AND n.nspname = 'public'
     ) as exists`,
    { partitionName }
  );
  return result?.exists || false;
}

/**
 * Create a single partition if it doesn't exist
 */
export async function createPartition(
  tableName: string,
  year: number
): Promise<boolean> {
  const partitionName = getPartitionName(tableName, year);
  const exists = await partitionExists(partitionName);

  if (exists) {
    return false;
  }

  const { start, end } = getPartitionRange(year);

  // Use unsafe query because partition ranges don't work well with prepared statements
  const sql = database.sql;
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "${partitionName}"
    PARTITION OF "${tableName}"
    FOR VALUES FROM ('${start}') TO ('${end}')
  `);

  logger.debug(`Created partition: ${partitionName}`);
  return true;
}

/**
 * Create partitions for a table from start year to end year
 */
export async function createPartitionsForTable(
  tableName: string,
  startYear: number,
  endYear: number
): Promise<number> {
  let created = 0;

  for (let year = startYear; year <= endYear; year++) {
    const wasCreated = await createPartition(tableName, year);
    if (wasCreated) {
      created++;
    }
  }

  return created;
}

/**
 * Create all missing partitions for killmails, attackers, items, and prices
 * From 2007 through current + 1 year
 */
export async function createMissingPartitions(): Promise<{
  killmails: number;
  attackers: number;
  items: number;
  prices: number;
}> {
  const startYear = 2007;
  const endYear = new Date().getFullYear() + 1; // Current year + 1

  logger.info(
    `Creating partitions from ${startYear} to ${endYear}...`
  );

  const killmailsCreated = await createPartitionsForTable(
    'killmails',
    startYear,
    endYear
  );

  const attackersCreated = await createPartitionsForTable(
    'attackers',
    startYear,
    endYear
  );

  const itemsCreated = await createPartitionsForTable(
    'items',
    startYear,
    endYear
  );

  const pricesCreated = await createPartitionsForTable(
    'prices',
    startYear,
    endYear
  );

  return {
    killmails: killmailsCreated,
    attackers: attackersCreated,
    items: itemsCreated,
    prices: pricesCreated,
  };
}

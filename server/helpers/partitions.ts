import { database } from './database';
import { logger } from './logger';

const START_YEAR = 2007;
const MONTHLY_WINDOW = 6; // keep last 6 months as monthly
const FUTURE_MONTHS = 1; // pre-create one month ahead

type MonthPartition = {
  year: number;
  month: number; // 1-12
  start: Date;
  end: Date;
};

type PartitionTarget = {
  name: string;
  start: string;
  end: string;
};

export type MaintenanceResult = {
  monthlyCreated: number;
  yearlyCreated: number;
  partialCreated: number;
  rolledUp: number;
  droppedMonthly: number;
  skippedMonthly: {
    table: string;
    year: number;
    partition: string;
    reason: string;
  }[];
  pricesCreated: number;
  preWindowsMerged: number;
};

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, delta: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1)
  );
}

function dateLiteral(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthlyPartitionName(
  table: string,
  year: number,
  month: number
): string {
  return `${table}_${year}_${String(month).padStart(2, '0')}`;
}

function yearlyPartitionName(table: string, year: number): string {
  return `${table}_${year}`;
}

function preWindowPartitionName(
  table: string,
  year: number,
  cutoffMonth: number
): string {
  return `${table}_${year}_pre_${String(cutoffMonth).padStart(2, '0')}`;
}

function collectMonths(start: Date, endExclusive: Date): MonthPartition[] {
  const months: MonthPartition[] = [];
  let cursor = startOfMonth(start);

  while (cursor < endExclusive) {
    const next = addMonths(cursor, 1);
    months.push({
      year: cursor.getUTCFullYear(),
      month: cursor.getUTCMonth() + 1,
      start: cursor,
      end: next,
    });
    cursor = next;
  }

  return months;
}

async function listPreWindowPartitions(
  tableName: string,
  year: number
): Promise<string[]> {
  const rows = await database.find<{ name: string }>(
    `SELECT c.relname as name
     FROM pg_inherits i
     JOIN pg_class c ON c.oid = i.inhrelid
     JOIN pg_class p ON p.oid = i.inhparent
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE p.relname = :tableName
       AND n.nspname = 'public'
       AND c.relname LIKE :pattern`,
    { tableName, pattern: `${tableName}_${year}_pre_%` }
  );

  return rows.map((row) => row.name);
}

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

async function createRangePartition(
  tableName: string,
  partitionName: string,
  start: string,
  end: string
): Promise<boolean> {
  const exists = await partitionExists(partitionName);
  if (exists) {
    return false;
  }

  const sql = (database as any).sql;
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "${partitionName}"
    PARTITION OF "${tableName}"
    FOR VALUES FROM ('${start}') TO ('${end}')
  `);

  logger.debug(`Created partition: ${partitionName}`);
  return true;
}

async function ensureYearlyPartitions(
  tableName: string,
  endYearExclusive: number
): Promise<number> {
  let created = 0;

  for (let year = START_YEAR; year < endYearExclusive; year++) {
    const wasCreated = await createRangePartition(
      tableName,
      yearlyPartitionName(tableName, year),
      `${year}-01-01`,
      `${year + 1}-01-01`
    );
    if (wasCreated) {
      created++;
    }
  }

  return created;
}

async function ensurePreWindowPartition(
  tableName: string,
  monthlyStart: Date
): Promise<{ name: string | null; created: number; conflict: boolean }> {
  const month = monthlyStart.getUTCMonth() + 1;
  const year = monthlyStart.getUTCFullYear();

  // If monthly window starts on January, nothing to do.
  if (month === 1) {
    return { name: null, created: 0, conflict: false };
  }

  const targetName = preWindowPartitionName(tableName, year, month);
  const yearlyName = yearlyPartitionName(tableName, year);
  const yearlyExists = await partitionExists(yearlyName);

  if (yearlyExists) {
    return { name: null, created: 0, conflict: true };
  }

  const existingPrePartitions = await listPreWindowPartitions(tableName, year);
  if (existingPrePartitions.includes(targetName)) {
    return { name: targetName, created: 0, conflict: false };
  }

  // Rebuild pre-window partition to match the new boundary; move data from old pre-window partitions if any.
  const sql = (database as any).sql;
  await sql.begin(async (tx: any) => {
    for (const pre of existingPrePartitions) {
      await tx.unsafe(`ALTER TABLE "${tableName}" DETACH PARTITION "${pre}"`);
    }

    await tx.unsafe(`
      CREATE TABLE "${targetName}"
      PARTITION OF "${tableName}"
      FOR VALUES FROM ('${year}-01-01') TO ('${dateLiteral(monthlyStart)}')
    `);

    for (const pre of existingPrePartitions) {
      await tx.unsafe(
        `INSERT INTO "${targetName}" SELECT * FROM "${pre}" ON CONFLICT DO NOTHING`
      );
      await tx.unsafe(`DROP TABLE IF EXISTS "${pre}"`);
    }
  });

  return { name: targetName, created: 1, conflict: false };
}

async function ensureMonthlyPartitions(
  tableName: string,
  months: MonthPartition[]
): Promise<{
  created: number;
  skipped: { year: number; partition: string; reason: string }[];
}> {
  let created = 0;
  const skipped: { year: number; partition: string; reason: string }[] = [];

  for (const month of months) {
    const partitionName = monthlyPartitionName(
      tableName,
      month.year,
      month.month
    );
    const yearlyName = yearlyPartitionName(tableName, month.year);

    if (await partitionExists(yearlyName)) {
      skipped.push({
        year: month.year,
        partition: partitionName,
        reason: `Yearly partition ${yearlyName} already exists`,
      });
      continue;
    }

    const createdPartition = await createRangePartition(
      tableName,
      partitionName,
      dateLiteral(month.start),
      dateLiteral(month.end)
    );
    if (createdPartition) {
      created++;
    }
  }

  return { created, skipped };
}

async function moveMonthlyIntoTarget(
  tableName: string,
  monthly: MonthPartition,
  target: PartitionTarget
): Promise<boolean> {
  const monthlyName = monthlyPartitionName(
    tableName,
    monthly.year,
    monthly.month
  );
  const exists = await partitionExists(monthlyName);
  if (!exists) {
    return false;
  }

  await createRangePartition(tableName, target.name, target.start, target.end);

  const sql = (database as any).sql;
  await sql.begin(async (tx: any) => {
    await tx.unsafe(
      `INSERT INTO "${target.name}" SELECT * FROM "${monthlyName}" ON CONFLICT DO NOTHING`
    );
    await tx.unsafe(`DROP TABLE IF EXISTS "${monthlyName}"`);
  });

  logger.debug(`Rolled up ${monthlyName} into ${target.name}`);
  return true;
}

async function migratePreWindowsToYearly(
  tableName: string,
  boundaryYear: number
): Promise<number> {
  let merged = 0;

  for (let year = START_YEAR; year < boundaryYear; year++) {
    const prePartitions = await listPreWindowPartitions(tableName, year);
    if (!prePartitions.length) {
      continue;
    }

    const yearlyName = yearlyPartitionName(tableName, year);
    const sql = (database as any).sql;

    await sql.begin(async (tx: any) => {
      for (const pre of prePartitions) {
        await tx.unsafe(`ALTER TABLE "${tableName}" DETACH PARTITION "${pre}"`);
      }

      await tx.unsafe(`
        CREATE TABLE IF NOT EXISTS "${yearlyName}"
        PARTITION OF "${tableName}"
        FOR VALUES FROM ('${year}-01-01') TO ('${year + 1}-01-01')
      `);

      for (const pre of prePartitions) {
        await tx.unsafe(
          `INSERT INTO "${yearlyName}" SELECT * FROM "${pre}" ON CONFLICT DO NOTHING`
        );
        await tx.unsafe(`DROP TABLE IF EXISTS "${pre}"`);
        merged++;
      }
    });

    logger.debug(
      `Merged pre-window partitions into ${yearlyName}: ${prePartitions.join(', ')}`
    );
  }

  return merged;
}

export async function createMissingPartitions(
  referenceDate = new Date()
): Promise<MaintenanceResult> {
  const nowMonth = startOfMonth(referenceDate);
  const monthlyStart = addMonths(nowMonth, -(MONTHLY_WINDOW - 1));
  const monthlyEndExclusive = addMonths(nowMonth, FUTURE_MONTHS + 1);

  const monthlyWindow = collectMonths(monthlyStart, monthlyEndExclusive);
  const monthsToRollUp = collectMonths(
    new Date(Date.UTC(START_YEAR, 0, 1)),
    monthlyStart
  );

  const tables = ['killmails', 'attackers', 'items'];
  let monthlyCreated = 0;
  let yearlyCreated = 0;
  let partialCreated = 0;
  let rolledUp = 0;
  let droppedMonthly = 0;
  let preWindowsMerged = 0;
  const skippedMonthly: MaintenanceResult['skippedMonthly'] = [];

  logger.info(
    `Maintaining partitions: monthly from ${dateLiteral(monthlyStart)} through ${dateLiteral(
      monthlyEndExclusive
    )} (exclusive), yearly before that`
  );

  for (const table of tables) {
    preWindowsMerged += await migratePreWindowsToYearly(
      table,
      monthlyStart.getUTCFullYear()
    );

    yearlyCreated += await ensureYearlyPartitions(
      table,
      monthlyStart.getUTCFullYear()
    );

    const preWindow = await ensurePreWindowPartition(table, monthlyStart);
    if (preWindow.created) {
      partialCreated += preWindow.created;
    }
    if (preWindow.conflict) {
      skippedMonthly.push({
        table,
        year: monthlyStart.getUTCFullYear(),
        partition: preWindowPartitionName(
          table,
          monthlyStart.getUTCFullYear(),
          monthlyStart.getUTCMonth() + 1
        ),
        reason: `Yearly partition ${yearlyPartitionName(
          table,
          monthlyStart.getUTCFullYear()
        )} already exists`,
      });
    }

    const { created, skipped } = await ensureMonthlyPartitions(
      table,
      monthlyWindow
    );
    monthlyCreated += created;
    skippedMonthly.push(...skipped.map((entry) => ({ ...entry, table })));

    const preWindowName = preWindow.name;

    for (const month of monthsToRollUp) {
      // Skip if we cannot target a valid partition (no pre-window name when needed).
      if (
        month.year === monthlyStart.getUTCFullYear() &&
        (!preWindowName ||
          (await partitionExists(yearlyPartitionName(table, month.year))))
      ) {
        continue;
      }

      const target: PartitionTarget =
        month.year < monthlyStart.getUTCFullYear()
          ? {
              name: yearlyPartitionName(table, month.year),
              start: `${month.year}-01-01`,
              end: `${month.year + 1}-01-01`,
            }
          : {
              name: preWindowName as string,
              start: `${month.year}-01-01`,
              end: dateLiteral(monthlyStart),
            };

      const moved = await moveMonthlyIntoTarget(table, month, target);
      if (moved) {
        rolledUp++;
        droppedMonthly++;
      }
    }
  }

  // Prices stay yearly: keep current year + next year ready.
  const pricesCreated = await ensureYearlyPartitions(
    'prices',
    referenceDate.getUTCFullYear() + 2
  );

  return {
    monthlyCreated,
    yearlyCreated,
    partialCreated,
    rolledUp,
    droppedMonthly,
    skippedMonthly,
    pricesCreated,
    preWindowsMerged,
  };
}

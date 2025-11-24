import { logger } from '../../server/helpers/logger';
import { database } from '../../server/helpers/database';
import { storeKillmailsBulk } from '../../server/models/killmails';
import type { ESIKillmail } from '../../server/models/killmails';
import { enqueueJobMany, JobPriority } from '../../server/helpers/queue';
import { QueueType } from '../../server/helpers/queue';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { unlink, mkdir } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TotalsData {
  [date: string]: number;
}

export default {
  description: 'Import killmails from everef.net daily archives',
  options: [
    {
      flags: '--start-date <date>',
      description: 'Start date (YYYY-MM-DD, default: 2007-12-05)',
      defaultValue: '2007-12-05',
    },
    {
      flags: '--end-date <date>',
      description: 'End date (YYYY-MM-DD, default: today)',
    },
    {
      flags: '--temp-dir <path>',
      description:
        'Temporary directory for extraction (default: /tmp/everef-killmails)',
      defaultValue: '/tmp/everef-killmails',
    },
    {
      flags: '--batch-size <number>',
      description: 'Batch size for database inserts (default: 1000)',
      defaultValue: '1000',
    },
    {
      flags: '--delay <ms>',
      description: 'Delay between date fetches in milliseconds (default: 1000)',
      defaultValue: '1000',
    },
    {
      flags: '--enqueue-entities',
      description: 'Enqueue background jobs to fetch entity details',
    },
    {
      flags: '--reverse',
      description: 'Process dates in reverse order (newest to oldest)',
    },
  ],
  action: async (options: {
    startDate?: string;
    endDate?: string;
    tempDir?: string;
    batchSize?: string;
    delay?: string;
    enqueueEntities?: boolean;
    reverse?: boolean;
  }) => {
    const defaultStartDate = '2007-12-05';
    const startDate = options.startDate || defaultStartDate;
    const endDate = options.endDate || new Date().toISOString().split('T')[0];
    const tempDir = options.tempDir || '/tmp/everef-killmails';
    const batchSize = options.batchSize
      ? Number.parseInt(options.batchSize)
      : 1000;
    const delayMs = options.delay ? Number.parseInt(options.delay) : 1000;
    const enqueueEntities = options.enqueueEntities || false;
    const reverse = options.reverse || false;

    // When running in reverse without an explicit end date, treat the provided
    // start date as the newest date and walk back to the default start.
    const rangeStart =
      reverse && options.startDate && !options.endDate
        ? defaultStartDate
        : startDate;
    const rangeEnd =
      reverse && options.startDate && !options.endDate ? startDate : endDate;
    const [normalizedStart, normalizedEnd] =
      new Date(rangeStart) <= new Date(rangeEnd)
        ? [rangeStart, rangeEnd]
        : [rangeEnd, rangeStart];

    logger.info('Starting everef.net killmails import', {
      startDate,
      endDate,
      rangeStart,
      rangeEnd,
      tempDir,
      batchSize,
      delayMs,
      enqueueEntities,
      reverse,
    });

    const overallStartTime = Date.now();

    try {
      // Create temp directory
      await mkdir(tempDir, { recursive: true });

      // Fetch totals.json
      logger.info('Fetching totals.json...');
      const totalsResponse = await fetch(
        'https://data.everef.net/killmails/totals.json'
      );
      if (!totalsResponse.ok) {
        throw new Error(
          `Failed to fetch totals: ${totalsResponse.status} ${totalsResponse.statusText}`
        );
      }
      const totals: TotalsData = await totalsResponse.json();
      logger.success(`Fetched totals for ${Object.keys(totals).length} dates`);

      // Generate date range
      const dates = generateDateRange(normalizedStart, normalizedEnd);
      if (reverse) {
        dates.reverse();
      }
      logger.info(
        `Processing ${dates.length} dates from ${reverse ? normalizedEnd : normalizedStart} to ${reverse ? normalizedStart : normalizedEnd} (${reverse ? 'newest to oldest' : 'oldest to newest'})`
      );

      const totalStats = {
        datesProcessed: 0,
        datesSkipped: 0,
        killmailsProcessed: 0,
        killmailsStored: 0,
        killmailsSkipped: 0,
      };

      for (const date of dates) {
        // totals.json uses YYYYMMDD format, convert from YYYY-MM-DD
        const totalsKey = date.replace(/-/g, '');
        const expectedCount = totals[totalsKey] || 0;

        if (expectedCount === 0) {
          logger.debug(`Skipping ${date} (0 killmails in totals)`);
          totalStats.datesSkipped++;
          continue;
        }

        logger.info(
          `Processing date: ${date} (expected: ${expectedCount} killmails)`
        );

        try {
          const stats = await processDate(
            date,
            tempDir,
            batchSize,
            enqueueEntities
          );
          totalStats.datesProcessed++;
          totalStats.killmailsProcessed += stats.processed;
          totalStats.killmailsStored += stats.stored;
          totalStats.killmailsSkipped += stats.skipped;

          logger.info(`Completed ${date}`, stats);
        } catch {
          logger.error(`Failed to process ${date}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // Delay between dates
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      const totalTime = (Date.now() - overallStartTime) / 1000;
      logger.success('Import complete', {
        totalTime: `${totalTime.toFixed(2)}s`,
        avgRate: `${(totalStats.killmailsProcessed / totalTime).toFixed(2)}/s`,
        ...totalStats,
      });

      process.exit(0);
    } catch {
      logger.error('Import failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      process.exit(1);
    }
  },
};

function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const [rangeStart, rangeEnd] = start <= end ? [start, end] : [end, start];

  for (
    let d = new Date(rangeStart);
    d <= rangeEnd;
    d.setDate(d.getDate() + 1)
  ) {
    dates.push(d.toISOString().split('T')[0]);
  }

  return dates;
}

async function processDate(
  date: string,
  tempDir: string,
  batchSize: number,
  enqueueEntities: boolean
): Promise<{ processed: number; stored: number; skipped: number }> {
  const [year] = date.split('-');
  const url = `https://data.everef.net/killmails/${year}/killmails-${date}.tar.bz2`;
  const archivePath = `${tempDir}/killmails-${date}.tar.bz2`;
  const extractDir = `${tempDir}/${date}`;

  try {
    // Download archive
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        logger.warn(`Archive not found for ${date}, skipping`);
        return { processed: 0, stored: 0, skipped: 0 };
      }
      throw new Error(
        `Failed to download: ${response.status} ${response.statusText}`
      );
    }

    const fileStream = createWriteStream(archivePath);
    await pipeline(response.body as any, fileStream);

    // Extract archive
    await mkdir(extractDir, { recursive: true });
    await execAsync(`tar -xjf ${archivePath} -C ${extractDir}`);

    // Process JSON files (they're in a killmails/ subdirectory)
    const killmailsDir = `${extractDir}/killmails`;
    const files = await Array.fromAsync(
      new Bun.Glob('*.json').scan({ cwd: killmailsDir })
    );

    let processed = 0;
    let stored = 0;
    let skipped = 0;
    let currentBatch: Array<{ esi: ESIKillmail; hash?: string }> = [];
    const entityIds = {
      characters: new Set<number>(),
      corporations: new Set<number>(),
      alliances: new Set<number>(),
    };

    for (const file of files) {
      const filePath = `${killmailsDir}/${file}`;
      const content = await Bun.file(filePath).text();

      // Handle both single killmail and array of killmails
      let killmails: any[];
      try {
        const parsed = JSON.parse(content);
        killmails = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        logger.warn(`Failed to parse ${file}, skipping`);
        continue;
      }

      for (const killmail of killmails) {
        processed++;

        // Extract entity IDs
        if (enqueueEntities) {
          extractEntityIds(killmail, entityIds);
        }

        // Extract hash from everef data (they include it as killmail_hash)
        const hash = killmail.killmail_hash || undefined;

        // Add to batch (duplicates handled by ON CONFLICT DO NOTHING in bulkUpsert)
        currentBatch.push({ esi: killmail, hash });

        // Store batch when full
        if (currentBatch.length >= batchSize) {
          const result = await storeKillmailsBulk(currentBatch);
          stored += result.inserted;
          skipped += result.skippedExisting;
          currentBatch = [];
        }
      }
    }

    // Store remaining killmails
    if (currentBatch.length > 0) {
      const result = await storeKillmailsBulk(currentBatch);
      stored += result.inserted;
      skipped += result.skippedExisting;
    }

    // Enqueue entity updates
    if (
      enqueueEntities &&
      (entityIds.characters.size > 0 ||
        entityIds.corporations.size > 0 ||
        entityIds.alliances.size > 0)
    ) {
      const [missingCharacters, missingCorporations, missingAlliances] =
        await Promise.all([
          getMissingEntityIds(
            entityIds.characters,
            'characterId',
            'characters'
          ),
          getMissingEntityIds(
            entityIds.corporations,
            'corporationId',
            'corporations'
          ),
          getMissingEntityIds(entityIds.alliances, 'allianceId', 'alliances'),
        ]);

      if (
        missingCharacters.length === 0 &&
        missingCorporations.length === 0 &&
        missingAlliances.length === 0
      ) {
        logger.info('No missing entities to enqueue (all already present)');
      } else {
        logger.info('Enqueuing entity update jobs...', {
          characters: missingCharacters.length,
          corporations: missingCorporations.length,
          alliances: missingAlliances.length,
        });

        if (missingCharacters.length > 0) {
          await enqueueJobMany(
            QueueType.CHARACTER,
            missingCharacters.map((id) => ({ id })),
            { priority: JobPriority.LOW, delay: 60000 }
          );
        }
        if (missingCorporations.length > 0) {
          await enqueueJobMany(
            QueueType.CORPORATION,
            missingCorporations.map((id) => ({ id })),
            { priority: JobPriority.LOW, delay: 60000 }
          );
        }
        if (missingAlliances.length > 0) {
          await enqueueJobMany(
            QueueType.ALLIANCE,
            missingAlliances.map((id) => ({ id })),
            { priority: JobPriority.LOW, delay: 60000 }
          );
        }
      }
    }

    // Cleanup
    await unlink(archivePath);
    await execAsync(`rm -rf ${extractDir}`);

    return { processed, stored, skipped };
  } catch {
    // Cleanup on error
    await unlink(archivePath).catch(() => {});
    await execAsync(`rm -rf ${extractDir}`).catch(() => {});
    throw error;
  }
}

function extractEntityIds(
  killmail: ESIKillmail,
  entityIds: {
    characters: Set<number>;
    corporations: Set<number>;
    alliances: Set<number>;
  }
): void {
  // Victim
  if (killmail.victim.character_id) {
    entityIds.characters.add(killmail.victim.character_id);
  }
  if (killmail.victim.corporation_id) {
    entityIds.corporations.add(killmail.victim.corporation_id);
  }
  if (killmail.victim.alliance_id) {
    entityIds.alliances.add(killmail.victim.alliance_id);
  }

  // Attackers
  for (const attacker of killmail.attackers) {
    if (attacker.character_id) {
      entityIds.characters.add(attacker.character_id);
    }
    if (attacker.corporation_id) {
      entityIds.corporations.add(attacker.corporation_id);
    }
    if (attacker.alliance_id) {
      entityIds.alliances.add(attacker.alliance_id);
    }
  }
}

async function getMissingEntityIds<
  K extends 'characterId' | 'corporationId' | 'allianceId',
>(
  ids: Set<number>,
  column: K,
  table: 'characters' | 'corporations' | 'alliances'
): Promise<number[]> {
  if (ids.size === 0) {
    return [];
  }

  const existingRows = await database.find<{ [key in K]: number }>(
    `SELECT "${column}" FROM ${table} WHERE "${column}" = ANY(:ids)`,
    { ids: Array.from(ids) }
  );

  const existingIds = new Set(existingRows.map((row) => row[column]));
  return Array.from(ids).filter((id) => !existingIds.has(id));
}

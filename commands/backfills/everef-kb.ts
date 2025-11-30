import { logger } from '../../server/helpers/logger';
import { database } from '../../server/helpers/database';
import type { ESIKillmail } from '../../server/models/killmails';
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
  description:
    'ULTRA-FAST killmail import from everef.net (optimized for bulk speed)',
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
        'Temporary directory for extraction (default: /tmp/everef-kb)',
      defaultValue: '/tmp/everef-kb',
    },
    {
      flags: '--batch-size <number>',
      description: 'Batch size for database inserts (default: 50000)',
      defaultValue: '50000',
    },
    {
      flags: '--parallel <number>',
      description: 'Number of parallel file processors (default: 4)',
      defaultValue: '4',
    },
    {
      flags: '--delay <ms>',
      description: 'Delay between date fetches in milliseconds (default: 0)',
      defaultValue: '0',
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
    parallel?: string;
    delay?: string;
    reverse?: boolean;
  }) => {
    const defaultStartDate = '2007-12-05';
    const startDate = options.startDate || defaultStartDate;
    const endDate = options.endDate || new Date().toISOString().split('T')[0];
    const tempDir = options.tempDir || '/tmp/everef-kb';
    const batchSize = options.batchSize
      ? Number.parseInt(options.batchSize)
      : 50000;
    const parallelism = options.parallel
      ? Number.parseInt(options.parallel)
      : 4;
    const delayMs = options.delay ? Number.parseInt(options.delay) : 0;
    const reverse = options.reverse || false;

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

    logger.info('Starting ULTRA-FAST everef.net killmails import', {
      startDate,
      endDate,
      tempDir,
      batchSize,
      parallelism,
      delayMs,
      reverse,
      optimization: 'MAXIMUM SPEED - Skip entity checks, skip value calc',
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
        killmailsInserted: 0,
        killmailsSkipped: 0,
      };

      for (const date of dates) {
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
            parallelism
          );
          totalStats.datesProcessed++;
          totalStats.killmailsProcessed += stats.processed;
          totalStats.killmailsInserted += stats.inserted;
          totalStats.killmailsSkipped += stats.skipped;

          const elapsed = (Date.now() - overallStartTime) / 1000;
          const rate = (totalStats.killmailsProcessed / elapsed).toFixed(0);
          logger.info(`Completed ${date} | Rate: ${rate}/s`, stats);
        } catch (error) {
          logger.error(`Failed to process ${date}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }

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
    } catch (error) {
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
  parallelism: number
): Promise<{ processed: number; inserted: number; skipped: number }> {
  const [year] = date.split('-');
  const url = `https://data.everef.net/killmails/${year}/killmails-${date}.tar.bz2`;
  const archivePath = `${tempDir}/killmails-${date}.tar.bz2`;
  const extractDir = `${tempDir}/${date}`;

  try {
    // Download archive
    const downloadStart = Date.now();
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        logger.warn(`Archive not found for ${date}, skipping`);
        return { processed: 0, inserted: 0, skipped: 0 };
      }
      throw new Error(
        `Failed to download: ${response.status} ${response.statusText}`
      );
    }

    const fileStream = createWriteStream(archivePath);
    await pipeline(response.body as any, fileStream);
    logger.debug(
      `Downloaded in ${((Date.now() - downloadStart) / 1000).toFixed(1)}s`
    );

    // Extract archive
    const extractStart = Date.now();
    await mkdir(extractDir, { recursive: true });
    await execAsync(`tar -xjf ${archivePath} -C ${extractDir}`);
    logger.debug(
      `Extracted in ${((Date.now() - extractStart) / 1000).toFixed(1)}s`
    );

    // Get all JSON files
    const killmailsDir = `${extractDir}/killmails`;
    const files = await Array.fromAsync(
      new Bun.Glob('*.json').scan({ cwd: killmailsDir })
    );

    logger.debug(
      `Processing ${files.length} files with ${parallelism} workers`
    );

    // Process files in parallel batches
    let processed = 0;
    let inserted = 0;
    let skipped = 0;

    // Chunk files for parallel processing
    const chunks: string[][] = [];
    for (let i = 0; i < files.length; i += parallelism) {
      chunks.push(files.slice(i, i + parallelism));
    }

    for (const chunk of chunks) {
      const results = await Promise.all(
        chunk.map((file) =>
          processFile(`${killmailsDir}/${file}`, batchSize).catch((err) => {
            logger.warn(`Failed to process ${file}: ${err.message}`);
            return { processed: 0, inserted: 0, skipped: 0 };
          })
        )
      );

      for (const result of results) {
        processed += result.processed;
        inserted += result.inserted;
        skipped += result.skipped;
      }
    }

    // Cleanup
    await unlink(archivePath);
    await execAsync(`rm -rf ${extractDir}`);

    return { processed, inserted, skipped };
  } catch (error) {
    await unlink(archivePath).catch(() => {});
    await execAsync(`rm -rf ${extractDir}`).catch(() => {});
    throw error;
  }
}

async function processFile(
  filePath: string,
  batchSize: number
): Promise<{ processed: number; inserted: number; skipped: number }> {
  const content = await Bun.file(filePath).text();

  let killmails: any[];
  try {
    const parsed = JSON.parse(content);
    killmails = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return { processed: 0, inserted: 0, skipped: 0 };
  }

  let processed = 0;
  let inserted = 0;
  let skipped = 0;

  // Process in batches
  for (let i = 0; i < killmails.length; i += batchSize) {
    const batch = killmails.slice(i, i + batchSize);
    const result = await insertKillmailsBatch(batch);
    processed += batch.length;
    inserted += result.inserted;
    skipped += result.skipped;
  }

  return { processed, inserted, skipped };
}

/**
 * ULTRA-FAST batch insert - minimal processing, maximum speed
 * Inserts killmails, attackers, and items in three bulk operations
 * Values are set to 0 (can be recalculated later)
 */
async function insertKillmailsBatch(
  killmails: ESIKillmail[]
): Promise<{ inserted: number; skipped: number }> {
  if (killmails.length === 0) return { inserted: 0, skipped: 0 };

  try {
    // Deduplicate by killmailId
    const uniqueMap = new Map<number, ESIKillmail>();
    for (const km of killmails) {
      if (km.killmail_id && !uniqueMap.has(km.killmail_id)) {
        uniqueMap.set(km.killmail_id, km);
      }
    }
    const uniqueKillmails = Array.from(uniqueMap.values());

    if (uniqueKillmails.length === 0) return { inserted: 0, skipped: 0 };

    // Check which killmails already exist to avoid conflicts
    const killmailIds = uniqueKillmails.map((km) => km.killmail_id!);
    const existing = await database.find<{ killmailId: number }>(
      'SELECT "killmailId" FROM killmails WHERE "killmailId" = ANY(:ids)',
      { ids: killmailIds }
    );
    const existingIds = new Set(existing.map((r) => r.killmailId));

    // Filter to only new killmails
    const newKillmails = uniqueKillmails.filter(
      (km) => !existingIds.has(km.killmail_id!)
    );

    if (newKillmails.length === 0) {
      return { inserted: 0, skipped: uniqueKillmails.length };
    }

    // Prepare killmail records (minimal data, no value calculation)
    const killmailRecords: any[] = [];
    const attackerRecords: any[] = [];
    const itemRecords: any[] = [];

    for (const esi of newKillmails) {
      const victim = esi.victim;
      const killmailId = esi.killmail_id!;
      const killmailTime = esi.killmail_time || new Date().toISOString();

      // Find final blow attacker
      const finalBlowAttacker = esi.attackers.find((a) => a.final_blow);
      const topAttacker =
        finalBlowAttacker ||
        esi.attackers.reduce(
          (max, a) => (a.damage_done > max.damage_done ? a : max),
          esi.attackers[0]
        );

      const attackerCount = esi.attackers.length;
      const solo = attackerCount === 1;
      const npc = esi.attackers.every((a) => !a.character_id);
      const awox = !!(
        victim.alliance_id &&
        victim.alliance_id > 0 &&
        esi.attackers.some((a) => a.alliance_id === victim.alliance_id)
      );

      killmailRecords.push({
        killmailId,
        killmailTime,
        solarSystemId: esi.solar_system_id,
        regionId: 0, // Will be updated by view/trigger if needed
        constellationId: 0,
        securityStatus: 0,
        victimCharacterId: victim.character_id || null,
        victimCorporationId: victim.corporation_id || 0,
        victimAllianceId: victim.alliance_id || null,
        victimFactionId: victim.faction_id || null,
        victimShipTypeId: victim.ship_type_id,
        victimShipGroupId: 0, // Will be updated if needed
        victimDamageTaken: victim.damage_taken,
        topAttackerCharacterId: topAttacker?.character_id || null,
        topAttackerCorporationId: topAttacker?.corporation_id || 0,
        topAttackerAllianceId: topAttacker?.alliance_id || null,
        topAttackerFactionId: topAttacker?.faction_id || null,
        topAttackerShipTypeId: topAttacker?.ship_type_id || null,
        topAttackerShipGroupId: 0,
        attackerCount,
        totalValue: 0, // Skip value calculation for speed
        solo,
        npc,
        awox,
        warId: esi.war_id || null,
      });

      // Attackers
      for (const attacker of esi.attackers) {
        attackerRecords.push({
          killmailId,
          characterId: attacker.character_id || null,
          corporationId: attacker.corporation_id || 0,
          allianceId: attacker.alliance_id || null,
          factionId: attacker.faction_id || null,
          shipTypeId: attacker.ship_type_id || null,
          shipGroupId: 0,
          weaponTypeId: attacker.weapon_type_id || null,
          damageDone: attacker.damage_done,
          securityStatus: attacker.security_status || 0,
          finalBlow: attacker.final_blow || false,
        });
      }

      // Items
      if (victim.items) {
        for (const item of victim.items) {
          itemRecords.push({
            killmailId,
            itemTypeId: item.item_type_id,
            quantityDropped: item.quantity_dropped || null,
            quantityDestroyed: item.quantity_destroyed || null,
            singleton: item.singleton || 0,
            flag: item.flag,
          });
        }
      }
    }

    // Bulk insert all three tables
    await database.bulkInsert('killmails', killmailRecords);

    if (attackerRecords.length > 0) {
      await database.bulkInsert('attackers', attackerRecords);
    }

    if (itemRecords.length > 0) {
      await database.bulkInsert('items', itemRecords);
    }

    return {
      inserted: newKillmails.length,
      skipped: uniqueKillmails.length - newKillmails.length,
    };
  } catch (error) {
    logger.error('Batch insert failed', {
      error: error instanceof Error ? error.message : String(error),
      batchSize: killmails.length,
    });
    return { inserted: 0, skipped: killmails.length };
  }
}

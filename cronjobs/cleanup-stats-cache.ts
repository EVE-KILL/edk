/**
 * Stats Cache Cleanup Cron Job
 *
 * Runs daily at 2 AM to recalculate time-bucketed stats (14d, 30d, 90d)
 * This ensures stats remain accurate as killmails age out of time buckets
 *
 * Scheduled via: cronjobs.ts
 */

import { database } from '../server/helpers/database';
import { logger } from '../server/helpers/logger';

export const name = 'cleanup-stats-cache';
export const schedule = '0 0 2 * * *'; // Daily at 2 AM UTC (seconds, minutes, hours, day, month, dow)
export const description = 'Cleanup and recalculate time-bucketed entity stats';

export async function action() {
  logger.info('Starting entity stats cache cleanup...');
  const startTime = Date.now();

  try {
    // Cleanup 14-day stats
    await cleanupTimeBucket('character', 14);
    await cleanupTimeBucket('corporation', 14);
    await cleanupTimeBucket('alliance', 14);

    // Cleanup 30-day stats
    await cleanupTimeBucket('character', 30);
    await cleanupTimeBucket('corporation', 30);
    await cleanupTimeBucket('alliance', 30);

    // Cleanup 90-day stats
    await cleanupTimeBucket('character', 90);
    await cleanupTimeBucket('corporation', 90);
    await cleanupTimeBucket('alliance', 90);

    const duration = Date.now() - startTime;
    logger.success(
      `✓ Stats cache cleanup completed in ${(duration / 1000).toFixed(1)}s`
    );
  } catch (error) {
    logger.error('Stats cache cleanup failed:', error);
    throw error;
  }
}

// Backwards compatibility
export const handler = action;

async function cleanupTimeBucket(
  entityType: 'character' | 'corporation' | 'alliance',
  days: 14 | 30 | 90
) {
  logger.info(`Cleaning up ${days}d stats for ${entityType}s...`);

  let killsColumn = '"topAttackerCharacterId"';
  let lossesColumn = '"victimCharacterId"';

  if (entityType === 'corporation') {
    killsColumn = '"topAttackerCorporationId"';
    lossesColumn = '"victimCorporationId"';
  } else if (entityType === 'alliance') {
    killsColumn = '"topAttackerAllianceId"';
    lossesColumn = '"victimAllianceId"';
  }

  const suffix = `${days}d`;
  const startTime = Date.now();
  const interval = `${days} days`;

  // Only process entities with recent activity in this time bucket
  const entities = await database.query(
    `SELECT "entityId"
     FROM entity_stats_cache
     WHERE "entityType" = :entityType
       AND ("lastKillTime" >= NOW() - INTERVAL '${interval}' 
            OR "lastLossTime" >= NOW() - INTERVAL '${interval}')`,
    { entityType }
  );

  if (entities.length === 0) {
    logger.info(`  No active ${entityType}s in ${days}d bucket`);
    return;
  }

  logger.info(`  Processing ${entities.length} active ${entityType}s...`);

  // Update in batches
  const batchSize = 1000;
  let processed = 0;

  for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize);
    const entityIds = batch.map((e: any) => e.entityId);

    // Recalculate kills stats from killmails table
    await database.execute(
      `UPDATE entity_stats_cache
       SET
         "kills${suffix}" = COALESCE(kill_stats.kills, 0),
         "iskDestroyed${suffix}" = COALESCE(kill_stats.isk_destroyed, 0),
         "soloKills${suffix}" = COALESCE(kill_stats.solo_kills, 0),
         "npcKills${suffix}" = COALESCE(kill_stats.npc_kills, 0),
         "updatedAt" = NOW()
       FROM (
         SELECT
           ${killsColumn} as entity_id,
           COUNT(*) as kills,
           SUM("totalValue") as isk_destroyed,
           SUM(CASE WHEN solo THEN 1 ELSE 0 END) as solo_kills,
           SUM(CASE WHEN npc THEN 1 ELSE 0 END) as npc_kills
         FROM killmails
         WHERE ${killsColumn} = ANY(:entityIds::bigint[])
           AND "killmailTime" >= NOW() - INTERVAL '${interval}'
         GROUP BY ${killsColumn}
       ) kill_stats
       WHERE entity_stats_cache."entityId" = kill_stats.entity_id
         AND entity_stats_cache."entityType" = :entityType`,
      { entityIds, entityType }
    );

    // Recalculate losses stats from killmails table
    await database.execute(
      `UPDATE entity_stats_cache
       SET
         "losses${suffix}" = COALESCE(loss_stats.losses, 0),
         "iskLost${suffix}" = COALESCE(loss_stats.isk_lost, 0),
         "soloLosses${suffix}" = COALESCE(loss_stats.solo_losses, 0),
         "npcLosses${suffix}" = COALESCE(loss_stats.npc_losses, 0),
         "updatedAt" = NOW()
       FROM (
         SELECT
           ${lossesColumn} as entity_id,
           COUNT(*) as losses,
           SUM("totalValue") as isk_lost,
           SUM(CASE WHEN solo THEN 1 ELSE 0 END) as solo_losses,
           SUM(CASE WHEN npc THEN 1 ELSE 0 END) as npc_losses
         FROM killmails
         WHERE ${lossesColumn} = ANY(:entityIds::bigint[])
           AND "killmailTime" >= NOW() - INTERVAL '${interval}'
         GROUP BY ${lossesColumn}
       ) loss_stats
       WHERE entity_stats_cache."entityId" = loss_stats.entity_id
         AND entity_stats_cache."entityType" = :entityType`,
      { entityIds, entityType }
    );

    processed += batch.length;
  }

  const duration = Date.now() - startTime;
  logger.info(
    `  ✓ Cleaned ${processed} ${entityType}s in ${(duration / 1000).toFixed(1)}s`
  );
}

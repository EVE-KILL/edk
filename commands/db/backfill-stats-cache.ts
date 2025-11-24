/**
 * Backfill Entity Stats Cache
 *
 * One-time script to populate entity_stats_cache from existing killmails data.
 * Uses the existing views for all-time stats, then calculates time-bucketed stats.
 *
 * Usage: bun cli db:backfill-stats-cache
 */

import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';

interface _BackfillProgress {
  entityType: 'character' | 'corporation' | 'alliance';
  phase: 'all-time' | '90d' | '30d' | '14d';
  processed: number;
  total: number;
  startTime: number;
}

async function backfillAllTimeStats(
  entityType: 'character' | 'corporation' | 'alliance'
) {
  logger.info(`Backfilling all-time stats for ${entityType}s...`);

  let viewName = 'character_stats';
  let idColumn = 'characterId';

  if (entityType === 'corporation') {
    viewName = 'corporation_stats';
    idColumn = 'corporationId';
  } else if (entityType === 'alliance') {
    viewName = 'alliance_stats';
    idColumn = 'allianceId';
  }

  const startTime = Date.now();

  // Insert all-time stats from views
  const result = await database.execute(
    `INSERT INTO entity_stats_cache (
      "entityId",
      "entityType",
      "killsAll",
      "lossesAll",
      "iskDestroyedAll",
      "iskLostAll",
      "soloKillsAll",
      "soloLossesAll",
      "npcKillsAll",
      "npcLossesAll",
      "lastKillTime",
      "lastLossTime",
      "updatedAt"
    )
    SELECT
      "${viewName}"."${idColumn}" as "entityId",
      :entityType as "entityType",
      kills as "killsAll",
      losses as "lossesAll",
      "iskDestroyed" as "iskDestroyedAll",
      "iskLost" as "iskLostAll",
      "soloKills" as "soloKillsAll",
      "soloLosses" as "soloLossesAll",
      "npcKills" as "npcKillsAll",
      "npcLosses" as "npcLossesAll",
      "lastKillTime",
      "lastLossTime",
      NOW() as "updatedAt"
    FROM ${viewName}
    ON CONFLICT ("entityId", "entityType") DO UPDATE SET
      "killsAll" = EXCLUDED."killsAll",
      "lossesAll" = EXCLUDED."lossesAll",
      "iskDestroyedAll" = EXCLUDED."iskDestroyedAll",
      "iskLostAll" = EXCLUDED."iskLostAll",
      "soloKillsAll" = EXCLUDED."soloKillsAll",
      "soloLossesAll" = EXCLUDED."soloLossesAll",
      "npcKillsAll" = EXCLUDED."npcKillsAll",
      "npcLossesAll" = EXCLUDED."npcLossesAll",
      "lastKillTime" = EXCLUDED."lastKillTime",
      "lastLossTime" = EXCLUDED."lastLossTime",
      "updatedAt" = EXCLUDED."updatedAt"`,
    { entityType }
  );

  const duration = Date.now() - startTime;
  const count = result || 0;

  logger.success(
    `✓ Backfilled ${count} ${entityType}s (all-time) in ${duration}ms`
  );

  return count;
}

async function backfillTimeBucketStats(
  entityType: 'character' | 'corporation' | 'alliance',
  days: 14 | 30 | 90
) {
  logger.info(`Backfilling ${days}d stats for ${entityType}s...`);

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

  // Get list of entities to update (those with recent activity)
  const entities = await database.query(
    `SELECT "entityId"
     FROM entity_stats_cache
     WHERE "entityType" = :entityType
       AND ("lastKillTime" >= NOW() - INTERVAL '${interval}' 
            OR "lastLossTime" >= NOW() - INTERVAL '${interval}')`,
    { entityType }
  );

  logger.info(
    `Found ${entities.length} active ${entityType}s in last ${days} days`
  );

  if (entities.length === 0) {
    return 0;
  }

  // Process all entities - use raw SQL with string interpolation
  let processed = 0;

  // Update kills stats
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
       WHERE ${killsColumn} IS NOT NULL
         AND "killmailTime" >= NOW() - INTERVAL '${interval}'
       GROUP BY ${killsColumn}
     ) kill_stats
     WHERE entity_stats_cache."entityId" = kill_stats.entity_id
       AND entity_stats_cache."entityType" = :entityType`,
    { entityType }
  );

  // Update losses stats
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
       WHERE ${lossesColumn} IS NOT NULL
         AND "killmailTime" >= NOW() - INTERVAL '${interval}'
       GROUP BY ${lossesColumn}
     ) loss_stats
     WHERE entity_stats_cache."entityId" = loss_stats.entity_id
       AND entity_stats_cache."entityType" = :entityType`,
    { entityType }
  );

  processed = entities.length;

  const duration = Date.now() - startTime;
  logger.success(
    `✓ Backfilled ${processed} ${entityType}s (${days}d) in ${(duration / 1000).toFixed(1)}s`
  );

  return processed;
}

async function backfillStatsCache() {
  logger.info('='.repeat(80));
  logger.info('Entity Stats Cache Backfill');
  logger.info('='.repeat(80));

  const overallStart = Date.now();

  try {
    // Check if table exists
    const tableExists = await database.sql`
      SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'entity_stats_cache'
      ) as exists
    `;

    if (!tableExists[0].exists) {
      logger.error('entity_stats_cache table does not exist!');
      logger.error('Run migration: db/46-create-entity-stats-cache.sql');
      process.exit(1);
    }

    // Phase 1: Backfill all-time stats from views
    logger.info('Phase 1: Backfilling all-time stats from views...');
    logger.info('');

    const charCount = await backfillAllTimeStats('character');
    const corpCount = await backfillAllTimeStats('corporation');
    const allyCount = await backfillAllTimeStats('alliance');

    const totalEntities = charCount + corpCount + allyCount;
    logger.info('');
    logger.success(
      `✓ Phase 1 complete: ${totalEntities.toLocaleString()} entities`
    );
    logger.info('');

    // Phase 2: Backfill 90d stats
    logger.info('Phase 2: Backfilling 90-day stats...');
    logger.info('');

    await backfillTimeBucketStats('character', 90);
    await backfillTimeBucketStats('corporation', 90);
    await backfillTimeBucketStats('alliance', 90);

    logger.info('');
    logger.success('✓ Phase 2 complete: 90-day stats');
    logger.info('');

    // Phase 3: Backfill 30d stats
    logger.info('Phase 3: Backfilling 30-day stats...');
    logger.info('');

    await backfillTimeBucketStats('character', 30);
    await backfillTimeBucketStats('corporation', 30);
    await backfillTimeBucketStats('alliance', 30);

    logger.info('');
    logger.success('✓ Phase 3 complete: 30-day stats');
    logger.info('');

    // Phase 4: Backfill 14d stats
    logger.info('Phase 4: Backfilling 14-day stats...');
    logger.info('');

    await backfillTimeBucketStats('character', 14);
    await backfillTimeBucketStats('corporation', 14);
    await backfillTimeBucketStats('alliance', 14);

    logger.info('');
    logger.success('✓ Phase 4 complete: 14-day stats');
    logger.info('');

    // Summary
    const overallDuration = Date.now() - overallStart;
    const minutes = Math.floor(overallDuration / 60000);
    const seconds = ((overallDuration % 60000) / 1000).toFixed(0);

    logger.info('='.repeat(80));
    logger.success('Backfill Complete!');
    logger.info('='.repeat(80));
    logger.info(`Total time: ${minutes}m ${seconds}s`);
    logger.info(`Total entities: ${totalEntities.toLocaleString()}`);
    logger.info('');
    logger.info('Next steps:');
    logger.info(
      '1. Verify data: SELECT COUNT(*), "entityType" FROM entity_stats_cache GROUP BY "entityType"'
    );
    logger.info(
      '2. Triggers are now active and will maintain stats in real-time'
    );
    logger.info(
      '3. Schedule daily cleanup job (see cronjobs/cleanup-stats-cache.ts)'
    );
    logger.info('');
  } catch {
    logger.error('Backfill failed:', error);
    throw error;
  }
}

// Export as CLI command
async function action() {
  try {
    await backfillStatsCache();
  } catch {
    logger.error('Backfill failed:', error);
    process.exit(1);
  } finally {
    await database.close();
    process.exit(0);
  }
}

export default () => ({
  description:
    'Backfill entity stats cache from existing killmails data (one-time operation, takes 1-2 hours)',
  action,
});

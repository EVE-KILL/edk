import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';

export default {
  description:
    'Full recalculation of entity stats cache (kills, losses, ISK, etc.)',
  options: [
    {
      flags: '--truncate',
      description: 'Truncate stats cache before starting (Recommended)',
    },
    {
      flags: '--start-year <year>',
      description: 'Start year (default: 2007)',
      defaultValue: '2007',
    },
    {
      flags: '--end-year <year>',
      description: 'End year (default: current year)',
    },
  ],
  action: async (options: {
    truncate?: boolean;
    startYear?: string;
    endYear?: string;
  }) => {
    const sql = database.sql;
    const startYear = parseInt(options.startYear || '2007');
    const endYear = options.endYear
      ? parseInt(options.endYear)
      : new Date().getFullYear();

    logger.info('Starting full entity stats recalculation', {
      truncate: !!options.truncate,
      range: `${startYear} - ${endYear}`,
    });

    if (options.truncate) {
      logger.warn('Truncating entity_stats_cache...');
      await sql`TRUNCATE TABLE entity_stats_cache`;
    }

    const overallStart = Date.now();

    // 1. Process All-Time Stats (Month by Month)
    for (let year = startYear; year <= endYear; year++) {
      for (let month = 1; month <= 12; month++) {
        // Skip future months
        const now = new Date();
        if (year === now.getFullYear() && month > now.getMonth() + 1) break;
        // Skip pre-2007-12
        if (year === 2007 && month < 12) continue;

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 1).toISOString().split('T')[0]; // Start of next month

        logger.info(`Processing ${startDate} to ${endDate}...`);
        const monthStart = Date.now();

        try {
          // Complex aggregation query
          // We aggregate victims and attackers separately, then upsert
          await sql`
            WITH monthly_stats AS (
              -- Victim Stats (Losses)
              SELECT
                "victimCharacterId" as id,
                'character' as type,
                0 as kills,
                1 as losses,
                0 as isk_destroyed,
                "totalValue" as isk_lost,
                0 as solo_kills,
                CASE WHEN solo THEN 1 ELSE 0 END as solo_losses,
                0 as npc_kills,
                CASE WHEN npc THEN 1 ELSE 0 END as npc_losses,
                "killmailTime" as last_activity
              FROM killmails
              WHERE "killmailTime" >= ${startDate}::timestamptz
                AND "killmailTime" < ${endDate}::timestamptz
                AND "victimCharacterId" IS NOT NULL

              UNION ALL

              SELECT
                "victimCorporationId" as id,
                'corporation' as type,
                0, 1, 0, "totalValue", 0, CASE WHEN solo THEN 1 ELSE 0 END, 0, CASE WHEN npc THEN 1 ELSE 0 END, "killmailTime"
              FROM killmails
              WHERE "killmailTime" >= ${startDate}::timestamptz
                AND "killmailTime" < ${endDate}::timestamptz
                AND "victimCorporationId" IS NOT NULL

              UNION ALL

              SELECT
                "victimAllianceId" as id,
                'alliance' as type,
                0, 1, 0, "totalValue", 0, CASE WHEN solo THEN 1 ELSE 0 END, 0, CASE WHEN npc THEN 1 ELSE 0 END, "killmailTime"
              FROM killmails
              WHERE "killmailTime" >= ${startDate}::timestamptz
                AND "killmailTime" < ${endDate}::timestamptz
                AND "victimAllianceId" IS NOT NULL

              UNION ALL

              SELECT
                "victimFactionId" as id,
                'faction' as type,
                0, 1, 0, "totalValue", 0, CASE WHEN solo THEN 1 ELSE 0 END, 0, CASE WHEN npc THEN 1 ELSE 0 END, "killmailTime"
              FROM killmails
              WHERE "killmailTime" >= ${startDate}::timestamptz
                AND "killmailTime" < ${endDate}::timestamptz
                AND "victimFactionId" IS NOT NULL

              UNION ALL

              SELECT
                "victimShipTypeId" as id,
                'type' as type,
                0, 1, 0, "totalValue", 0, CASE WHEN solo THEN 1 ELSE 0 END, 0, CASE WHEN npc THEN 1 ELSE 0 END, "killmailTime"
              FROM killmails
              WHERE "killmailTime" >= ${startDate}::timestamptz
                AND "killmailTime" < ${endDate}::timestamptz
                AND "victimShipTypeId" IS NOT NULL

              UNION ALL

              -- Attacker Stats (Kills)
              -- Note: Attackers table joined with killmails for flags/value
              SELECT
                a."characterId" as id,
                'character' as type,
                1 as kills,
                0 as losses,
                k."totalValue" as isk_destroyed,
                0 as isk_lost,
                CASE WHEN k.solo THEN 1 ELSE 0 END as solo_kills,
                0 as solo_losses,
                CASE WHEN k.npc THEN 1 ELSE 0 END as npc_kills,
                0 as npc_losses,
                k."killmailTime" as last_activity
              FROM attackers a
              JOIN killmails k ON a."killmailId" = k."killmailId" AND a."killmailTime" = k."killmailTime"
              WHERE k."killmailTime" >= ${startDate}::timestamptz
                AND k."killmailTime" < ${endDate}::timestamptz
                AND a."characterId" IS NOT NULL

              UNION ALL

              SELECT
                a."corporationId" as id,
                'corporation' as type,
                1, 0, k."totalValue", 0, CASE WHEN k.solo THEN 1 ELSE 0 END, 0, CASE WHEN k.npc THEN 1 ELSE 0 END, 0, k."killmailTime"
              FROM attackers a
              JOIN killmails k ON a."killmailId" = k."killmailId" AND a."killmailTime" = k."killmailTime"
              WHERE k."killmailTime" >= ${startDate}::timestamptz
                AND k."killmailTime" < ${endDate}::timestamptz
                AND a."corporationId" IS NOT NULL

              UNION ALL

              SELECT
                a."allianceId" as id,
                'alliance' as type,
                1, 0, k."totalValue", 0, CASE WHEN k.solo THEN 1 ELSE 0 END, 0, CASE WHEN k.npc THEN 1 ELSE 0 END, 0, k."killmailTime"
              FROM attackers a
              JOIN killmails k ON a."killmailId" = k."killmailId" AND a."killmailTime" = k."killmailTime"
              WHERE k."killmailTime" >= ${startDate}::timestamptz
                AND k."killmailTime" < ${endDate}::timestamptz
                AND a."allianceId" IS NOT NULL

              UNION ALL

              SELECT
                a."factionId" as id,
                'faction' as type,
                1, 0, k."totalValue", 0, CASE WHEN k.solo THEN 1 ELSE 0 END, 0, CASE WHEN k.npc THEN 1 ELSE 0 END, 0, k."killmailTime"
              FROM attackers a
              JOIN killmails k ON a."killmailId" = k."killmailId" AND a."killmailTime" = k."killmailTime"
              WHERE k."killmailTime" >= ${startDate}::timestamptz
                AND k."killmailTime" < ${endDate}::timestamptz
                AND a."factionId" IS NOT NULL

              UNION ALL

              SELECT
                a."shipTypeId" as id,
                'type' as type,
                1, 0, k."totalValue", 0, CASE WHEN k.solo THEN 1 ELSE 0 END, 0, CASE WHEN k.npc THEN 1 ELSE 0 END, 0, k."killmailTime"
              FROM attackers a
              JOIN killmails k ON a."killmailId" = k."killmailId" AND a."killmailTime" = k."killmailTime"
              WHERE k."killmailTime" >= ${startDate}::timestamptz
                AND k."killmailTime" < ${endDate}::timestamptz
                AND a."shipTypeId" IS NOT NULL
            ),
            aggregated AS (
              SELECT
                id,
                type,
                SUM(kills) as kills,
                SUM(losses) as losses,
                SUM(isk_destroyed) as isk_destroyed,
                SUM(isk_lost) as isk_lost,
                SUM(solo_kills) as solo_kills,
                SUM(solo_losses) as solo_losses,
                SUM(npc_kills) as npc_kills,
                SUM(npc_losses) as npc_losses,
                MAX(last_activity) as last_activity
              FROM monthly_stats
              GROUP BY id, type
            )
            INSERT INTO entity_stats_cache (
              "entityId", "entityType",
              "killsAll", "lossesAll", "iskDestroyedAll", "iskLostAll",
              "soloKillsAll", "soloLossesAll", "npcKillsAll", "npcLossesAll",
              "lastKillTime", "lastLossTime", "updatedAt"
            )
            SELECT
              id, type,
              kills, losses, isk_destroyed, isk_lost,
              solo_kills, solo_losses, npc_kills, npc_losses,
              CASE WHEN kills > 0 THEN last_activity ELSE NULL END,
              CASE WHEN losses > 0 THEN last_activity ELSE NULL END,
              NOW()
            FROM aggregated
            ON CONFLICT ("entityId", "entityType") DO UPDATE SET
              "killsAll" = entity_stats_cache."killsAll" + EXCLUDED."killsAll",
              "lossesAll" = entity_stats_cache."lossesAll" + EXCLUDED."lossesAll",
              "iskDestroyedAll" = entity_stats_cache."iskDestroyedAll" + EXCLUDED."iskDestroyedAll",
              "iskLostAll" = entity_stats_cache."iskLostAll" + EXCLUDED."iskLostAll",
              "soloKillsAll" = entity_stats_cache."soloKillsAll" + EXCLUDED."soloKillsAll",
              "soloLossesAll" = entity_stats_cache."soloLossesAll" + EXCLUDED."soloLossesAll",
              "npcKillsAll" = entity_stats_cache."npcKillsAll" + EXCLUDED."npcKillsAll",
              "npcLossesAll" = entity_stats_cache."npcLossesAll" + EXCLUDED."npcLossesAll",
              "lastKillTime" = GREATEST(entity_stats_cache."lastKillTime", EXCLUDED."lastKillTime"),
              "lastLossTime" = GREATEST(entity_stats_cache."lastLossTime", EXCLUDED."lastLossTime"),
              "updatedAt" = NOW()
          `;

          const elapsed = (Date.now() - monthStart) / 1000;
          logger.info(
            `  ✓ Completed ${startDate.substring(0, 7)} in ${elapsed.toFixed(2)}s`
          );
        } catch (error) {
          logger.error(`  ✗ Failed to process ${startDate}`, {
            error: String(error),
          });
        }
      }
    }

    // 2. Process Time Buckets (90d, 30d, 14d)
    // We only need to look at data from the last 90 days
    logger.info('Calculating time buckets (90d, 30d, 14d)...');
    const bucketStart = Date.now();

    try {
      // Reset buckets first (safe since we just recalculated All-Time or are about to overwrite)
      // If we didn't truncate, this clears old bucket data which is correct as we are fully recalculating
      await sql`
        UPDATE entity_stats_cache SET
          "kills90d" = 0, "losses90d" = 0, "iskDestroyed90d" = 0, "iskLost90d" = 0,
          "soloKills90d" = 0, "soloLosses90d" = 0, "npcKills90d" = 0, "npcLosses90d" = 0,
          "kills30d" = 0, "losses30d" = 0, "iskDestroyed30d" = 0, "iskLost30d" = 0,
          "soloKills30d" = 0, "soloLosses30d" = 0, "npcKills30d" = 0, "npcLosses30d" = 0,
          "kills14d" = 0, "losses14d" = 0, "iskDestroyed14d" = 0, "iskLost14d" = 0,
          "soloKills14d" = 0, "soloLosses14d" = 0, "npcKills14d" = 0, "npcLosses14d" = 0
      `;

      // Aggregate and update using a similar logic but filtered by date
      // We can do this in one massive query for the last 90 days since the data volume is smaller
      // than "All Time".
      const days90 = new Date();
      days90.setDate(days90.getDate() - 90);
      const start90d = days90.toISOString().split('T')[0];

      await sql`
        WITH recent_stats AS (
          -- Victim Stats (Losses)
          SELECT
            "victimCharacterId" as id, 'character' as type,
            "killmailTime" as km_time, "totalValue" as value,
            solo, npc, false as is_kill
          FROM killmails WHERE "killmailTime" >= ${start90d}::timestamptz AND "victimCharacterId" IS NOT NULL
          UNION ALL
          SELECT "victimCorporationId", 'corporation', "killmailTime", "totalValue", solo, npc, false
          FROM killmails WHERE "killmailTime" >= ${start90d}::timestamptz AND "victimCorporationId" IS NOT NULL
          UNION ALL
          SELECT "victimAllianceId", 'alliance', "killmailTime", "totalValue", solo, npc, false
          FROM killmails WHERE "killmailTime" >= ${start90d}::timestamptz AND "victimAllianceId" IS NOT NULL
          UNION ALL
          SELECT "victimFactionId", 'faction', "killmailTime", "totalValue", solo, npc, false
          FROM killmails WHERE "killmailTime" >= ${start90d}::timestamptz AND "victimFactionId" IS NOT NULL
          UNION ALL
          SELECT "victimShipTypeId", 'type', "killmailTime", "totalValue", solo, npc, false
          FROM killmails WHERE "killmailTime" >= ${start90d}::timestamptz AND "victimShipTypeId" IS NOT NULL

          UNION ALL

          -- Attacker Stats (Kills)
          SELECT
            a."characterId", 'character', k."killmailTime", k."totalValue", k.solo, k.npc, true
          FROM attackers a JOIN killmails k ON a."killmailId" = k."killmailId" AND a."killmailTime" = k."killmailTime"
          WHERE k."killmailTime" >= ${start90d}::timestamptz AND a."characterId" IS NOT NULL
          UNION ALL
          SELECT a."corporationId", 'corporation', k."killmailTime", k."totalValue", k.solo, k.npc, true
          FROM attackers a JOIN killmails k ON a."killmailId" = k."killmailId" AND a."killmailTime" = k."killmailTime"
          WHERE k."killmailTime" >= ${start90d}::timestamptz AND a."corporationId" IS NOT NULL
          UNION ALL
          SELECT a."allianceId", 'alliance', k."killmailTime", k."totalValue", k.solo, k.npc, true
          FROM attackers a JOIN killmails k ON a."killmailId" = k."killmailId" AND a."killmailTime" = k."killmailTime"
          WHERE k."killmailTime" >= ${start90d}::timestamptz AND a."allianceId" IS NOT NULL
          UNION ALL
          SELECT a."factionId", 'faction', k."killmailTime", k."totalValue", k.solo, k.npc, true
          FROM attackers a JOIN killmails k ON a."killmailId" = k."killmailId" AND a."killmailTime" = k."killmailTime"
          WHERE k."killmailTime" >= ${start90d}::timestamptz AND a."factionId" IS NOT NULL
          UNION ALL
          SELECT a."shipTypeId", 'type', k."killmailTime", k."totalValue", k.solo, k.npc, true
          FROM attackers a JOIN killmails k ON a."killmailId" = k."killmailId" AND a."killmailTime" = k."killmailTime"
          WHERE k."killmailTime" >= ${start90d}::timestamptz AND a."shipTypeId" IS NOT NULL
        ),
        aggregated_buckets AS (
          SELECT
            id, type,
            -- 90d
            COUNT(*) FILTER (WHERE is_kill) as kills90d,
            COUNT(*) FILTER (WHERE NOT is_kill) as losses90d,
            SUM(value) FILTER (WHERE is_kill) as iskDestroyed90d,
            SUM(value) FILTER (WHERE NOT is_kill) as iskLost90d,
            COUNT(*) FILTER (WHERE is_kill AND solo) as soloKills90d,
            COUNT(*) FILTER (WHERE NOT is_kill AND solo) as soloLosses90d,
            COUNT(*) FILTER (WHERE is_kill AND npc) as npcKills90d,
            COUNT(*) FILTER (WHERE NOT is_kill AND npc) as npcLosses90d,

            -- 30d (check age < 30 days)
            COUNT(*) FILTER (WHERE is_kill AND km_time >= NOW() - INTERVAL '30 days') as kills30d,
            COUNT(*) FILTER (WHERE NOT is_kill AND km_time >= NOW() - INTERVAL '30 days') as losses30d,
            SUM(value) FILTER (WHERE is_kill AND km_time >= NOW() - INTERVAL '30 days') as iskDestroyed30d,
            SUM(value) FILTER (WHERE NOT is_kill AND km_time >= NOW() - INTERVAL '30 days') as iskLost30d,
            COUNT(*) FILTER (WHERE is_kill AND solo AND km_time >= NOW() - INTERVAL '30 days') as soloKills30d,
            COUNT(*) FILTER (WHERE NOT is_kill AND solo AND km_time >= NOW() - INTERVAL '30 days') as soloLosses30d,
            COUNT(*) FILTER (WHERE is_kill AND npc AND km_time >= NOW() - INTERVAL '30 days') as npcKills30d,
            COUNT(*) FILTER (WHERE NOT is_kill AND npc AND km_time >= NOW() - INTERVAL '30 days') as npcLosses30d,

            -- 14d
            COUNT(*) FILTER (WHERE is_kill AND km_time >= NOW() - INTERVAL '14 days') as kills14d,
            COUNT(*) FILTER (WHERE NOT is_kill AND km_time >= NOW() - INTERVAL '14 days') as losses14d,
            SUM(value) FILTER (WHERE is_kill AND km_time >= NOW() - INTERVAL '14 days') as iskDestroyed14d,
            SUM(value) FILTER (WHERE NOT is_kill AND km_time >= NOW() - INTERVAL '14 days') as iskLost14d,
            COUNT(*) FILTER (WHERE is_kill AND solo AND km_time >= NOW() - INTERVAL '14 days') as soloKills14d,
            COUNT(*) FILTER (WHERE NOT is_kill AND solo AND km_time >= NOW() - INTERVAL '14 days') as soloLosses14d,
            COUNT(*) FILTER (WHERE is_kill AND npc AND km_time >= NOW() - INTERVAL '14 days') as npcKills14d,
            COUNT(*) FILTER (WHERE NOT is_kill AND npc AND km_time >= NOW() - INTERVAL '14 days') as npcLosses14d

          FROM recent_stats
          GROUP BY id, type
        )
        UPDATE entity_stats_cache c
        SET
          "kills90d" = a.kills90d, "losses90d" = a.losses90d, "iskDestroyed90d" = COALESCE(a.iskDestroyed90d, 0), "iskLost90d" = COALESCE(a.iskLost90d, 0),
          "soloKills90d" = a.soloKills90d, "soloLosses90d" = a.soloLosses90d, "npcKills90d" = a.npcKills90d, "npcLosses90d" = a.npcLosses90d,

          "kills30d" = a.kills30d, "losses30d" = a.losses30d, "iskDestroyed30d" = COALESCE(a.iskDestroyed30d, 0), "iskLost30d" = COALESCE(a.iskLost30d, 0),
          "soloKills30d" = a.soloKills30d, "soloLosses30d" = a.soloLosses30d, "npcKills30d" = a.npcKills30d, "npcLosses30d" = a.npcLosses30d,

          "kills14d" = a.kills14d, "losses14d" = a.losses14d, "iskDestroyed14d" = COALESCE(a.iskDestroyed14d, 0), "iskLost14d" = COALESCE(a.iskLost14d, 0),
          "soloKills14d" = a.soloKills14d, "soloLosses14d" = a.soloLosses14d, "npcKills14d" = a.npcKills14d, "npcLosses14d" = a.npcLosses14d
        FROM aggregated_buckets a
        WHERE c."entityId" = a.id AND c."entityType" = a.type
      `;

      logger.info(
        `✓ Buckets calculated in ${((Date.now() - bucketStart) / 1000).toFixed(2)}s`
      );
    } catch (error) {
      logger.error('✗ Failed to calculate buckets', { error: String(error) });
    }

    const totalTime = (Date.now() - overallStart) / 1000;
    logger.success(`Stats recalculation complete in ${totalTime.toFixed(2)}s`);
    process.exit(0);
  },
};

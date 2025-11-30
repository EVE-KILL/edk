import { database } from '../helpers/database';
import { logger } from '../helpers/logger';

/**
 * Entity Stats Update Model
 *
 * Handles updating the entity_stats_cache table for killmails.
 * Replaces the database trigger with queue-based processing.
 */

export interface EntityStatsUpdate {
  entityId: number;
  entityType:
    | 'character'
    | 'corporation'
    | 'alliance'
    | 'faction'
    | 'group'
    | 'type';
  isKill: boolean; // true = kill (attacker), false = loss (victim)
}

/**
 * Calculate which time buckets a killmail falls into based on age
 */
function calculateTimeBuckets(killmailTime: Date): {
  in90d: boolean;
  in30d: boolean;
  in14d: boolean;
} {
  const ageMs = Date.now() - killmailTime.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  return {
    in90d: ageDays <= 90,
    in30d: ageDays <= 30,
    in14d: ageDays <= 14,
  };
}

/**
 * Upsert entity stats for a single entity
 * This is the TypeScript equivalent of the SQL upsert_entity_stats() function
 */
export async function upsertEntityStats(
  entityId: number,
  entityType: string,
  killmailTime: Date,
  totalValue: number,
  isKill: boolean,
  isSolo: boolean,
  isNpc: boolean
): Promise<void> {
  // Skip NULL entity IDs
  if (!entityId) return;

  const { in90d, in30d, in14d } = calculateTimeBuckets(killmailTime);

  const sql = database.sql;

  // Build the increment values based on conditions
  const killsAll = isKill ? 1 : 0;
  const lossesAll = !isKill ? 1 : 0;
  const iskDestroyedAll = isKill ? totalValue : 0;
  const iskLostAll = !isKill ? totalValue : 0;
  const soloKillsAll = isKill && isSolo ? 1 : 0;
  const soloLossesAll = !isKill && isSolo ? 1 : 0;
  const npcKillsAll = isKill && isNpc ? 1 : 0;
  const npcLossesAll = !isKill && isNpc ? 1 : 0;

  const kills90d = isKill && in90d ? 1 : 0;
  const losses90d = !isKill && in90d ? 1 : 0;
  const iskDestroyed90d = isKill && in90d ? totalValue : 0;
  const iskLost90d = !isKill && in90d ? totalValue : 0;
  const soloKills90d = isKill && isSolo && in90d ? 1 : 0;
  const soloLosses90d = !isKill && isSolo && in90d ? 1 : 0;
  const npcKills90d = isKill && isNpc && in90d ? 1 : 0;
  const npcLosses90d = !isKill && isNpc && in90d ? 1 : 0;

  const kills30d = isKill && in30d ? 1 : 0;
  const losses30d = !isKill && in30d ? 1 : 0;
  const iskDestroyed30d = isKill && in30d ? totalValue : 0;
  const iskLost30d = !isKill && in30d ? totalValue : 0;
  const soloKills30d = isKill && isSolo && in30d ? 1 : 0;
  const soloLosses30d = !isKill && isSolo && in30d ? 1 : 0;
  const npcKills30d = isKill && isNpc && in30d ? 1 : 0;
  const npcLosses30d = !isKill && isNpc && in30d ? 1 : 0;

  const kills14d = isKill && in14d ? 1 : 0;
  const losses14d = !isKill && in14d ? 1 : 0;
  const iskDestroyed14d = isKill && in14d ? totalValue : 0;
  const iskLost14d = !isKill && in14d ? totalValue : 0;
  const soloKills14d = isKill && isSolo && in14d ? 1 : 0;
  const soloLosses14d = !isKill && isSolo && in14d ? 1 : 0;
  const npcKills14d = isKill && isNpc && in14d ? 1 : 0;
  const npcLosses14d = !isKill && isNpc && in14d ? 1 : 0;

  const lastKillTime = isKill ? killmailTime : null;
  const lastLossTime = !isKill ? killmailTime : null;

  await sql`
    INSERT INTO entity_stats_cache (
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
      "kills90d",
      "losses90d",
      "iskDestroyed90d",
      "iskLost90d",
      "soloKills90d",
      "soloLosses90d",
      "npcKills90d",
      "npcLosses90d",
      "kills30d",
      "losses30d",
      "iskDestroyed30d",
      "iskLost30d",
      "soloKills30d",
      "soloLosses30d",
      "npcKills30d",
      "npcLosses30d",
      "kills14d",
      "losses14d",
      "iskDestroyed14d",
      "iskLost14d",
      "soloKills14d",
      "soloLosses14d",
      "npcKills14d",
      "npcLosses14d",
      "lastKillTime",
      "lastLossTime",
      "updatedAt"
    ) VALUES (
      ${entityId},
      ${entityType},
      ${killsAll},
      ${lossesAll},
      ${iskDestroyedAll},
      ${iskLostAll},
      ${soloKillsAll},
      ${soloLossesAll},
      ${npcKillsAll},
      ${npcLossesAll},
      ${kills90d},
      ${losses90d},
      ${iskDestroyed90d},
      ${iskLost90d},
      ${soloKills90d},
      ${soloLosses90d},
      ${npcKills90d},
      ${npcLosses90d},
      ${kills30d},
      ${losses30d},
      ${iskDestroyed30d},
      ${iskLost30d},
      ${soloKills30d},
      ${soloLosses30d},
      ${npcKills30d},
      ${npcLosses30d},
      ${kills14d},
      ${losses14d},
      ${iskDestroyed14d},
      ${iskLost14d},
      ${soloKills14d},
      ${soloLosses14d},
      ${npcKills14d},
      ${npcLosses14d},
      ${lastKillTime},
      ${lastLossTime},
      NOW()
    )
    ON CONFLICT ("entityId", "entityType") DO UPDATE SET
      "killsAll" = entity_stats_cache."killsAll" + ${killsAll},
      "lossesAll" = entity_stats_cache."lossesAll" + ${lossesAll},
      "iskDestroyedAll" = entity_stats_cache."iskDestroyedAll" + ${iskDestroyedAll},
      "iskLostAll" = entity_stats_cache."iskLostAll" + ${iskLostAll},
      "soloKillsAll" = entity_stats_cache."soloKillsAll" + ${soloKillsAll},
      "soloLossesAll" = entity_stats_cache."soloLossesAll" + ${soloLossesAll},
      "npcKillsAll" = entity_stats_cache."npcKillsAll" + ${npcKillsAll},
      "npcLossesAll" = entity_stats_cache."npcLossesAll" + ${npcLossesAll},

      "kills90d" = entity_stats_cache."kills90d" + ${kills90d},
      "losses90d" = entity_stats_cache."losses90d" + ${losses90d},
      "iskDestroyed90d" = entity_stats_cache."iskDestroyed90d" + ${iskDestroyed90d},
      "iskLost90d" = entity_stats_cache."iskLost90d" + ${iskLost90d},
      "soloKills90d" = entity_stats_cache."soloKills90d" + ${soloKills90d},
      "soloLosses90d" = entity_stats_cache."soloLosses90d" + ${soloLosses90d},
      "npcKills90d" = entity_stats_cache."npcKills90d" + ${npcKills90d},
      "npcLosses90d" = entity_stats_cache."npcLosses90d" + ${npcLosses90d},

      "kills30d" = entity_stats_cache."kills30d" + ${kills30d},
      "losses30d" = entity_stats_cache."losses30d" + ${losses30d},
      "iskDestroyed30d" = entity_stats_cache."iskDestroyed30d" + ${iskDestroyed30d},
      "iskLost30d" = entity_stats_cache."iskLost30d" + ${iskLost30d},
      "soloKills30d" = entity_stats_cache."soloKills30d" + ${soloKills30d},
      "soloLosses30d" = entity_stats_cache."soloLosses30d" + ${soloLosses30d},
      "npcKills30d" = entity_stats_cache."npcKills30d" + ${npcKills30d},
      "npcLosses30d" = entity_stats_cache."npcLosses30d" + ${npcLosses30d},

      "kills14d" = entity_stats_cache."kills14d" + ${kills14d},
      "losses14d" = entity_stats_cache."losses14d" + ${losses14d},
      "iskDestroyed14d" = entity_stats_cache."iskDestroyed14d" + ${iskDestroyed14d},
      "iskLost14d" = entity_stats_cache."iskLost14d" + ${iskLost14d},
      "soloKills14d" = entity_stats_cache."soloKills14d" + ${soloKills14d},
      "soloLosses14d" = entity_stats_cache."soloLosses14d" + ${soloLosses14d},
      "npcKills14d" = entity_stats_cache."npcKills14d" + ${npcKills14d},
      "npcLosses14d" = entity_stats_cache."npcLosses14d" + ${npcLosses14d},

      "lastKillTime" = CASE
        WHEN ${isKill} THEN GREATEST(entity_stats_cache."lastKillTime", ${killmailTime})
        ELSE entity_stats_cache."lastKillTime"
      END,
      "lastLossTime" = CASE
        WHEN ${!isKill} THEN GREATEST(entity_stats_cache."lastLossTime", ${killmailTime})
        ELSE entity_stats_cache."lastLossTime"
      END,
      "updatedAt" = NOW()
  `;
}

/**
 * Batch update entity stats for multiple entities from a single killmail
 * More efficient than calling upsertEntityStats multiple times
 */
export async function batchUpsertEntityStats(
  entities: EntityStatsUpdate[],
  killmailTime: Date,
  totalValue: number,
  isSolo: boolean,
  isNpc: boolean
): Promise<void> {
  if (entities.length === 0) return;

  try {
    // Process all entities in a single transaction
    const sql = database.sql;
    await sql.begin(async (_sql) => {
      for (const entity of entities) {
        if (!entity.entityId) continue;

        await upsertEntityStats(
          entity.entityId,
          entity.entityType,
          killmailTime,
          totalValue,
          entity.isKill,
          isSolo,
          isNpc
        );
      }
    });

    logger.info(`[EntityStats] Updated stats for ${entities.length} entities`, {
      killmailTime: killmailTime.toISOString(),
      totalValue,
    });
  } catch (error) {
    logger.error('[EntityStats] Failed to batch update entity stats', {
      error,
      entityCount: entities.length,
    });
    throw error;
  }
}

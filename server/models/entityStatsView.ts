import { database } from '../helpers/database';

/**
 * Entity Stats View Model
 *
 * Uses the character_stats, corporation_stats, and alliance_stats views
 * for efficient entity statistics queries.
 *
 * The views are regular (non-materialized) views that PostgreSQL query planner
 * can optimize when filtered by entity ID.
 */

export interface EntityStatsFromView {
  entityId: number;
  entityType: 'character' | 'corporation' | 'alliance';

  // Kill/Loss counts
  kills: number;
  losses: number;

  // ISK statistics
  iskDestroyed: number;
  iskLost: number;

  // Efficiency metrics
  efficiency: number; // (iskDestroyed / (iskDestroyed + iskLost)) * 100
  killLossRatio: number; // kills / losses (0 if no losses)

  // Combat metrics
  soloKills: number;
  soloLosses: number;
  npcKills: number;
  npcLosses: number;

  // Last activity
  lastKillTime: Date | null;
  lastLossTime: Date | null;
  lastActivityTime: Date | null;
}

/**
 * Get all-time stats for a character
 */
export async function getCharacterStatsFromView(
  characterId: number
): Promise<EntityStatsFromView | null> {
  const result = await database.findOne<any>(
    `SELECT
      "characterId" as "entityId",
      "entityType",
      kills,
      losses,
      "iskDestroyed",
      "iskLost",
      efficiency,
      "killLossRatio",
      "soloKills",
      "soloLosses",
      "npcKills",
      "npcLosses",
      "lastKillTime",
      "lastLossTime",
      "lastActivityTime"
    FROM character_stats
    WHERE "characterId" = :characterId`,
    { characterId }
  );

  if (!result) return null;

  return {
    entityId: result.entityId,
    entityType: 'character',
    kills: Number(result.kills || 0),
    losses: Number(result.losses || 0),
    iskDestroyed: Number(result.iskDestroyed || 0),
    iskLost: Number(result.iskLost || 0),
    efficiency: Number(result.efficiency || 0),
    killLossRatio: Number(result.killLossRatio || 0),
    soloKills: Number(result.soloKills || 0),
    soloLosses: Number(result.soloLosses || 0),
    npcKills: Number(result.npcKills || 0),
    npcLosses: Number(result.npcLosses || 0),
    lastKillTime: result.lastKillTime,
    lastLossTime: result.lastLossTime,
    lastActivityTime: result.lastActivityTime,
  };
}

/**
 * Get all-time stats for a corporation
 */
export async function getCorporationStatsFromView(
  corporationId: number
): Promise<EntityStatsFromView | null> {
  const result = await database.findOne<any>(
    `SELECT
      "corporationId" as "entityId",
      "entityType",
      kills,
      losses,
      "iskDestroyed",
      "iskLost",
      efficiency,
      "killLossRatio",
      "soloKills",
      "soloLosses",
      "npcKills",
      "npcLosses",
      "lastKillTime",
      "lastLossTime",
      "lastActivityTime"
    FROM corporation_stats
    WHERE "corporationId" = :corporationId`,
    { corporationId }
  );

  if (!result) return null;

  return {
    entityId: result.entityId,
    entityType: 'corporation',
    kills: Number(result.kills || 0),
    losses: Number(result.losses || 0),
    iskDestroyed: Number(result.iskDestroyed || 0),
    iskLost: Number(result.iskLost || 0),
    efficiency: Number(result.efficiency || 0),
    killLossRatio: Number(result.killLossRatio || 0),
    soloKills: Number(result.soloKills || 0),
    soloLosses: Number(result.soloLosses || 0),
    npcKills: Number(result.npcKills || 0),
    npcLosses: Number(result.npcLosses || 0),
    lastKillTime: result.lastKillTime,
    lastLossTime: result.lastLossTime,
    lastActivityTime: result.lastActivityTime,
  };
}

/**
 * Get all-time stats for an alliance
 */
export async function getAllianceStatsFromView(
  allianceId: number
): Promise<EntityStatsFromView | null> {
  const result = await database.findOne<any>(
    `SELECT
      "allianceId" as "entityId",
      "entityType",
      kills,
      losses,
      "iskDestroyed",
      "iskLost",
      efficiency,
      "killLossRatio",
      "soloKills",
      "soloLosses",
      "npcKills",
      "npcLosses",
      "lastKillTime",
      "lastLossTime",
      "lastActivityTime"
    FROM alliance_stats
    WHERE "allianceId" = :allianceId`,
    { allianceId }
  );

  if (!result) return null;

  return {
    entityId: result.entityId,
    entityType: 'alliance',
    kills: Number(result.kills || 0),
    losses: Number(result.losses || 0),
    iskDestroyed: Number(result.iskDestroyed || 0),
    iskLost: Number(result.iskLost || 0),
    efficiency: Number(result.efficiency || 0),
    killLossRatio: Number(result.killLossRatio || 0),
    soloKills: Number(result.soloKills || 0),
    soloLosses: Number(result.soloLosses || 0),
    npcKills: Number(result.npcKills || 0),
    npcLosses: Number(result.npcLosses || 0),
    lastKillTime: result.lastKillTime,
    lastLossTime: result.lastLossTime,
    lastActivityTime: result.lastActivityTime,
  };
}

/**
 * Get time-filtered stats for any entity type (last N days)
 * Uses inline query rather than view to add time filter based on killmailTime
 */
export async function getEntityStatsTimeFiltered(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  days: number = 7
): Promise<EntityStatsFromView | null> {
  let killsColumn = '"topAttackerCharacterId"';
  let lossesColumn = '"victimCharacterId"';

  if (entityType === 'corporation') {
    killsColumn = '"topAttackerCorporationId"';
    lossesColumn = '"victimCorporationId"';
  } else if (entityType === 'alliance') {
    killsColumn = '"topAttackerAllianceId"';
    lossesColumn = '"victimAllianceId"';
  }

  const result = await database.findOne<any>(
    `WITH entity_kills AS (
      SELECT
        COUNT(*) AS kills,
        SUM("totalValue") AS "iskDestroyed",
        SUM(CASE WHEN solo THEN 1 ELSE 0 END) AS "soloKills",
        SUM(CASE WHEN npc THEN 1 ELSE 0 END) AS "npcKills",
        MAX("killmailTime") AS "lastKillTime"
      FROM killmails
      WHERE ${killsColumn} = :entityId
        AND "killmailTime" >= NOW() - INTERVAL '${days} days'
    ),
    entity_losses AS (
      SELECT
        COUNT(*) AS losses,
        SUM("totalValue") AS "iskLost",
        SUM(CASE WHEN solo THEN 1 ELSE 0 END) AS "soloLosses",
        SUM(CASE WHEN npc THEN 1 ELSE 0 END) AS "npcLosses",
        MAX("killmailTime") AS "lastLossTime"
      FROM killmails
      WHERE ${lossesColumn} = :entityId
        AND "killmailTime" >= NOW() - INTERVAL '${days} days'
    )
    SELECT
      :entityId as "entityId",
      :entityType as "entityType",
      COALESCE(kills.kills, 0) AS kills,
      COALESCE(losses.losses, 0) AS losses,
      COALESCE(kills."iskDestroyed", 0) AS "iskDestroyed",
      COALESCE(losses."iskLost", 0) AS "iskLost",
      CASE
        WHEN COALESCE(kills."iskDestroyed", 0) + COALESCE(losses."iskLost", 0) > 0
        THEN (COALESCE(kills."iskDestroyed", 0) / (COALESCE(kills."iskDestroyed", 0) + COALESCE(losses."iskLost", 0))) * 100
        ELSE 0
      END AS efficiency,
      CASE
        WHEN COALESCE(losses.losses, 0) > 0
        THEN COALESCE(kills.kills, 0)::numeric / losses.losses
        ELSE COALESCE(kills.kills, 0)
      END AS "killLossRatio",
      COALESCE(kills."soloKills", 0) AS "soloKills",
      COALESCE(losses."soloLosses", 0) AS "soloLosses",
      COALESCE(kills."npcKills", 0) AS "npcKills",
      COALESCE(losses."npcLosses", 0) AS "npcLosses",
      kills."lastKillTime",
      losses."lastLossTime",
      GREATEST(kills."lastKillTime", losses."lastLossTime") AS "lastActivityTime"
    FROM entity_kills kills, entity_losses losses`,
    { entityId, entityType }
  );

  if (!result) return null;

  return {
    entityId: result.entityId,
    entityType: result.entityType,
    kills: Number(result.kills || 0),
    losses: Number(result.losses || 0),
    iskDestroyed: Number(result.iskDestroyed || 0),
    iskLost: Number(result.iskLost || 0),
    efficiency: Number(result.efficiency || 0),
    killLossRatio: Number(result.killLossRatio || 0),
    soloKills: Number(result.soloKills || 0),
    soloLosses: Number(result.soloLosses || 0),
    npcKills: Number(result.npcKills || 0),
    npcLosses: Number(result.npcLosses || 0),
    lastKillTime: result.lastKillTime,
    lastLossTime: result.lastLossTime,
    lastActivityTime: result.lastActivityTime,
  };
}

/**
 * Unified function to get entity stats from view
 * Matches the interface of getEntityStats but uses views
 */
export async function getEntityStatsFromView(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  periodType: 'hour' | 'day' | 'week' | 'month' | 'all' = 'all'
): Promise<EntityStatsFromView | null> {
  // For time-filtered queries, we need to use direct queries (not the all-time view)
  if (periodType !== 'all') {
    let days = 0;
    switch (periodType) {
      case 'hour':
        days = 0; // Less than 1 day, use fraction
        break;
      case 'day':
        days = 1;
        break;
      case 'week':
        days = 7;
        break;
      case 'month':
        days = 30;
        break;
    }

    // Use time-filtered query for all entity types
    return getEntityStatsTimeFiltered(entityId, entityType, days);
  }

  // For all-time stats, use the views
  switch (entityType) {
    case 'character':
      return getCharacterStatsFromView(entityId);
    case 'corporation':
      return getCorporationStatsFromView(entityId);
    case 'alliance':
      return getAllianceStatsFromView(entityId);
    default:
      return null;
  }
}

/**
 * Get top N entities by kills (using the views)
 */
export async function getTopEntitiesByKillsFromView(
  entityType: 'character' | 'corporation' | 'alliance',
  limit: number = 100
): Promise<EntityStatsFromView[]> {
  let viewName = 'character_stats';
  let idColumn = 'characterId';

  if (entityType === 'corporation') {
    viewName = 'corporation_stats';
    idColumn = 'corporationId';
  } else if (entityType === 'alliance') {
    viewName = 'alliance_stats';
    idColumn = 'allianceId';
  }

  const results = await database.find<any>(
    `SELECT
      "${idColumn}" as "entityId",
      "entityType",
      kills,
      losses,
      "iskDestroyed",
      "iskLost",
      efficiency,
      "killLossRatio",
      "soloKills",
      "soloLosses",
      "npcKills",
      "npcLosses",
      "lastKillTime",
      "lastLossTime",
      "lastActivityTime"
    FROM ${database.identifier(viewName)}
    WHERE kills > 0
    ORDER BY kills DESC
    LIMIT :limit`,
    { limit }
  );

  return results.map((r) => ({
    entityId: r.entityId,
    entityType: r.entityType,
    kills: Number(r.kills || 0),
    losses: Number(r.losses || 0),
    iskDestroyed: Number(r.iskDestroyed || 0),
    iskLost: Number(r.iskLost || 0),
    efficiency: Number(r.efficiency || 0),
    killLossRatio: Number(r.killLossRatio || 0),
    soloKills: Number(r.soloKills || 0),
    soloLosses: Number(r.soloLosses || 0),
    npcKills: Number(r.npcKills || 0),
    npcLosses: Number(r.npcLosses || 0),
    lastKillTime: r.lastKillTime,
    lastLossTime: r.lastLossTime,
    lastActivityTime: r.lastActivityTime,
  }));
}

import { database } from '../helpers/database';

/**
 * Entity Stats Cache Model
 * 
 * High-performance pre-calculated entity statistics
 * Updated in real-time via triggers on killmails table
 * Supports all-time, 90d, 30d, and 14d time periods
 */

export interface EntityStatsCache {
  entityId: number;
  entityType: 'character' | 'corporation' | 'alliance';

  // Kill/Loss counts
  kills: number;
  losses: number;

  // ISK statistics
  iskDestroyed: number;
  iskLost: number;

  // Efficiency metrics (calculated)
  efficiency: number; // (iskDestroyed / (iskDestroyed + iskLost)) * 100
  iskEfficiency: number; // same as efficiency
  killLossRatio: number; // kills / losses

  // Combat metrics
  soloKills: number;
  soloLosses: number;
  npcKills: number;
  npcLosses: number;

  // Activity timestamps
  lastKillTime: Date | null;
  lastLossTime: Date | null;
}

/**
 * Map time period to column suffix
 */
function getPeriodSuffix(period: 'all' | '90d' | '30d' | '14d'): string {
  if (period === 'all') return 'All';
  return period.replace('d', 'd'); // 90d -> 90d, 30d -> 30d, 14d -> 14d
}

/**
 * Calculate derived stats from raw data
 */
function calculateDerivedStats(stats: any): EntityStatsCache {
  const efficiency =
    Number(stats.iskDestroyed) + Number(stats.iskLost) > 0
      ? (Number(stats.iskDestroyed) /
          (Number(stats.iskDestroyed) + Number(stats.iskLost))) *
        100
      : 0;

  const killLossRatio =
    Number(stats.losses) > 0 ? Number(stats.kills) / Number(stats.losses) : Number(stats.kills);

  return {
    entityId: stats.entityId,
    entityType: stats.entityType,
    kills: Number(stats.kills || 0),
    losses: Number(stats.losses || 0),
    iskDestroyed: Number(stats.iskDestroyed || 0),
    iskLost: Number(stats.iskLost || 0),
    efficiency,
    iskEfficiency: efficiency,
    killLossRatio,
    soloKills: Number(stats.soloKills || 0),
    soloLosses: Number(stats.soloLosses || 0),
    npcKills: Number(stats.npcKills || 0),
    npcLosses: Number(stats.npcLosses || 0),
    lastKillTime: stats.lastKillTime,
    lastLossTime: stats.lastLossTime,
  };
}

/**
 * Get entity stats from cache
 */
export async function getEntityStatsFromCache(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  period: 'all' | '90d' | '30d' | '14d' = 'all'
): Promise<EntityStatsCache | null> {
  const suffix = getPeriodSuffix(period);
  
  // When fetching 'all' stats, also include time-period breakdowns
  const timePeriodsSelect = period === 'all' ? `
    "kills30d",
    "losses30d",
    "kills14d",
    "losses14d",
  ` : '';
  
  const result = await database.findOne<any>(
    `SELECT
      "entityId",
      "entityType",
      "kills${suffix}" as kills,
      "losses${suffix}" as losses,
      "iskDestroyed${suffix}" as "iskDestroyed",
      "iskLost${suffix}" as "iskLost",
      "soloKills${suffix}" as "soloKills",
      "soloLosses${suffix}" as "soloLosses",
      "npcKills${suffix}" as "npcKills",
      "npcLosses${suffix}" as "npcLosses",
      ${timePeriodsSelect}
      "lastKillTime",
      "lastLossTime"
    FROM entity_stats_cache
    WHERE "entityId" = :entityId
      AND "entityType" = :entityType`,
    { entityId, entityType }
  );

  if (!result) return null;

  const baseStats = calculateDerivedStats(result);
  
  // Add time period data and K/L ratios when period is 'all'
  if (period === 'all' && result.kills30d !== undefined) {
    const killLossRatio30d = result.losses30d > 0 ? result.kills30d / result.losses30d : result.kills30d || 0;
    const killLossRatio7d = result.losses14d > 0 ? result.kills14d / result.losses14d : result.kills14d || 0;
    
    return {
      ...baseStats,
      kills30d: result.kills30d,
      losses30d: result.losses30d,
      kills14d: result.kills14d,
      losses14d: result.losses14d,
      kills7d: result.kills14d, // Use 14d as 7d proxy for now
      losses7d: result.losses14d,
      killLossRatio30d,
      killLossRatio7d,
    } as any;
  }

  return baseStats;
}

/**
 * Get character stats from cache
 */
export async function getCharacterStatsFromCache(
  characterId: number,
  period: 'all' | '90d' | '30d' | '14d' = 'all'
): Promise<EntityStatsCache | null> {
  return getEntityStatsFromCache(characterId, 'character', period);
}

/**
 * Get corporation stats from cache
 */
export async function getCorporationStatsFromCache(
  corporationId: number,
  period: 'all' | '90d' | '30d' | '14d' = 'all'
): Promise<EntityStatsCache | null> {
  return getEntityStatsFromCache(corporationId, 'corporation', period);
}

/**
 * Get alliance stats from cache
 */
export async function getAllianceStatsFromCache(
  allianceId: number,
  period: 'all' | '90d' | '30d' | '14d' = 'all'
): Promise<EntityStatsCache | null> {
  return getEntityStatsFromCache(allianceId, 'alliance', period);
}

/**
 * Get top entities by kills from cache
 */
export async function getTopEntitiesByKillsFromCache(
  entityType: 'character' | 'corporation' | 'alliance',
  period: 'all' | '90d' | '30d' | '14d' = 'all',
  limit: number = 100
): Promise<EntityStatsCache[]> {
  const suffix = getPeriodSuffix(period);
  
  const results = await database.find<any>(
    `SELECT
      "entityId",
      "entityType",
      "kills${suffix}" as kills,
      "losses${suffix}" as losses,
      "iskDestroyed${suffix}" as "iskDestroyed",
      "iskLost${suffix}" as "iskLost",
      "soloKills${suffix}" as "soloKills",
      "soloLosses${suffix}" as "soloLosses",
      "npcKills${suffix}" as "npcKills",
      "npcLosses${suffix}" as "npcLosses",
      "lastKillTime",
      "lastLossTime"
    FROM entity_stats_cache
    WHERE "entityType" = :entityType
      AND "kills${suffix}" > 0
    ORDER BY "kills${suffix}" DESC
    LIMIT :limit`,
    { entityType, limit }
  );

  return results.map(calculateDerivedStats);
}

/**
 * Get top entities by efficiency from cache
 */
export async function getTopEntitiesByEfficiencyFromCache(
  entityType: 'character' | 'corporation' | 'alliance',
  period: 'all' | '90d' | '30d' | '14d' = 'all',
  minKills: number = 10,
  limit: number = 100
): Promise<EntityStatsCache[]> {
  const suffix = getPeriodSuffix(period);
  
  const results = await database.find<any>(
    `SELECT
      "entityId",
      "entityType",
      "kills${suffix}" as kills,
      "losses${suffix}" as losses,
      "iskDestroyed${suffix}" as "iskDestroyed",
      "iskLost${suffix}" as "iskLost",
      "soloKills${suffix}" as "soloKills",
      "soloLosses${suffix}" as "soloLosses",
      "npcKills${suffix}" as "npcKills",
      "npcLosses${suffix}" as "npcLosses",
      "lastKillTime",
      "lastLossTime",
      CASE
        WHEN "iskDestroyed${suffix}" + "iskLost${suffix}" > 0
        THEN ("iskDestroyed${suffix}" / ("iskDestroyed${suffix}" + "iskLost${suffix}")) * 100
        ELSE 0
      END as efficiency
    FROM entity_stats_cache
    WHERE "entityType" = :entityType
      AND "kills${suffix}" >= :minKills
    ORDER BY efficiency DESC
    LIMIT :limit`,
    { entityType, minKills, limit }
  );

  return results.map(calculateDerivedStats);
}

/**
 * Get multiple entity stats from cache in a single query
 */
export async function getMultipleEntityStatsFromCache(
  entities: Array<{ entityId: number; entityType: 'character' | 'corporation' | 'alliance' }>,
  period: 'all' | '90d' | '30d' | '14d' = 'all'
): Promise<EntityStatsCache[]> {
  if (entities.length === 0) return [];

  const suffix = getPeriodSuffix(period);
  
  // Build OR conditions for each entity
  const conditions = entities.map((_, idx) => 
    `("entityId" = :entityId${idx} AND "entityType" = :entityType${idx})`
  ).join(' OR ');
  
  const params: Record<string, any> = {};
  entities.forEach((entity, idx) => {
    params[`entityId${idx}`] = entity.entityId;
    params[`entityType${idx}`] = entity.entityType;
  });
  
  const results = await database.find<any>(
    `SELECT
      "entityId",
      "entityType",
      "kills${suffix}" as kills,
      "losses${suffix}" as losses,
      "iskDestroyed${suffix}" as "iskDestroyed",
      "iskLost${suffix}" as "iskLost",
      "soloKills${suffix}" as "soloKills",
      "soloLosses${suffix}" as "soloLosses",
      "npcKills${suffix}" as "npcKills",
      "npcLosses${suffix}" as "npcLosses",
      "lastKillTime",
      "lastLossTime"
    FROM entity_stats_cache
    WHERE ${conditions}`,
    params
  );

  return results.map(calculateDerivedStats);
}

/**
 * Check if stats cache is populated
 * Uses EXISTS which stops at first row (very fast)
 */
export async function isStatsCachePopulated(): Promise<boolean> {
  const result = await database.findOne<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM entity_stats_cache LIMIT 1) as exists'
  );
  return result?.exists || false;
}

/**
 * Get stats cache summary
 */
export async function getStatsCacheSummary(): Promise<{
  characters: number;
  corporations: number;
  alliances: number;
  total: number;
  sizeBytes: number;
  sizePretty: string;
}> {
  const counts = await database.find<{ entityType: string; count: number }>(
    `SELECT "entityType", COUNT(*) as count
     FROM entity_stats_cache
     GROUP BY "entityType"`
  );

  const size = await database.findOne<{ size: number }>(
    `SELECT pg_total_relation_size('entity_stats_cache') as size`
  );

  const characters = counts.find((c) => c.entityType === 'character')?.count || 0;
  const corporations = counts.find((c) => c.entityType === 'corporation')?.count || 0;
  const alliances = counts.find((c) => c.entityType === 'alliance')?.count || 0;
  const total = characters + corporations + alliances;
  const sizeBytes = Number(size?.size || 0);

  // Format size
  let sizePretty = '0 B';
  if (sizeBytes > 0) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let fileSize = sizeBytes;
    while (fileSize >= 1024 && unitIndex < units.length - 1) {
      fileSize /= 1024;
      unitIndex++;
    }
    sizePretty = `${fileSize.toFixed(2)} ${units[unitIndex]}`;
  }

  return {
    characters,
    corporations,
    alliances,
    total,
    sizeBytes,
    sizePretty,
  };
}

/**
 * Get entity stats with all time periods combined
 * Returns all-time stats with additional time-based fields
 */
export async function getEntityStatsWithPeriods(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance'
): Promise<EntityStatsCache & { kills30d?: number; kills14d?: number; kills7d?: number; losses30d?: number; losses14d?: number; losses7d?: number; killLossRatio30d?: number; killLossRatio7d?: number } | null> {
  const result = await database.findOne<any>(
    `SELECT
      "entityId",
      "entityType",
      "killsAll" as kills,
      "lossesAll" as losses,
      "iskDestroyedAll" as "iskDestroyed",
      "iskLostAll" as "iskLost",
      "soloKillsAll" as "soloKills",
      "soloLossesAll" as "soloLosses",
      "npcKillsAll" as "npcKills",
      "npcLossesAll" as "npcLosses",
      "kills30d",
      "losses30d",
      "kills14d",
      "losses14d",
      "lastKillTime",
      "lastLossTime"
    FROM entity_stats_cache
    WHERE "entityId" = :entityId
      AND "entityType" = :entityType`,
    { entityId, entityType }
  );

  if (!result) return null;

  const baseStats = calculateDerivedStats(result);
  
  // Calculate K/L ratios for time periods
  const killLossRatio30d = result.losses30d > 0 ? result.kills30d / result.losses30d : result.kills30d || 0;
  const killLossRatio7d = result.losses14d > 0 ? result.kills14d / result.losses14d : result.kills14d || 0;

  return {
    ...baseStats,
    kills30d: result.kills30d,
    losses30d: result.losses30d,
    kills14d: result.kills14d,
    losses14d: result.losses14d,
    kills7d: result.kills14d, // We use 14d as proxy for 7d
    losses7d: result.losses14d,
    killLossRatio30d,
    killLossRatio7d,
  };
}

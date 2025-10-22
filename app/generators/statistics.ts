import { db } from "../../src/db";
import {
  killmails,
  victims,
  attackers,
  characters,
  corporations,
  alliances,
  types,
  solarSystems,
} from "../../db/schema";
import { count, sql, desc, and, or, gte, eq, inArray } from "drizzle-orm";

/**
 * Filters for statistics
 */
export interface StatsFilters {
  characterIds?: number[];
  corporationIds?: number[];
  allianceIds?: number[];
}

/**
 * Statistics interface
 */
export interface KillboardStatistics {
  // Overall stats
  totalKillmails: number;
  totalKills: number;
  totalLosses: number;

  // ISK stats
  totalISKDestroyed: string;
  totalISKLost: string;

  // Pilot activity
  activePilotsLast7Days: number;
  activePilotsLast24Hours: number;
  totalUniquePilots: number;

  // Time-based kill counts
  killsLast24Hours: number;
  killsLast7Days: number;
  killsLast30Days: number;

  // Ship stats
  mostDestroyedShip: { id: number; name: string; count: number } | null;
  mostUsedShip: { id: number; name: string; count: number } | null;

  // System stats
  mostDangerousSystem: { id: number; name: string; count: number } | null;

  // Top entities
  topKiller: { id: number; name: string; kills: number } | null;
  topCorporation: { id: number; name: string; kills: number } | null;
  topAlliance: { id: number; name: string; kills: number } | null;

  // Misc
  soloKills: number;
  npcKills: number;
  averageAttackersPerKill: number;
}

/**
 * Get comprehensive killboard statistics
 */
export async function getKillboardStatistics(
  filters?: StatsFilters
): Promise<KillboardStatistics> {
  // Build filter conditions only for functions that need the complex OR logic
  const filterConditions = buildFilterConditions(filters);

  // Run all queries in parallel for performance
  const [
    totalStats,
    iskStats,
    activePilotsStats,
    timeBasedStats,
    shipStats,
    systemStats,
    topEntities,
    miscStats,
  ] = await Promise.all([
    getTotalStats(filters, filterConditions),
    getISKStats(filters, filterConditions),
    getActivePilotsStats(filters),
    getTimeBasedStats(filters),
    getShipStats(filters),
    getSystemStats(filters),
    getTopEntities(filters),
    getMiscStats(filters),
  ]);

  return {
    ...totalStats,
    ...iskStats,
    ...activePilotsStats,
    ...timeBasedStats,
    ...shipStats,
    ...systemStats,
    ...topEntities,
    ...miscStats,
  };
}

/**
 * Get statistics for KILLS only (where entity is an attacker)
 */
export async function getKillsStatistics(
  filters?: StatsFilters
): Promise<KillboardStatistics> {
  // Build kill-specific filter conditions (entity as attacker)
  const killFilterConditions = buildKillFilterConditions(filters);

  // Run all queries in parallel for performance
  const [
    totalStats,
    iskStats,
    activePilotsStats,
    timeBasedStats,
    shipStats,
    systemStats,
    topEntities,
    miscStats,
  ] = await Promise.all([
    getTotalStatsForKills(filters, killFilterConditions),
    getISKStats(filters, killFilterConditions),
    getActivePilotsStats(filters),
    getTimeBasedStats(filters),
    getShipStats(filters),
    getSystemStats(filters),
    getTopEntities(filters),
    getMiscStats(filters),
  ]);

  return {
    ...totalStats,
    ...iskStats,
    ...activePilotsStats,
    ...timeBasedStats,
    ...shipStats,
    ...systemStats,
    ...topEntities,
    ...miscStats,
  };
}

/**
 * Get statistics for LOSSES only (where entity is a victim)
 */
export async function getLossesStatistics(
  filters?: StatsFilters
): Promise<KillboardStatistics> {
  // Build loss-specific filter conditions (entity as victim)
  const lossFilterConditions = buildLossFilterConditions(filters);

  // Run all queries in parallel for performance
  const [
    totalStats,
    iskStats,
    activePilotsStats,
    timeBasedStats,
    shipStats,
    systemStats,
    topEntities,
    miscStats,
  ] = await Promise.all([
    getTotalStatsForLosses(filters, lossFilterConditions),
    getISKStats(filters, lossFilterConditions),
    getActivePilotsStats(filters),
    getTimeBasedStats(filters),
    getShipStats(filters),
    getSystemStats(filters),
    getTopEntities(filters),
    getMiscStats(filters),
  ]);

  return {
    ...totalStats,
    ...iskStats,
    ...activePilotsStats,
    ...timeBasedStats,
    ...shipStats,
    ...systemStats,
    ...topEntities,
    ...miscStats,
  };
}

/**
 * Build filter conditions for queries
 * Uses OR logic: (victim matches filter OR attacker matches filter)
 */
function buildFilterConditions(filters?: StatsFilters): any[] {
  if (!filters) return [];

  const conditions: any[] = [];

  if (filters.characterIds && filters.characterIds.length > 0) {
    // Character can be victim or attacker
    conditions.push(
      or(
        inArray(victims.characterId, filters.characterIds),
        sql`EXISTS (SELECT 1 FROM ${attackers} WHERE ${attackers.killmailId} = ${killmails.id} AND ${attackers.characterId} IN (${sql.join(filters.characterIds.map(id => sql`${id}`), sql`, `)}))`
      )
    );
  }

  if (filters.corporationIds && filters.corporationIds.length > 0) {
    conditions.push(
      or(
        inArray(victims.corporationId, filters.corporationIds),
        sql`EXISTS (SELECT 1 FROM ${attackers} WHERE ${attackers.killmailId} = ${killmails.id} AND ${attackers.corporationId} IN (${sql.join(filters.corporationIds.map(id => sql`${id}`), sql`, `)}))`
      )
    );
  }

  if (filters.allianceIds && filters.allianceIds.length > 0) {
    conditions.push(
      or(
        inArray(victims.allianceId, filters.allianceIds),
        sql`EXISTS (SELECT 1 FROM ${attackers} WHERE ${attackers.killmailId} = ${killmails.id} AND ${attackers.allianceId} IN (${sql.join(filters.allianceIds.map(id => sql`${id}`), sql`, `)}))`
      )
    );
  }

  return conditions;
}

/**
 * Build optimized filter conditions using OR of EXISTS subqueries
 * This avoids joining victims and lets SQLite use better query plans
 */
function buildOptimizedFilterConditions(filters?: StatsFilters): any[] {
  if (!filters) return [];

  const conditions: any[] = [];

  if (filters.characterIds && filters.characterIds.length > 0) {
    // Use OR of EXISTS subqueries - avoids joins and allows better index usage
    conditions.push(
      sql`(EXISTS (SELECT 1 FROM ${victims} WHERE ${victims.killmailId} = ${killmails.id} AND ${victims.characterId} IN (${sql.join(filters.characterIds.map(id => sql`${id}`), sql`, `)}))
           OR EXISTS (SELECT 1 FROM ${attackers} WHERE ${attackers.killmailId} = ${killmails.id} AND ${attackers.characterId} IN (${sql.join(filters.characterIds.map(id => sql`${id}`), sql`, `)})))`
    );
  }

  if (filters.corporationIds && filters.corporationIds.length > 0) {
    conditions.push(
      sql`(EXISTS (SELECT 1 FROM ${victims} WHERE ${victims.killmailId} = ${killmails.id} AND ${victims.corporationId} IN (${sql.join(filters.corporationIds.map(id => sql`${id}`), sql`, `)}))
           OR EXISTS (SELECT 1 FROM ${attackers} WHERE ${attackers.killmailId} = ${killmails.id} AND ${attackers.corporationId} IN (${sql.join(filters.corporationIds.map(id => sql`${id}`), sql`, `)})))`
    );
  }

  if (filters.allianceIds && filters.allianceIds.length > 0) {
    conditions.push(
      sql`(EXISTS (SELECT 1 FROM ${victims} WHERE ${victims.killmailId} = ${killmails.id} AND ${victims.allianceId} IN (${sql.join(filters.allianceIds.map(id => sql`${id}`), sql`, `)}))
           OR EXISTS (SELECT 1 FROM ${attackers} WHERE ${attackers.killmailId} = ${killmails.id} AND ${attackers.allianceId} IN (${sql.join(filters.allianceIds.map(id => sql`${id}`), sql`, `)})))`
    );
  }

  return conditions;
}

/**
 * Build filter conditions for KILLS (where entity is attacker)
 */
function buildKillFilterConditions(filters?: StatsFilters): any[] {
  if (!filters) return [];

  const conditions: any[] = [];

  if (filters.characterIds && filters.characterIds.length > 0) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${attackers} WHERE ${attackers.killmailId} = ${killmails.id} AND ${attackers.characterId} IN (${sql.join(filters.characterIds.map(id => sql`${id}`), sql`, `)}))`
    );
  }

  if (filters.corporationIds && filters.corporationIds.length > 0) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${attackers} WHERE ${attackers.killmailId} = ${killmails.id} AND ${attackers.corporationId} IN (${sql.join(filters.corporationIds.map(id => sql`${id}`), sql`, `)}))`
    );
  }

  if (filters.allianceIds && filters.allianceIds.length > 0) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${attackers} WHERE ${attackers.killmailId} = ${killmails.id} AND ${attackers.allianceId} IN (${sql.join(filters.allianceIds.map(id => sql`${id}`), sql`, `)}))`
    );
  }

  return conditions;
}

/**
 * Build filter conditions for LOSSES (where entity is victim)
 */
function buildLossFilterConditions(filters?: StatsFilters): any[] {
  if (!filters) return [];

  const conditions: any[] = [];

  if (filters.characterIds && filters.characterIds.length > 0) {
    conditions.push(inArray(victims.characterId, filters.characterIds));
  }

  if (filters.corporationIds && filters.corporationIds.length > 0) {
    conditions.push(inArray(victims.corporationId, filters.corporationIds));
  }

  if (filters.allianceIds && filters.allianceIds.length > 0) {
    conditions.push(inArray(victims.allianceId, filters.allianceIds));
  }

  return conditions;
}

/**
 * Get total killmail stats
 * Optimized: Uses COUNT(DISTINCT) instead of fetching all rows
 */
async function getTotalStats(filters?: StatsFilters, filterConditions: any[] = []) {
  let totalKillmails = 0;
  let kills = 0;
  let losses = 0;

  if (filters) {
    // When filters are provided, count kills and losses separately using SQL COUNT(DISTINCT)

    // Count KILLS - where the entity is an attacker (appears in attackers table)
    const killFilterConditions = buildKillFilterConditions(filters);
    const [killsResult] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${killmails.id})`.mapWith(Number),
      })
      .from(killmails)
      .innerJoin(attackers, eq(killmails.id, attackers.killmailId))
      .where(killFilterConditions.length > 0 ? and(...killFilterConditions) : undefined)
      .execute();

    // Count LOSSES - where the entity is a victim
    const lossFilterConditions = buildLossFilterConditions(filters);
    const [lossesResult] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${killmails.id})`.mapWith(Number),
      })
      .from(killmails)
      .leftJoin(victims, eq(killmails.id, victims.killmailId))
      .where(lossFilterConditions.length > 0 ? and(...lossFilterConditions) : undefined)
      .execute();

    kills = killsResult?.count || 0;
    losses = lossesResult?.count || 0;
    totalKillmails = kills + losses;
  } else {
    // No filters - count all killmails
    const [result] = await db
      .select({
        total: sql<number>`COUNT(DISTINCT ${killmails.id})`.mapWith(Number),
      })
      .from(killmails)
      .execute();

    totalKillmails = result?.total || 0;
  }

  return {
    totalKillmails,
    totalKills: kills,
    totalLosses: losses,
  };
}

/**
 * Get ISK statistics
 */
async function getISKStats(filters?: StatsFilters, filterConditions: any[] = []) {
  // SQLite doesn't have BIGINT, so we sum as REAL (float64) which can handle large numbers
  let query = db
    .select({
      totalDestroyed: sql<string>`CAST(COALESCE(SUM(CAST(${killmails.totalValue} AS REAL)), 0) AS TEXT)`,
    })
    .from(killmails) as any;

  // Use optimized conditions if available, otherwise fall back to original
  const optimizedConditions = buildOptimizedFilterConditions(filters);

  if (optimizedConditions.length > 0) {
    // Use optimized EXISTS-based conditions without join
    query = query.where(and(...optimizedConditions));
  } else if (filterConditions.length > 0) {
    // Fall back to original approach if provided
    query = query.leftJoin(victims, eq(killmails.id, victims.killmailId));
    query = query.where(and(...filterConditions));
  }

  const [result] = await query.execute();

  return {
    totalISKDestroyed: result?.totalDestroyed || "0",
    totalISKLost: "0", // TODO: Calculate losses separately
  };
}

/**
 * Get active pilots statistics
 * Optimized: Uses COUNT(DISTINCT) and single query with CASE for all time periods
 */
async function getActivePilotsStats(filters?: StatsFilters) {
  // Build optimized filter conditions
  const optimizedFilterConditions = buildOptimizedFilterConditions(filters);

  // Single query with CASE to get all time periods at once
  let query = db
    .select({
      period: sql<string>`CASE
        WHEN ${killmails.killmailTime} >= strftime('%s', 'now', '-24 hours') THEN '24h'
        WHEN ${killmails.killmailTime} >= strftime('%s', 'now', '-7 days') THEN '7d'
        ELSE 'all'
      END`,
      count: sql<number>`COUNT(DISTINCT ${attackers.characterId})`.mapWith(Number),
    })
    .from(attackers)
    .innerJoin(killmails, eq(attackers.killmailId, killmails.id)) as any;

  const results = await query
    .where(
      and(
        sql`${attackers.characterId} IS NOT NULL`,
        ...(optimizedFilterConditions.length > 0 ? optimizedFilterConditions : [])
      )
    )
    .groupBy(sql`CASE
      WHEN ${killmails.killmailTime} >= strftime('%s', 'now', '-24 hours') THEN '24h'
      WHEN ${killmails.killmailTime} >= strftime('%s', 'now', '-7 days') THEN '7d'
      ELSE 'all'
    END`)
    .execute();

  // Extract counts from result
  const resultMap = new Map(results.map((r: any) => [r.period, r.count]));

  return {
    activePilotsLast24Hours: (resultMap.get('24h') as number) || 0,
    activePilotsLast7Days: (resultMap.get('7d') as number) || 0,
    totalUniquePilots: (resultMap.get('all') as number) || 0,
  };
}

/**
 * Get time-based statistics
 * Optimized: Uses single query with CASE statement instead of 3 separate queries
 */
async function getTimeBasedStats(filters?: StatsFilters) {
  // Build optimized filter conditions
  const optimizedFilterConditions = buildOptimizedFilterConditions(filters);

  // Single query with CASE to get all time periods at once
  let query = db
    .select({
      period: sql<string>`CASE
        WHEN ${killmails.killmailTime} >= strftime('%s', 'now', '-24 hours') THEN '24h'
        WHEN ${killmails.killmailTime} >= strftime('%s', 'now', '-7 days') THEN '7d'
        WHEN ${killmails.killmailTime} >= strftime('%s', 'now', '-30 days') THEN '30d'
        ELSE 'other'
      END`,
      count: sql<number>`COUNT(DISTINCT ${killmails.id})`.mapWith(Number),
    })
    .from(killmails) as any;

  const results = await query
    .where(
      optimizedFilterConditions.length > 0
        ? and(...optimizedFilterConditions)
        : undefined
    )
    .groupBy(sql`CASE
      WHEN ${killmails.killmailTime} >= strftime('%s', 'now', '-24 hours') THEN '24h'
      WHEN ${killmails.killmailTime} >= strftime('%s', 'now', '-7 days') THEN '7d'
      WHEN ${killmails.killmailTime} >= strftime('%s', 'now', '-30 days') THEN '30d'
      ELSE 'other'
    END`)
    .execute();

  // Extract counts from result
  const resultMap = new Map(results.map((r: any) => [r.period, r.count]));

  return {
    killsLast24Hours: (resultMap.get('24h') as number) || 0,
    killsLast7Days: (resultMap.get('7d') as number) || 0,
    killsLast30Days: (resultMap.get('30d') as number) || 0,
  };
}

/**
 * Get ship statistics
 */
async function getShipStats(filters?: StatsFilters) {
  // Build optimized filter conditions (uses EXISTS for proper index usage)
  const optimizedFilterConditions = buildOptimizedFilterConditions(filters);

  // Most destroyed ship (victim ships) - separate query for better index usage
  const destroyedQuery = db
    .select({
      shipTypeId: victims.shipTypeId,
      shipName: types.name,
      count: count(),
    })
    .from(victims)
    .innerJoin(killmails, eq(victims.killmailId, killmails.id))
    .leftJoin(types, eq(victims.shipTypeId, types.typeId))
    .where(
      and(
        sql`${victims.shipTypeId} IS NOT NULL`,
        ...(optimizedFilterConditions.length > 0 ? optimizedFilterConditions : [])
      )
    )
    .groupBy(victims.shipTypeId)
    .orderBy(desc(count()))
    .limit(1);

  // Most used ship (attacker ships) - separate query for better index usage
  const usedQuery = db
    .select({
      shipTypeId: attackers.shipTypeId,
      shipName: types.name,
      count: sql<number>`COUNT(DISTINCT ${killmails.id})`.mapWith(Number),
    })
    .from(attackers)
    .innerJoin(killmails, eq(attackers.killmailId, killmails.id))
    .leftJoin(types, eq(attackers.shipTypeId, types.typeId))
    .where(
      and(
        sql`${attackers.shipTypeId} IS NOT NULL`,
        ...(optimizedFilterConditions.length > 0 ? optimizedFilterConditions : [])
      )
    )
    .groupBy(attackers.shipTypeId)
    .orderBy(desc(count()))
    .limit(1);

  const [destroyed, used] = await Promise.all([
    destroyedQuery.execute(),
    usedQuery.execute(),
  ]);

  return {
    mostDestroyedShip: destroyed[0] && destroyed[0].shipTypeId
      ? { id: destroyed[0].shipTypeId, name: destroyed[0].shipName || `Ship ${destroyed[0].shipTypeId}`, count: destroyed[0].count }
      : null,
    mostUsedShip: used[0] && used[0].shipTypeId
      ? { id: used[0].shipTypeId, name: used[0].shipName || `Ship ${used[0].shipTypeId}`, count: used[0].count }
      : null,
  };
}

/**
 * Get system statistics
 */
async function getSystemStats(filters?: StatsFilters) {
  // Build optimized filter conditions (uses EXISTS for proper index usage)
  const optimizedFilterConditions = buildOptimizedFilterConditions(filters);

  const query = db
    .select({
      solarSystemId: killmails.solarSystemId,
      systemName: solarSystems.name,
      count: count(),
    })
    .from(killmails)
    .leftJoin(solarSystems, eq(killmails.solarSystemId, solarSystems.systemId))
    .where(optimizedFilterConditions.length > 0 ? and(...optimizedFilterConditions) : undefined)
    .groupBy(killmails.solarSystemId)
    .orderBy(desc(count()))
    .limit(1);

  const [result] = await query.execute();

  return {
    mostDangerousSystem: result
      ? { id: result.solarSystemId, name: result.systemName || `System ${result.solarSystemId}`, count: result.count }
      : null,
  };
}

/**
 * Get top entities (killer, corporation, alliance)
 */
async function getTopEntities(filters?: StatsFilters) {
  // Build optimized filter conditions (uses EXISTS for proper index usage)
  const optimizedFilterConditions = buildOptimizedFilterConditions(filters);

  // Top killer (character with most final blows)
  const topKillerQuery = db
    .select({
      characterId: attackers.characterId,
      characterName: characters.name,
      kills: sql<number>`COUNT(DISTINCT ${killmails.id})`.mapWith(Number),
    })
    .from(attackers)
    .innerJoin(killmails, eq(attackers.killmailId, killmails.id))
    .leftJoin(characters, eq(attackers.characterId, characters.characterId))
    .where(
      and(
        eq(attackers.finalBlow, true),
        sql`${attackers.characterId} IS NOT NULL`,
        ...(optimizedFilterConditions.length > 0 ? optimizedFilterConditions : [])
      )
    )
    .groupBy(attackers.characterId)
    .orderBy(desc(sql<number>`COUNT(DISTINCT ${killmails.id})`))
    .limit(1);

  // Top corporation
  const topCorpQuery = db
    .select({
      corporationId: attackers.corporationId,
      corporationName: corporations.name,
      kills: sql<number>`COUNT(DISTINCT ${killmails.id})`.mapWith(Number),
    })
    .from(attackers)
    .innerJoin(killmails, eq(attackers.killmailId, killmails.id))
    .leftJoin(corporations, eq(attackers.corporationId, corporations.corporationId))
    .where(
      and(
        sql`${attackers.corporationId} IS NOT NULL`,
        ...(optimizedFilterConditions.length > 0 ? optimizedFilterConditions : [])
      )
    )
    .groupBy(attackers.corporationId)
    .orderBy(desc(sql<number>`COUNT(DISTINCT ${killmails.id})`))
    .limit(1);

  // Top alliance
  const topAllianceQuery = db
    .select({
      allianceId: attackers.allianceId,
      allianceName: alliances.name,
      kills: sql<number>`COUNT(DISTINCT ${killmails.id})`.mapWith(Number),
    })
    .from(attackers)
    .innerJoin(killmails, eq(attackers.killmailId, killmails.id))
    .leftJoin(alliances, eq(attackers.allianceId, alliances.allianceId))
    .where(
      and(
        sql`${attackers.allianceId} IS NOT NULL`,
        ...(optimizedFilterConditions.length > 0 ? optimizedFilterConditions : [])
      )
    )
    .groupBy(attackers.allianceId)
    .orderBy(desc(sql<number>`COUNT(DISTINCT ${killmails.id})`))
    .limit(1);

  const [topKiller, topCorp, topAlliance] = await Promise.all([
    topKillerQuery.execute(),
    topCorpQuery.execute(),
    topAllianceQuery.execute(),
  ]);

  return {
    topKiller: topKiller[0] && topKiller[0].characterId
      ? {
          id: topKiller[0].characterId,
          name: topKiller[0].characterName || `Character ${topKiller[0].characterId}`,
          kills: topKiller[0].kills,
        }
      : null,
    topCorporation: topCorp[0] && topCorp[0].corporationId
      ? {
          id: topCorp[0].corporationId,
          name: topCorp[0].corporationName || `Corporation ${topCorp[0].corporationId}`,
          kills: topCorp[0].kills,
        }
      : null,
    topAlliance: topAlliance[0] && topAlliance[0].allianceId
      ? {
          id: topAlliance[0].allianceId,
          name: topAlliance[0].allianceName || `Alliance ${topAlliance[0].allianceId}`,
          kills: topAlliance[0].kills
        }
      : null,
  };
}

/**
 * Get miscellaneous statistics
 */
async function getMiscStats(filters?: StatsFilters) {
  // Build optimized filter conditions
  const optimizedFilterConditions = buildOptimizedFilterConditions(filters);

  // Optimized: Combine 3 queries into 1
  let query = db
    .select({
      soloCount: sql<number>`SUM(CASE WHEN ${killmails.isSolo} = 1 THEN 1 ELSE 0 END)`.mapWith(Number),
      npcCount: sql<number>`SUM(CASE WHEN ${killmails.isNpc} = 1 THEN 1 ELSE 0 END)`.mapWith(Number),
      avgAttackers: sql<number>`AVG(${killmails.attackerCount})`.mapWith(Number),
    })
    .from(killmails) as any;

  const [result] = await query
    .where(optimizedFilterConditions.length > 0 ? and(...optimizedFilterConditions) : undefined)
    .execute();

  return {
    soloKills: result?.soloCount || 0,
    npcKills: result?.npcCount || 0,
    averageAttackersPerKill: result?.avgAttackers ? Math.round(result.avgAttackers * 10) / 10 : 0,
  };
}

/**
 * Get total stats for KILLS only (entity as attacker)
 */
async function getTotalStatsForKills(filters?: StatsFilters, filterConditions: any[] = []) {
  let totalKillmails = 0;
  let kills = 0;
  let losses = 0;

  if (filters) {
    // For kills, we only count kills
    const killFilterConditions = buildKillFilterConditions(filters);
    const killsQuery = db
      .selectDistinct({ killmailId: killmails.id })
      .from(killmails)
      .innerJoin(attackers, eq(killmails.id, attackers.killmailId))
      .leftJoin(victims, eq(killmails.id, victims.killmailId));

    if (killFilterConditions.length > 0) {
      killsQuery.where(and(...killFilterConditions));
    }

    const killsResult = await killsQuery.execute();
    kills = killsResult.length;
    totalKillmails = kills;
  } else {
    // No filters - count all killmails
    const query = db
      .select({
        total: count(),
      })
      .from(killmails)
      .leftJoin(victims, eq(killmails.id, victims.killmailId));

    const [result] = await query.execute();
    totalKillmails = result?.total || 0;
  }

  return {
    totalKillmails,
    totalKills: kills,
    totalLosses: losses,
  };
}

/**
 * Get total stats for LOSSES only (entity as victim)
 */
async function getTotalStatsForLosses(filters?: StatsFilters, filterConditions: any[] = []) {
  let totalKillmails = 0;
  let kills = 0;
  let losses = 0;

  if (filters) {
    // For losses, we only count losses
    const lossFilterConditions = buildLossFilterConditions(filters);
    const lossesQuery = db
      .selectDistinct({ killmailId: killmails.id })
      .from(killmails)
      .leftJoin(victims, eq(killmails.id, victims.killmailId));

    if (lossFilterConditions.length > 0) {
      lossesQuery.where(and(...lossFilterConditions));
    }

    const lossesResult = await lossesQuery.execute();
    losses = lossesResult.length;
    totalKillmails = losses;
  } else {
    // No filters - count all killmails
    const query = db
      .select({
        total: count(),
      })
      .from(killmails)
      .leftJoin(victims, eq(killmails.id, victims.killmailId));

    const [result] = await query.execute();
    totalKillmails = result?.total || 0;
  }

  return {
    totalKillmails,
    totalKills: kills,
    totalLosses: losses,
  };
}

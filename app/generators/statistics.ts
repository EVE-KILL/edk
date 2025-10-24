import { db } from "../../src/db";
import {
  killmails,
  victims,
  attackers,
  characters,
} from "../../db/schema";
import { count, sql, and, or, eq, inArray } from "drizzle-orm";

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

  // Misc
  soloKills: number;
  npcKills: number;
  averageAttackersPerKill: number;
}

/**
 * Get comprehensive killboard statistics
 *
 * NOTE: For entity-specific stats (kills/losses/efficiency for a character, corp, or alliance),
 * use the unified stats generator in entity-stats.ts instead:
 *
 * import { getEntityStats } from "./entity-stats";
 * const stats = await getEntityStats({ characterIds: [123], statsType: "all" });
 *
 * This function is for GLOBAL dashboard statistics with comprehensive details like
 * top killers, most dangerous systems, pilot activity, etc.
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
    miscStats,
  ] = await Promise.all([
    getTotalStats(filters, filterConditions),
    getISKStats(filters, filterConditions),
    getActivePilotsStats(filters),
    getTimeBasedStats(filters),
    getMiscStats(filters),
  ]);

  return {
    ...totalStats,
    ...iskStats,
    ...activePilotsStats,
    ...timeBasedStats,
    ...miscStats,
  };
}

/**
 * Get statistics for KILLS only (where entity is an attacker)
 *
 * @deprecated Use getEntityStats() from entity-stats.ts instead:
 * import { getEntityStats } from "./entity-stats";
 * const stats = await getEntityStats({ characterIds: [123], statsType: "kills" });
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
    miscStats,
  ] = await Promise.all([
    getTotalStatsForKills(filters, killFilterConditions),
    getISKStats(filters, killFilterConditions),
    getActivePilotsStats(filters),
    getTimeBasedStats(filters),
    getMiscStats(filters),
  ]);

  return {
    ...totalStats,
    ...iskStats,
    ...activePilotsStats,
    ...timeBasedStats,
    ...miscStats,
  };
}

/**
 * Get statistics for LOSSES only (where entity is a victim)
 *
 * @deprecated Use getEntityStats() from entity-stats.ts instead:
 * import { getEntityStats } from "./entity-stats";
 * const stats = await getEntityStats({ characterIds: [123], statsType: "losses" });
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
    miscStats,
  ] = await Promise.all([
    getTotalStatsForLosses(filters, lossFilterConditions),
    getISKStats(filters, lossFilterConditions),
    getActivePilotsStats(filters),
    getTimeBasedStats(filters),
    getMiscStats(filters),
  ]);

  return {
    ...totalStats,
    ...iskStats,
    ...activePilotsStats,
    ...timeBasedStats,
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

  // Single query with CASE to get active pilots in different time periods
  // Count unique characters from the attackers table (where characterId is not NULL)
  let query = db
    .select({
      period: sql<string>`CASE
        WHEN ${killmails.killmailTime} >= strftime('%s', 'now', '-24 hours') THEN '24h'
        WHEN ${killmails.killmailTime} >= strftime('%s', 'now', '-7 days') THEN '7d'
        ELSE 'other'
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
      ELSE 'other'
    END`)
    .execute();

  // Extract counts from result
  const resultMap = new Map(results.map((r: any) => [r.period, r.count]));

  let activePilots24h = (resultMap.get('24h') as number) || 0;
  let activePilots7d = (resultMap.get('7d') as number) || 0;

  // Total unique pilots is ALWAYS the total count from characters table
  // This represents all known characters in the database, not filtered by activity
  const [totalCount] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(characters)
    .execute();

  return {
    activePilotsLast24Hours: activePilots24h,
    activePilotsLast7Days: activePilots7d,
    totalUniquePilots: totalCount?.count || 0,
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

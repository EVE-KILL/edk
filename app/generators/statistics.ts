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
  // Build filter conditions
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
    getTotalStats(filterConditions),
    getISKStats(filterConditions),
    getActivePilotsStats(filterConditions),
    getTimeBasedStats(filterConditions),
    getShipStats(filterConditions),
    getSystemStats(filterConditions),
    getTopEntities(filterConditions),
    getMiscStats(filterConditions),
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
 * Get total killmail stats
 */
async function getTotalStats(filterConditions: any[]) {
  const query = db
    .select({
      total: count(),
    })
    .from(killmails)
    .leftJoin(victims, eq(killmails.id, victims.killmailId));

  if (filterConditions.length > 0) {
    query.where(and(...filterConditions));
  }

  const [result] = await query.execute();

  // For filtered stats, calculate kills vs losses
  let kills = 0;
  let losses = 0;

  if (filterConditions.length > 0) {
    // This is approximate - we'll count based on victims for now
    // A more accurate count would require separate queries
    kills = result?.total || 0;
    losses = 0; // TODO: Implement proper kill/loss separation
  }

  return {
    totalKillmails: result?.total || 0,
    totalKills: kills,
    totalLosses: losses,
  };
}

/**
 * Get ISK statistics
 */
async function getISKStats(filterConditions: any[]) {
  // SQLite doesn't have BIGINT, so we sum as REAL (float64) which can handle large numbers
  const query = db
    .select({
      totalDestroyed: sql<string>`CAST(COALESCE(SUM(CAST(${killmails.totalValue} AS REAL)), 0) AS TEXT)`,
    })
    .from(killmails)
    .leftJoin(victims, eq(killmails.id, victims.killmailId));

  if (filterConditions.length > 0) {
    query.where(and(...filterConditions));
  }

  const [result] = await query.execute();

  return {
    totalISKDestroyed: result?.totalDestroyed || "0",
    totalISKLost: "0", // TODO: Calculate losses separately
  };
}

/**
 * Get active pilots statistics
 */
async function getActivePilotsStats(filterConditions: any[]) {
  const now = Date.now();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  // Last 24 hours
  const last24hQuery = db
    .selectDistinct({ characterId: attackers.characterId })
    .from(attackers)
    .innerJoin(killmails, eq(attackers.killmailId, killmails.id))
    .leftJoin(victims, eq(killmails.id, victims.killmailId))
    .where(
      and(
        gte(killmails.killmailTime, oneDayAgo),
        sql`${attackers.characterId} IS NOT NULL`,
        ...(filterConditions.length > 0 ? filterConditions : [])
      )
    );

  // Last 7 days
  const last7dQuery = db
    .selectDistinct({ characterId: attackers.characterId })
    .from(attackers)
    .innerJoin(killmails, eq(attackers.killmailId, killmails.id))
    .leftJoin(victims, eq(killmails.id, victims.killmailId))
    .where(
      and(
        gte(killmails.killmailTime, sevenDaysAgo),
        sql`${attackers.characterId} IS NOT NULL`,
        ...(filterConditions.length > 0 ? filterConditions : [])
      )
    );

  // All time unique pilots
  const allTimeQuery = db
    .selectDistinct({ characterId: attackers.characterId })
    .from(attackers)
    .innerJoin(killmails, eq(attackers.killmailId, killmails.id))
    .leftJoin(victims, eq(killmails.id, victims.killmailId))
    .where(
      and(
        sql`${attackers.characterId} IS NOT NULL`,
        ...(filterConditions.length > 0 ? filterConditions : [])
      )
    );

  const [last24h, last7d, allTime] = await Promise.all([
    last24hQuery.execute(),
    last7dQuery.execute(),
    allTimeQuery.execute(),
  ]);

  return {
    activePilotsLast24Hours: last24h.length,
    activePilotsLast7Days: last7d.length,
    totalUniquePilots: allTime.length,
  };
}

/**
 * Get time-based statistics
 */
async function getTimeBasedStats(filterConditions: any[]) {
  const now = Date.now();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  // Build base query
  const buildQuery = (since: Date) => {
    const query = db
      .select({ count: count() })
      .from(killmails)
      .leftJoin(victims, eq(killmails.id, victims.killmailId))
      .where(
        and(
          gte(killmails.killmailTime, since),
          ...(filterConditions.length > 0 ? filterConditions : [])
        )
      );
    return query;
  };

  const [last24h, last7d, last30d] = await Promise.all([
    buildQuery(oneDayAgo).execute(),
    buildQuery(sevenDaysAgo).execute(),
    buildQuery(thirtyDaysAgo).execute(),
  ]);

  return {
    killsLast24Hours: last24h[0]?.count || 0,
    killsLast7Days: last7d[0]?.count || 0,
    killsLast30Days: last30d[0]?.count || 0,
  };
}

/**
 * Get ship statistics
 */
async function getShipStats(filterConditions: any[]) {
  // Most destroyed ship (victim ships)
  const destroyedQuery = db
    .select({
      shipTypeId: victims.shipTypeId,
      shipName: types.name,
      count: count(),
    })
    .from(victims)
    .innerJoin(killmails, eq(victims.killmailId, killmails.id))
    .leftJoin(types, eq(victims.shipTypeId, types.typeId))
    .where(filterConditions.length > 0 ? and(...filterConditions) : undefined)
    .groupBy(victims.shipTypeId)
    .orderBy(desc(count()))
    .limit(1);

  // Most used ship (attacker ships)
  const usedQuery = db
    .select({
      shipTypeId: attackers.shipTypeId,
      shipName: types.name,
      count: count(),
    })
    .from(attackers)
    .innerJoin(killmails, eq(attackers.killmailId, killmails.id))
    .leftJoin(victims, eq(killmails.id, victims.killmailId))
    .leftJoin(types, eq(attackers.shipTypeId, types.typeId))
    .where(
      and(
        sql`${attackers.shipTypeId} IS NOT NULL`,
        ...(filterConditions.length > 0 ? filterConditions : [])
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
async function getSystemStats(filterConditions: any[]) {
  const query = db
    .select({
      solarSystemId: killmails.solarSystemId,
      systemName: solarSystems.name,
      count: count(),
    })
    .from(killmails)
    .leftJoin(victims, eq(killmails.id, victims.killmailId))
    .leftJoin(solarSystems, eq(killmails.solarSystemId, solarSystems.systemId))
    .where(filterConditions.length > 0 ? and(...filterConditions) : undefined)
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
async function getTopEntities(filterConditions: any[]) {
  // Top killer (character with most final blows)
  const topKillerQuery = db
    .select({
      characterId: attackers.characterId,
      characterName: characters.name,
      kills: count(),
    })
    .from(attackers)
    .innerJoin(killmails, eq(attackers.killmailId, killmails.id))
    .leftJoin(victims, eq(killmails.id, victims.killmailId))
    .leftJoin(characters, eq(attackers.characterId, characters.characterId))
    .where(
      and(
        eq(attackers.finalBlow, true),
        sql`${attackers.characterId} IS NOT NULL`,
        ...(filterConditions.length > 0 ? filterConditions : [])
      )
    )
    .groupBy(attackers.characterId)
    .orderBy(desc(count()))
    .limit(1);

  // Top corporation
  const topCorpQuery = db
    .select({
      corporationId: attackers.corporationId,
      corporationName: corporations.name,
      kills: count(),
    })
    .from(attackers)
    .innerJoin(killmails, eq(attackers.killmailId, killmails.id))
    .leftJoin(victims, eq(killmails.id, victims.killmailId))
    .leftJoin(corporations, eq(attackers.corporationId, corporations.corporationId))
    .where(
      and(
        sql`${attackers.corporationId} IS NOT NULL`,
        ...(filterConditions.length > 0 ? filterConditions : [])
      )
    )
    .groupBy(attackers.corporationId)
    .orderBy(desc(count()))
    .limit(1);

  // Top alliance
  const topAllianceQuery = db
    .select({
      allianceId: attackers.allianceId,
      allianceName: alliances.name,
      kills: count(),
    })
    .from(attackers)
    .innerJoin(killmails, eq(attackers.killmailId, killmails.id))
    .leftJoin(victims, eq(killmails.id, victims.killmailId))
    .leftJoin(alliances, eq(attackers.allianceId, alliances.allianceId))
    .where(
      and(
        sql`${attackers.allianceId} IS NOT NULL`,
        ...(filterConditions.length > 0 ? filterConditions : [])
      )
    )
    .groupBy(attackers.allianceId)
    .orderBy(desc(count()))
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
async function getMiscStats(filterConditions: any[]) {
  // Solo kills
  const soloQuery = db
    .select({ count: count() })
    .from(killmails)
    .leftJoin(victims, eq(killmails.id, victims.killmailId))
    .where(
      and(
        eq(killmails.isSolo, true),
        ...(filterConditions.length > 0 ? filterConditions : [])
      )
    );

  // NPC kills
  const npcQuery = db
    .select({ count: count() })
    .from(killmails)
    .leftJoin(victims, eq(killmails.id, victims.killmailId))
    .where(
      and(
        eq(killmails.isNpc, true),
        ...(filterConditions.length > 0 ? filterConditions : [])
      )
    );

  // Average attackers per kill
  const avgQuery = db
    .select({
      avg: sql<number>`AVG(${killmails.attackerCount})`,
    })
    .from(killmails)
    .leftJoin(victims, eq(killmails.id, victims.killmailId))
    .where(filterConditions.length > 0 ? and(...filterConditions) : undefined);

  const [solo, npc, avg] = await Promise.all([
    soloQuery.execute(),
    npcQuery.execute(),
    avgQuery.execute(),
  ]);

  return {
    soloKills: solo[0]?.count || 0,
    npcKills: npc[0]?.count || 0,
    averageAttackersPerKill: Math.round((avg[0]?.avg || 0) * 10) / 10,
  };
}

import { db } from "../../src/db";
import {
  killmails,
  attackers,
  characters,
  corporations,
  alliances,
  regions,
  solarSystems,
  victims,
} from "../../db/schema";
import { sql, eq, and, gte, inArray } from "drizzle-orm";

/**
 * Top 10 Statistics Interface
 */
export interface Top10Item {
  id: number;
  name: string;
  kills: number;
  imageUrl?: string;
}

export interface Top10Stats {
  characters: Top10Item[];
  corporations: Top10Item[];
  alliances: Top10Item[];
  systems: Top10Item[];
  regions: Top10Item[];
}

/**
 * Get top 10 characters with most kills in last 7 days
 */
async function getTopCharacters(days: number = 7): Promise<Top10Item[]> {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);

  // Optimized: use direct grouping with a DISTINCT COUNT subquery approach
  // Instead of joining characters, we'll fetch top attacker IDs first then batch-lookup names
  const results = await db
    .select({
      characterId: attackers.characterId,
      kills: sql<number>`COUNT(DISTINCT ${killmails.id})`,
    })
    .from(attackers)
    .innerJoin(killmails, eq(attackers.killmailId, killmails.id))
    .where(
      and(
        gte(killmails.killmailTime, daysAgo),
        sql`${attackers.characterId} IS NOT NULL`
      )
    )
    .groupBy(attackers.characterId)
    .orderBy(sql`COUNT(DISTINCT ${killmails.id}) DESC`)
    .limit(10)
    .execute();

  const ids = results.map((r) => r.characterId).filter(Boolean);
  const namesMap: Record<number, string> = {};
  if (ids.length > 0) {
    const nameRows = await db
      .select({ id: characters.characterId, name: characters.name })
      .from(characters)
      .where(inArray(characters.characterId as any, ids))
      .execute();

    for (const nr of nameRows) {
      namesMap[nr.id] = nr.name;
    }
  }

  return results.map((row) => ({
    id: row.characterId || 0,
    name: namesMap[row.characterId || 0] || "Unknown",
    kills: row.kills || 0,
    imageUrl: row.characterId
      ? `https://images.evetech.net/characters/${row.characterId}/portrait?size=64`
      : undefined,
  }));
}

/**
 * Get top 10 corporations with most kills in last 7 days
 */
async function getTopCorporations(days: number = 7): Promise<Top10Item[]> {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);

  // Optimized: use direct grouping with COUNT(DISTINCT killmails.id)
  const results = await db
    .select({
      corporationId: attackers.corporationId,
      kills: sql<number>`COUNT(DISTINCT ${killmails.id})`,
    })
    .from(attackers)
    .innerJoin(killmails, eq(attackers.killmailId, killmails.id))
    .where(
      and(
        gte(killmails.killmailTime, daysAgo),
        sql`${attackers.corporationId} IS NOT NULL`
      )
    )
    .groupBy(attackers.corporationId)
    .orderBy(sql`COUNT(DISTINCT ${killmails.id}) DESC`)
    .limit(10)
    .execute();

  const ids = results.map((r) => r.corporationId).filter(Boolean);
  const namesMap: Record<number, string> = {};
  if (ids.length > 0) {
    const nameRows = await db
      .select({ id: corporations.corporationId, name: corporations.name })
      .from(corporations)
      .where(inArray(corporations.corporationId as any, ids))
      .execute();

    for (const nr of nameRows) {
      namesMap[nr.id] = nr.name;
    }
  }

  return results.map((row) => ({
    id: row.corporationId || 0,
    name: namesMap[row.corporationId || 0] || "Unknown",
    kills: row.kills || 0,
    imageUrl: row.corporationId
      ? `https://images.evetech.net/corporations/${row.corporationId}/logo?size=64`
      : undefined,
  }));
}

/**
 * Get top 10 alliances with most kills in last 7 days
 */
async function getTopAlliances(days: number = 7): Promise<Top10Item[]> {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);

  // Optimized: use direct grouping with COUNT(DISTINCT killmails.id)
  const results = await db
    .select({
      allianceId: attackers.allianceId,
      kills: sql<number>`COUNT(DISTINCT ${killmails.id})`,
    })
    .from(attackers)
    .innerJoin(killmails, eq(attackers.killmailId, killmails.id))
    .where(
      and(
        gte(killmails.killmailTime, daysAgo),
        sql`${attackers.allianceId} IS NOT NULL`
      )
    )
    .groupBy(attackers.allianceId)
    .orderBy(sql`COUNT(DISTINCT ${killmails.id}) DESC`)
    .limit(10)
    .execute();

  const ids = results.map((r) => r.allianceId).filter(Boolean);
  const namesMap: Record<number, string> = {};
  if (ids.length > 0) {
    const nameRows = await db
      .select({ id: alliances.allianceId, name: alliances.name })
      .from(alliances)
      .where(inArray(alliances.allianceId as any, ids))
      .execute();

    for (const nr of nameRows) {
      namesMap[nr.id] = nr.name;
    }
  }

  return results.map((row) => ({
    id: row.allianceId || 0,
    name: namesMap[row.allianceId || 0] || "Unknown",
    kills: row.kills || 0,
    imageUrl: row.allianceId
      ? `https://images.evetech.net/alliances/${row.allianceId}/logo?size=64`
      : undefined,
  }));
}

/**
 * Get top 10 systems with most kills in last 7 days
 */
async function getTopSystems(days: number = 7): Promise<Top10Item[]> {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);
  // For systems and regions we can count distinct killmails per system directly from killmails table
  const results = await db
    .select({
      systemId: killmails.solarSystemId,
      name: sql<string>`COALESCE(${solarSystems.name}, 'Unknown System')`,
      kills: sql<number>`COUNT(${killmails.id})`,
    })
    .from(killmails)
    .leftJoin(solarSystems, eq(killmails.solarSystemId, solarSystems.systemId))
    .where(gte(killmails.killmailTime, daysAgo))
    .groupBy(killmails.solarSystemId, solarSystems.name)
    .orderBy(sql`COUNT(${killmails.id}) DESC`)
    .limit(10)
    .execute();

  return results.map((row) => ({
    id: row.systemId || 0,
    name: row.name || "Unknown",
    kills: row.kills || 0,
    imageUrl: row.systemId
      ? `https://images.eve-kill.com/systems/${row.systemId}`
      : undefined,
  }));
}

/**
 * Get top 10 regions with most kills in last 7 days
 */
async function getTopRegions(days: number = 7): Promise<Top10Item[]> {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);
  const results = await db
    .select({
      regionId: sql<number>`${solarSystems.regionId}`,
      name: sql<string>`COALESCE(${regions.name}, 'Unknown Region')`,
      kills: sql<number>`COUNT(${killmails.id})`,
    })
    .from(killmails)
    .leftJoin(solarSystems, eq(killmails.solarSystemId, solarSystems.systemId))
    .leftJoin(regions, eq(solarSystems.regionId, regions.regionId))
    .where(gte(killmails.killmailTime, daysAgo))
    .groupBy(solarSystems.regionId, regions.name)
    .orderBy(sql`COUNT(${killmails.id}) DESC`)
    .limit(10)
    .execute();

  return results.map((row) => ({
    id: row.regionId || 0,
    name: row.name || "Unknown",
    kills: row.kills || 0,
    imageUrl: row.regionId
      ? `https://images.eve-kill.com/regions/${row.regionId}`
      : undefined,
  }));
}

/**
 * Get all top 10 statistics for the last 7 days
 */
export async function getTop10Stats(days: number = 7): Promise<Top10Stats> {
  const [characters, corporations, alliances, systems, regions] = await Promise.all([
    getTopCharacters(days),
    getTopCorporations(days),
    getTopAlliances(days),
    getTopSystems(days),
    getTopRegions(days),
  ]);

  return {
    characters,
    corporations,
    alliances,
    systems,
    regions,
  };
}

/**
 * Get top 10 entities involved in kills by a specific character
 */
export async function getTop10StatsByCharacter(characterId: number, days: number = 7): Promise<Top10Stats> {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);

  // Top corporations this character has fought against (as victims)
  const topCorpsAgainst = await db
    .select({
      corporationId: victims.corporationId,
      kills: sql<number>`COUNT(DISTINCT ${killmails.id})`,
    })
    .from(killmails)
    .innerJoin(victims, eq(killmails.id, victims.killmailId))
    .innerJoin(attackers, eq(killmails.id, attackers.killmailId))
    .where(
      and(
        gte(killmails.killmailTime, daysAgo),
        eq(attackers.characterId, characterId)
      )
    )
    .groupBy(victims.corporationId)
    .orderBy(sql`COUNT(DISTINCT ${killmails.id}) DESC`)
    .limit(10)
    .execute();

  // Top alliances
  const topAlliancesAgainst = await db
    .select({
      allianceId: victims.allianceId,
      kills: sql<number>`COUNT(DISTINCT ${killmails.id})`,
    })
    .from(killmails)
    .innerJoin(victims, eq(killmails.id, victims.killmailId))
    .innerJoin(attackers, eq(killmails.id, attackers.killmailId))
    .where(
      and(
        gte(killmails.killmailTime, daysAgo),
        eq(attackers.characterId, characterId),
        sql`${victims.allianceId} IS NOT NULL`
      )
    )
    .groupBy(victims.allianceId)
    .orderBy(sql`COUNT(DISTINCT ${killmails.id}) DESC`)
    .limit(10)
    .execute();

  // Top systems
  const topSysAgainst = await db
    .select({
      systemId: killmails.solarSystemId,
      name: solarSystems.name,
      kills: sql<number>`COUNT(DISTINCT ${killmails.id})`,
    })
    .from(killmails)
    .leftJoin(solarSystems, eq(killmails.solarSystemId, solarSystems.systemId))
    .innerJoin(attackers, eq(killmails.id, attackers.killmailId))
    .where(
      and(
        gte(killmails.killmailTime, daysAgo),
        eq(attackers.characterId, characterId)
      )
    )
    .groupBy(killmails.solarSystemId, solarSystems.name)
    .orderBy(sql`COUNT(DISTINCT ${killmails.id}) DESC`)
    .limit(10)
    .execute();

  // Top regions
  const topRegAgainst = await db
    .select({
      regionId: solarSystems.regionId,
      name: sql<string>`COALESCE(${regions.name}, 'Unknown Region')`,
      kills: sql<number>`COUNT(${killmails.id})`,
    })
    .from(killmails)
    .leftJoin(solarSystems, eq(killmails.solarSystemId, solarSystems.systemId))
    .leftJoin(regions, eq(solarSystems.regionId, regions.regionId))
    .innerJoin(attackers, eq(killmails.id, attackers.killmailId))
    .where(
      and(
        gte(killmails.killmailTime, daysAgo),
        eq(attackers.characterId, characterId)
      )
    )
    .groupBy(solarSystems.regionId, regions.name)
    .orderBy(sql`COUNT(${killmails.id}) DESC`)
    .limit(10)
    .execute();

  // Fetch corporation names
  const corpIds = topCorpsAgainst.map((r) => r.corporationId).filter(Boolean);
  const corpNamesMap: Record<number, string> = {};
  if (corpIds.length > 0) {
    const corpRows = await db
      .select({ id: corporations.corporationId, name: corporations.name })
      .from(corporations)
      .where(inArray(corporations.corporationId as any, corpIds))
      .execute();
    for (const nr of corpRows) {
      corpNamesMap[nr.id] = nr.name;
    }
  }

  // Fetch alliance names
  const allianceIds = topAlliancesAgainst.map((r) => r.allianceId).filter(Boolean);
  const allianceNamesMap: Record<number, string> = {};
  if (allianceIds.length > 0) {
    const allianceRows = await db
      .select({ id: alliances.allianceId, name: alliances.name })
      .from(alliances)
      .where(inArray(alliances.allianceId as any, allianceIds))
      .execute();
    for (const nr of allianceRows) {
      allianceNamesMap[nr.id] = nr.name;
    }
  }

  return {
    characters: [],
    corporations: topCorpsAgainst.map((row) => ({
      id: row.corporationId || 0,
      name: corpNamesMap[row.corporationId || 0] || "Unknown",
      kills: row.kills || 0,
      imageUrl: row.corporationId
        ? `https://images.evetech.net/corporations/${row.corporationId}/logo?size=64`
        : undefined,
    })),
    alliances: topAlliancesAgainst.map((row) => ({
      id: row.allianceId || 0,
      name: allianceNamesMap[row.allianceId || 0] || "Unknown",
      kills: row.kills || 0,
      imageUrl: row.allianceId
        ? `https://images.evetech.net/alliances/${row.allianceId}/logo?size=64`
        : undefined,
    })),
    systems: topSysAgainst.map((row) => ({
      id: row.systemId || 0,
      name: row.name || "Unknown",
      kills: row.kills || 0,
    })),
    regions: topRegAgainst.map((row) => ({
      id: row.regionId || 0,
      name: row.name || "Unknown",
      kills: row.kills || 0,
    })),
  };
}

/**
 * Get top 10 entities involved in kills by a specific corporation
 */
export async function getTop10StatsByCorporation(corporationId: number, days: number = 7): Promise<Top10Stats> {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);

  // Top alliances
  const topAlliancesAgainst = await db
    .select({
      allianceId: victims.allianceId,
      kills: sql<number>`COUNT(DISTINCT ${killmails.id})`,
    })
    .from(killmails)
    .innerJoin(victims, eq(killmails.id, victims.killmailId))
    .innerJoin(attackers, eq(killmails.id, attackers.killmailId))
    .where(
      and(
        gte(killmails.killmailTime, daysAgo),
        eq(attackers.corporationId, corporationId),
        sql`${victims.allianceId} IS NOT NULL`
      )
    )
    .groupBy(victims.allianceId)
    .orderBy(sql`COUNT(DISTINCT ${killmails.id}) DESC`)
    .limit(10)
    .execute();

  // Top systems
  const topSysAgainst = await db
    .select({
      systemId: killmails.solarSystemId,
      name: solarSystems.name,
      kills: sql<number>`COUNT(DISTINCT ${killmails.id})`,
    })
    .from(killmails)
    .leftJoin(solarSystems, eq(killmails.solarSystemId, solarSystems.systemId))
    .innerJoin(attackers, eq(killmails.id, attackers.killmailId))
    .where(
      and(
        gte(killmails.killmailTime, daysAgo),
        eq(attackers.corporationId, corporationId)
      )
    )
    .groupBy(killmails.solarSystemId, solarSystems.name)
    .orderBy(sql`COUNT(DISTINCT ${killmails.id}) DESC`)
    .limit(10)
    .execute();

  // Top regions
  const topRegAgainst = await db
    .select({
      regionId: solarSystems.regionId,
      name: sql<string>`COALESCE(${regions.name}, 'Unknown Region')`,
      kills: sql<number>`COUNT(${killmails.id})`,
    })
    .from(killmails)
    .leftJoin(solarSystems, eq(killmails.solarSystemId, solarSystems.systemId))
    .leftJoin(regions, eq(solarSystems.regionId, regions.regionId))
    .innerJoin(attackers, eq(killmails.id, attackers.killmailId))
    .where(
      and(
        gte(killmails.killmailTime, daysAgo),
        eq(attackers.corporationId, corporationId)
      )
    )
    .groupBy(solarSystems.regionId, regions.name)
    .orderBy(sql`COUNT(${killmails.id}) DESC`)
    .limit(10)
    .execute();

  // Fetch alliance names
  const allianceIds = topAlliancesAgainst.map((r) => r.allianceId).filter(Boolean);
  const allianceNamesMap: Record<number, string> = {};
  if (allianceIds.length > 0) {
    const allianceRows = await db
      .select({ id: alliances.allianceId, name: alliances.name })
      .from(alliances)
      .where(inArray(alliances.allianceId as any, allianceIds))
      .execute();
    for (const nr of allianceRows) {
      allianceNamesMap[nr.id] = nr.name;
    }
  }

  return {
    characters: [],
    corporations: [],
    alliances: topAlliancesAgainst.map((row) => ({
      id: row.allianceId || 0,
      name: allianceNamesMap[row.allianceId || 0] || "Unknown",
      kills: row.kills || 0,
      imageUrl: row.allianceId
        ? `https://images.evetech.net/alliances/${row.allianceId}/logo?size=64`
        : undefined,
    })),
    systems: topSysAgainst.map((row) => ({
      id: row.systemId || 0,
      name: row.name || "Unknown",
      kills: row.kills || 0,
    })),
    regions: topRegAgainst.map((row) => ({
      id: row.regionId || 0,
      name: row.name || "Unknown",
      kills: row.kills || 0,
    })),
  };
}

/**
 * Get top 10 entities involved in kills by a specific alliance
 */
export async function getTop10StatsByAlliance(allianceId: number, days: number = 7): Promise<Top10Stats> {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);

  // Top systems
  const topSysAgainst = await db
    .select({
      systemId: sql<number>`${killmails.solarSystemId}`,
      name: sql<string>`${solarSystems.name}`,
      kills: sql<number>`COUNT(DISTINCT ${killmails.id})`,
    })
    .from(killmails)
    .leftJoin(solarSystems, eq(killmails.solarSystemId, solarSystems.systemId))
    .innerJoin(attackers, eq(killmails.id, attackers.killmailId))
    .where(
      and(
        gte(killmails.killmailTime, daysAgo),
        eq(attackers.allianceId, allianceId)
      )
    )
    .groupBy(killmails.solarSystemId, solarSystems.name)
    .orderBy(sql`COUNT(DISTINCT ${killmails.id}) DESC`)
    .limit(10)
    .execute();

  // Top regions
  const topRegAgainst = await db
    .select({
      regionId: sql<number>`${solarSystems.regionId}`,
      name: sql<string>`COALESCE(${regions.name}, 'Unknown Region')`,
      kills: sql<number>`COUNT(${killmails.id})`,
    })
    .from(killmails)
    .leftJoin(solarSystems, eq(killmails.solarSystemId, solarSystems.systemId))
    .leftJoin(regions, eq(solarSystems.regionId, regions.regionId))
    .innerJoin(attackers, eq(killmails.id, attackers.killmailId))
    .where(
      and(
        gte(killmails.killmailTime, daysAgo),
        eq(attackers.allianceId, allianceId)
      )
    )
    .groupBy(solarSystems.regionId, regions.name)
    .orderBy(sql`COUNT(${killmails.id}) DESC`)
    .limit(10)
    .execute();

  return {
    characters: [],
    corporations: [],
    alliances: [],
    systems: topSysAgainst.map((row) => ({
      id: row.systemId || 0,
      name: row.name || "Unknown",
      kills: row.kills || 0,
    })),
    regions: topRegAgainst.map((row) => ({
      id: row.regionId || 0,
      name: row.name || "Unknown",
      kills: row.kills || 0,
    })),
  };
}

/**
 * Get top 10 entities/locations involved in kills by multiple tracked entities
 * Used for the entities dashboard showing combined stats for all tracked characters/corporations/alliances
 */
export async function getTop10StatsByEntities(
  characterIds?: number[],
  corporationIds?: number[],
  allianceIds?: number[],
  days: number = 7
): Promise<Top10Stats> {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);

  // Build conditions for all tracked entity types
  const conditions = [];

  if (characterIds && characterIds.length > 0) {
    conditions.push(inArray(attackers.characterId, characterIds));
  }

  if (corporationIds && corporationIds.length > 0) {
    conditions.push(inArray(attackers.corporationId, corporationIds));
  }

  if (allianceIds && allianceIds.length > 0) {
    conditions.push(inArray(attackers.allianceId, allianceIds));
  }

  // If no entities provided, return empty stats
  if (conditions.length === 0) {
    return {
      characters: [],
      corporations: [],
      alliances: [],
      systems: [],
      regions: [],
    };
  }

  // Combine conditions with OR logic
  const whereClause = and(gte(killmails.killmailTime, daysAgo), sql`(${sql.join(conditions, sql` OR `)})`);

  // Get top opponents (those being killed by our tracked entities)
  const [topCharAgainst, topCorpAgainst, topAllyAgainst, topSysAgainst, topRegAgainst] = await Promise.all([
    db
      .select({
        characterId: victims.characterId,
        name: characters.name,
        kills: sql<number>`COUNT(DISTINCT ${killmails.id})`,
      })
      .from(attackers)
      .innerJoin(killmails, eq(attackers.killmailId, killmails.id))
      .innerJoin(victims, eq(killmails.id, victims.killmailId))
      .leftJoin(characters, eq(victims.characterId, characters.characterId))
      .where(whereClause)
      .groupBy(victims.characterId, characters.name)
      .orderBy(sql`COUNT(DISTINCT ${killmails.id}) DESC`)
      .limit(10),
    db
      .select({
        corporationId: victims.corporationId,
        name: corporations.name,
        kills: sql<number>`COUNT(DISTINCT ${killmails.id})`,
      })
      .from(attackers)
      .innerJoin(killmails, eq(attackers.killmailId, killmails.id))
      .innerJoin(victims, eq(killmails.id, victims.killmailId))
      .leftJoin(corporations, eq(victims.corporationId, corporations.corporationId))
      .where(whereClause)
      .groupBy(victims.corporationId, corporations.name)
      .orderBy(sql`COUNT(DISTINCT ${killmails.id}) DESC`)
      .limit(10),
    db
      .select({
        allianceId: victims.allianceId,
        name: alliances.name,
        kills: sql<number>`COUNT(DISTINCT ${killmails.id})`,
      })
      .from(attackers)
      .innerJoin(killmails, eq(attackers.killmailId, killmails.id))
      .innerJoin(victims, eq(killmails.id, victims.killmailId))
      .leftJoin(alliances, eq(victims.allianceId, alliances.allianceId))
      .where(whereClause)
      .groupBy(victims.allianceId, alliances.name)
      .orderBy(sql`COUNT(DISTINCT ${killmails.id}) DESC`)
      .limit(10),
    db
      .select({
        systemId: killmails.solarSystemId,
        name: solarSystems.name,
        kills: sql<number>`COUNT(DISTINCT ${killmails.id})`,
      })
      .from(attackers)
      .innerJoin(killmails, eq(attackers.killmailId, killmails.id))
      .leftJoin(solarSystems, eq(killmails.solarSystemId, solarSystems.systemId))
      .where(whereClause)
      .groupBy(killmails.solarSystemId, solarSystems.name)
      .orderBy(sql`COUNT(DISTINCT ${killmails.id}) DESC`)
      .limit(10),
    db
      .select({
        regionId: solarSystems.regionId,
        name: regions.name,
        kills: sql<number>`COUNT(DISTINCT ${killmails.id})`,
      })
      .from(attackers)
      .innerJoin(killmails, eq(attackers.killmailId, killmails.id))
      .leftJoin(solarSystems, eq(killmails.solarSystemId, solarSystems.systemId))
      .leftJoin(regions, eq(solarSystems.regionId, regions.regionId))
      .where(whereClause)
      .groupBy(solarSystems.regionId, regions.name)
      .orderBy(sql`COUNT(DISTINCT ${killmails.id}) DESC`)
      .limit(10),
  ]);

  return {
    characters: topCharAgainst.map((row) => ({
      id: row.characterId || 0,
      name: row.name || "Unknown",
      kills: row.kills || 0,
    })),
    corporations: topCorpAgainst.map((row) => ({
      id: row.corporationId || 0,
      name: row.name || "Unknown",
      kills: row.kills || 0,
    })),
    alliances: topAllyAgainst.map((row) => ({
      id: row.allianceId || 0,
      name: row.name || "Unknown",
      kills: row.kills || 0,
    })),
    systems: topSysAgainst.map((row) => ({
      id: row.systemId || 0,
      name: row.name || "Unknown",
      kills: row.kills || 0,
    })),
    regions: topRegAgainst.map((row) => ({
      id: row.regionId || 0,
      name: row.name || "Unknown",
      kills: row.kills || 0,
    })),
  };
}

/**
 * Get top 10 stats for a specific solar system
 * Shows top characters, corporations, alliances in that system
 */
export async function getTop10StatsBySystem(
  solarSystemId: number,
  days: number = 7
): Promise<Top10Stats> {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);

  const whereClause = and(
    gte(killmails.killmailTime, daysAgo),
    eq(killmails.solarSystemId, solarSystemId)
  );

  const [topCharacters, topCorporations, topAlliances] = await Promise.all([
    db
      .select({
        characterId: attackers.characterId,
        name: characters.name,
        kills: sql<number>`COUNT(DISTINCT ${killmails.id})`.mapWith(Number),
      })
      .from(attackers)
      .leftJoin(killmails, eq(attackers.killmailId, killmails.id))
      .leftJoin(characters, eq(attackers.characterId, characters.characterId))
      .where(and(whereClause, sql`${attackers.characterId} IS NOT NULL`))
      .groupBy(attackers.characterId, characters.name)
      .orderBy(sql`COUNT(DISTINCT ${killmails.id}) DESC`)
      .limit(10),

    db
      .select({
        corporationId: attackers.corporationId,
        name: corporations.name,
        kills: sql<number>`COUNT(DISTINCT ${killmails.id})`.mapWith(Number),
      })
      .from(attackers)
      .leftJoin(killmails, eq(attackers.killmailId, killmails.id))
      .leftJoin(corporations, eq(attackers.corporationId, corporations.corporationId))
      .where(and(whereClause, sql`${attackers.corporationId} IS NOT NULL`))
      .groupBy(attackers.corporationId, corporations.name)
      .orderBy(sql`COUNT(DISTINCT ${killmails.id}) DESC`)
      .limit(10),

    db
      .select({
        allianceId: attackers.allianceId,
        name: alliances.name,
        kills: sql<number>`COUNT(DISTINCT ${killmails.id})`.mapWith(Number),
      })
      .from(attackers)
      .leftJoin(killmails, eq(attackers.killmailId, killmails.id))
      .leftJoin(alliances, eq(attackers.allianceId, alliances.allianceId))
      .where(and(whereClause, sql`${attackers.allianceId} IS NOT NULL`))
      .groupBy(attackers.allianceId, alliances.name)
      .orderBy(sql`COUNT(DISTINCT ${killmails.id}) DESC`)
      .limit(10),
  ]);

  return {
    characters: topCharacters.map((row) => ({
      id: row.characterId || 0,
      name: row.name || "Unknown",
      kills: row.kills || 0,
    })),
    corporations: topCorporations.map((row) => ({
      id: row.corporationId || 0,
      name: row.name || "Unknown",
      kills: row.kills || 0,
    })),
    alliances: topAlliances.map((row) => ({
      id: row.allianceId || 0,
      name: row.name || "Unknown",
      kills: row.kills || 0,
    })),
    systems: [],
    regions: [],
  };
}

/**
 * Get top 10 stats for a specific region
 * Shows top characters, corporations, alliances in that region
 */
export async function getTop10StatsByRegion(
  regionId: number,
  days: number = 7
): Promise<Top10Stats> {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);

  const whereClause = and(
    gte(killmails.killmailTime, daysAgo),
    eq(solarSystems.regionId, regionId)
  );

  const [topCharacters, topCorporations, topAlliances] = await Promise.all([
    db
      .select({
        characterId: attackers.characterId,
        name: characters.name,
        kills: sql<number>`COUNT(DISTINCT ${killmails.id})`.mapWith(Number),
      })
      .from(attackers)
      .leftJoin(killmails, eq(attackers.killmailId, killmails.id))
      .leftJoin(solarSystems, eq(killmails.solarSystemId, solarSystems.systemId))
      .leftJoin(characters, eq(attackers.characterId, characters.characterId))
      .where(and(whereClause, sql`${attackers.characterId} IS NOT NULL`))
      .groupBy(attackers.characterId, characters.name)
      .orderBy(sql`COUNT(DISTINCT ${killmails.id}) DESC`)
      .limit(10),

    db
      .select({
        corporationId: attackers.corporationId,
        name: corporations.name,
        kills: sql<number>`COUNT(DISTINCT ${killmails.id})`.mapWith(Number),
      })
      .from(attackers)
      .leftJoin(killmails, eq(attackers.killmailId, killmails.id))
      .leftJoin(solarSystems, eq(killmails.solarSystemId, solarSystems.systemId))
      .leftJoin(corporations, eq(attackers.corporationId, corporations.corporationId))
      .where(and(whereClause, sql`${attackers.corporationId} IS NOT NULL`))
      .groupBy(attackers.corporationId, corporations.name)
      .orderBy(sql`COUNT(DISTINCT ${killmails.id}) DESC`)
      .limit(10),

    db
      .select({
        allianceId: attackers.allianceId,
        name: alliances.name,
        kills: sql<number>`COUNT(DISTINCT ${killmails.id})`.mapWith(Number),
      })
      .from(attackers)
      .leftJoin(killmails, eq(attackers.killmailId, killmails.id))
      .leftJoin(solarSystems, eq(killmails.solarSystemId, solarSystems.systemId))
      .leftJoin(alliances, eq(attackers.allianceId, alliances.allianceId))
      .where(and(whereClause, sql`${attackers.allianceId} IS NOT NULL`))
      .groupBy(attackers.allianceId, alliances.name)
      .orderBy(sql`COUNT(DISTINCT ${killmails.id}) DESC`)
      .limit(10),
  ]);

  return {
    characters: topCharacters.map((row) => ({
      id: row.characterId || 0,
      name: row.name || "Unknown",
      kills: row.kills || 0,
    })),
    corporations: topCorporations.map((row) => ({
      id: row.corporationId || 0,
      name: row.name || "Unknown",
      kills: row.kills || 0,
    })),
    alliances: topAlliances.map((row) => ({
      id: row.allianceId || 0,
      name: row.name || "Unknown",
      kills: row.kills || 0,
    })),
    systems: [],
    regions: [],
  };
}



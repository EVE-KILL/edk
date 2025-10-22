import { db } from "../../src/db";
import {
  killmails,
  attackers,
  characters,
  corporations,
  alliances,
  regions,
  solarSystems,
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

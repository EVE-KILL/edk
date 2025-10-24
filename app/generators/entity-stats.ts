import { db } from "../../src/db";
import {
  killmails,
  victims,
  attackers,
  characters,
  corporations,
  alliances,
} from "../../db/schema";
import { eq, and, sql, inArray, gte } from "drizzle-orm";

/**
 * Unified entity stats filters
 */
export interface EntityStatsFilters {
  characterIds?: number[];
  corporationIds?: number[];
  allianceIds?: number[];
  days?: number; // Time period filter (e.g., last 7 days, 30 days)
  statsType?: "all" | "kills" | "losses"; // Activity type
}

/**
 * Entity statistics structure
 */
export interface EntityStats {
  kills: number;
  losses: number;
  killLossRatio: number;
  efficiency: number;
  iskDestroyed: string;
  iskLost: string;
  iskEfficiency: number;
}

/**
 * Unified function to get entity statistics
 * Works for characters, corporations, alliances, or any combination
 * Handles different stat types (all, kills-only, losses-only)
 * Supports time period filtering
 */
export async function getEntityStats(
  filters: EntityStatsFilters
): Promise<EntityStats> {
  const { days, statsType = "all" } = filters;

  // Build time filter if specified
  const timeFilter = days
    ? gte(
        killmails.killmailTime,
        sql`strftime('%s', 'now', '-${sql.raw(days.toString())} days')`
      )
    : undefined;

  // Get kills count and ISK destroyed
  let kills = 0;
  let iskDestroyed = "0";

  if (statsType === "all" || statsType === "kills") {
    const killConditions = buildKillFilterConditions(filters);

    const [killsResult] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${killmails.id})`.mapWith(Number),
        totalValue: sql<string>`CAST(COALESCE(SUM(CAST(${killmails.totalValue} AS REAL)), 0) AS TEXT)`,
      })
      .from(killmails)
      .innerJoin(attackers, eq(killmails.id, attackers.killmailId))
      .where(
        and(...killConditions, timeFilter ? timeFilter : undefined)
      )
      .execute();

    kills = killsResult?.count || 0;
    iskDestroyed = killsResult?.totalValue || "0";
  }

  // Get losses count and ISK lost
  let losses = 0;
  let iskLost = "0";

  if (statsType === "all" || statsType === "losses") {
    const lossConditions = buildLossFilterConditions(filters);

    const [lossesResult] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${killmails.id})`.mapWith(Number),
        totalValue: sql<string>`CAST(COALESCE(SUM(CAST(${killmails.totalValue} AS REAL)), 0) AS TEXT)`,
      })
      .from(killmails)
      .innerJoin(victims, eq(killmails.id, victims.killmailId))
      .where(
        and(...lossConditions, timeFilter ? timeFilter : undefined)
      )
      .execute();

    losses = lossesResult?.count || 0;
    iskLost = lossesResult?.totalValue || "0";
  }

  // Calculate ratios and efficiencies
  const killLossRatio = losses > 0 ? kills / losses : kills;
  const efficiency =
    kills + losses > 0 ? (kills / (kills + losses)) * 100 : 0;

  const iskDestroyedNum = parseFloat(iskDestroyed);
  const iskLostNum = parseFloat(iskLost);
  const iskEfficiency =
    iskDestroyedNum + iskLostNum > 0
      ? (iskDestroyedNum / (iskDestroyedNum + iskLostNum)) * 100
      : 0;

  return {
    kills,
    losses,
    killLossRatio,
    efficiency,
    iskDestroyed,
    iskLost,
    iskEfficiency,
  };
}

/**
 * Build filter conditions for KILLS (where entity is attacker)
 */
function buildKillFilterConditions(filters: EntityStatsFilters): any[] {
  const conditions: any[] = [];

  if (filters.characterIds && filters.characterIds.length > 0) {
    conditions.push(inArray(attackers.characterId, filters.characterIds));
  }

  if (filters.corporationIds && filters.corporationIds.length > 0) {
    conditions.push(inArray(attackers.corporationId, filters.corporationIds));
  }

  if (filters.allianceIds && filters.allianceIds.length > 0) {
    conditions.push(inArray(attackers.allianceId, filters.allianceIds));
  }

  // If no filters provided, return a condition that matches nothing
  if (conditions.length === 0) {
    conditions.push(sql`1 = 0`);
  }

  return conditions;
}

/**
 * Build filter conditions for LOSSES (where entity is victim)
 */
function buildLossFilterConditions(filters: EntityStatsFilters): any[] {
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

  // If no filters provided, return a condition that matches nothing
  if (conditions.length === 0) {
    conditions.push(sql`1 = 0`);
  }

  return conditions;
}

/**
 * Get entity information (name, ticker, etc.) for a single entity
 */
export async function getEntityInfo(
  entityType: "character" | "corporation" | "alliance",
  entityId: number
): Promise<any> {
  switch (entityType) {
    case "character": {
      const characterData = await db
        .select({
          id: characters.characterId,
          name: characters.name,
          corporationId: characters.corporationId,
          allianceId: characters.allianceId,
          corporationName: corporations.name,
          corporationTicker: corporations.ticker,
        })
        .from(characters)
        .leftJoin(
          corporations,
          eq(characters.corporationId, corporations.corporationId)
        )
        .where(eq(characters.characterId, entityId))
        .limit(1)
        .then((r) => r[0]);

      if (!characterData) return null;

      // Get alliance info if character has one
      let allianceData: { name: string; ticker: string } | undefined = undefined;
      if (characterData.allianceId) {
        allianceData = await db
          .select({
            name: alliances.name,
            ticker: alliances.ticker,
          })
          .from(alliances)
          .where(eq(alliances.allianceId, characterData.allianceId))
          .limit(1)
          .then((r) => r[0]);
      }

      return {
        id: characterData.id,
        name: characterData.name,
        corporationId: characterData.corporationId,
        corporationName: characterData.corporationName || undefined,
        corporationTicker: characterData.corporationTicker || undefined,
        allianceId: characterData.allianceId || undefined,
        allianceName: allianceData?.name || undefined,
        allianceTicker: allianceData?.ticker || undefined,
      };
    }

    case "corporation": {
      const corporationData = await db
        .select({
          id: corporations.corporationId,
          name: corporations.name,
          ticker: corporations.ticker,
          allianceId: corporations.allianceId,
        })
        .from(corporations)
        .where(eq(corporations.corporationId, entityId))
        .limit(1)
        .then((r) => r[0]);

      if (!corporationData) return null;

      // Get alliance info if corporation has one
      let allianceData: { name: string; ticker: string } | undefined = undefined;
      if (corporationData.allianceId) {
        allianceData = await db
          .select({
            name: alliances.name,
            ticker: alliances.ticker,
          })
          .from(alliances)
          .where(eq(alliances.allianceId, corporationData.allianceId))
          .limit(1)
          .then((r) => r[0]);
      }

      return {
        id: corporationData.id,
        name: corporationData.name,
        ticker: corporationData.ticker,
        allianceId: corporationData.allianceId || undefined,
        allianceName: allianceData?.name || undefined,
        allianceTicker: allianceData?.ticker || undefined,
      };
    }

    case "alliance": {
      const alliance = await db
        .select({
          id: alliances.allianceId,
          name: alliances.name,
          ticker: alliances.ticker,
        })
        .from(alliances)
        .where(eq(alliances.allianceId, entityId))
        .limit(1)
        .then((r) => r[0]);

      return alliance
        ? {
            id: alliance.id,
            name: alliance.name,
            ticker: alliance.ticker,
          }
        : null;
    }
  }
}

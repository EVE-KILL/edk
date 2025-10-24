import { db } from "../../src/db";
import {
  entityStats,
  characters,
  corporations,
  alliances,
} from "../../db/schema";
import { eq, and, sql, inArray, or } from "drizzle-orm";

/**
 * Unified entity stats filters
 */
export interface EntityStatsFilters {
  characterIds?: number[];
  corporationIds?: number[];
  allianceIds?: number[];
  days?: number; // NOTE: Time-based filtering not supported with materialized table
  statsType?: "all" | "kills" | "losses"; // Activity type (kills-only and losses-only also not fully supported)
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
 *
 * Queries the pre-calculated entity_stats table and sums across matching entities:
 * - Single character: Query that character's row
 * - Corporation: Query that corporation row directly (stats already pre-calculated)
 * - Alliance: Query that alliance row directly (stats already pre-calculated)
 * - Multiple entities: SUM across all matching entity rows (no nested aggregation needed)
 *
 * Performance: ~1-2ms (single SUM query across followed entities, no OR complexity)
 */
export async function getEntityStats(
  filters: EntityStatsFilters
): Promise<EntityStats> {
  const { statsType = "all" } = filters;

  // Build simple WHERE conditions - just match entity_type and entityId directly
  // No need for complex OR logic since corporations/alliances already have their own rows
  const entityConditions: any[] = [];

  if (filters.characterIds && filters.characterIds.length > 0) {
    entityConditions.push(
      and(
        eq(entityStats.entityType, "character"),
        inArray(entityStats.entityId, filters.characterIds)
      )
    );
  }

  if (filters.corporationIds && filters.corporationIds.length > 0) {
    entityConditions.push(
      and(
        eq(entityStats.entityType, "corporation"),
        inArray(entityStats.entityId, filters.corporationIds)
      )
    );
  }

  if (filters.allianceIds && filters.allianceIds.length > 0) {
    entityConditions.push(
      and(
        eq(entityStats.entityType, "alliance"),
        inArray(entityStats.entityId, filters.allianceIds)
      )
    );
  }

  // Combine all entity conditions with OR
  if (entityConditions.length === 0) {
    // No filters provided, return empty stats
    return {
      kills: 0,
      losses: 0,
      killLossRatio: 0,
      efficiency: 0,
      iskDestroyed: "0",
      iskLost: "0",
      iskEfficiency: 0,
    };
  }

  // Use SQL SUM to aggregate across all matched entities
  // Each matched entity (character, corporation, or alliance) is a single row
  // Just sum all their stats - simple and fast
  const [aggregated] = await db
    .select({
      totalKills: sql<number>`CAST(COALESCE(SUM(${entityStats.kills}), 0) AS INTEGER)`,
      totalLosses: sql<number>`CAST(COALESCE(SUM(${entityStats.losses}), 0) AS INTEGER)`,
      totalIskDestroyed: sql<string>`CAST(COALESCE(SUM(CAST(${entityStats.iskDestroyed} AS REAL)), 0) AS TEXT)`,
      totalIskLost: sql<string>`CAST(COALESCE(SUM(CAST(${entityStats.iskLost} AS REAL)), 0) AS TEXT)`,
    })
    .from(entityStats)
    .where(or(...entityConditions));

  if (!aggregated) {
    return {
      kills: 0,
      losses: 0,
      killLossRatio: 0,
      efficiency: 0,
      iskDestroyed: "0",
      iskLost: "0",
      iskEfficiency: 0,
    };
  }

  const totalKills = aggregated.totalKills || 0;
  const totalLosses = aggregated.totalLosses || 0;
  const totalIskDestroyed = parseFloat(aggregated.totalIskDestroyed || "0");
  const totalIskLost = parseFloat(aggregated.totalIskLost || "0");

  // Calculate aggregated metrics from totals
  const killLossRatio = totalLosses > 0 ? totalKills / totalLosses : totalKills;
  const efficiency =
    totalKills + totalLosses > 0
      ? (totalKills / (totalKills + totalLosses)) * 100
      : 0;
  const iskEfficiency =
    totalIskDestroyed + totalIskLost > 0
      ? (totalIskDestroyed / (totalIskDestroyed + totalIskLost)) * 100
      : 0;

  return {
    kills: totalKills,
    losses: totalLosses,
    killLossRatio,
    efficiency,
    iskDestroyed: totalIskDestroyed.toString(),
    iskLost: totalIskLost.toString(),
    iskEfficiency,
  };
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

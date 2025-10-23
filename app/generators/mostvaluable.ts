import { db } from "../../src/db";
import {
  killmails,
  victims,
  characters,
  corporations,
  alliances,
  solarSystems,
  regions,
  types,
  groups,
} from "../../db/schema";
import { eq, desc, and, gte, sql, inArray, or } from "drizzle-orm";
import type { KilllistFilters } from "./killlist";

export interface MostValuableKill {
  killmail_id: number;
  killmail_time: Date;
  victim: {
    character: { id: number; name: string } | null;
    corporation: { id: number; name: string; ticker: string } | null;
    alliance: { id: number; name: string; ticker: string } | null;
    ship: { type_id: number; name: string; group: string };
  };
  solar_system: { id: number; name: string; region_id: number; region: string };
  ship_value: number;
  total_value: number;
}

export interface MostValuableFilters {
  days?: number; // Number of days to look back (default: undefined = all time)
  limit?: number; // Number of results to return (default: 7)
  minValue?: number; // Minimum ISK value filter (default: 0)
  characterIds?: number[]; // Filter by character IDs (victim)
  corporationIds?: number[]; // Filter by corporation IDs (victim)
  allianceIds?: number[]; // Filter by alliance IDs (victim)
}

/**
 * Generate a list of the most valuable kills sorted by total value descending
 * By default, fetches the most expensive kills from the entire database
 *
 * Example: getMostValuableKills({ limit: 10 })
 * Returns: Top 10 most expensive killmails ever
 *
 * Example: getMostValuableKills({ days: 30, limit: 7 })
 * Returns: Top 7 most expensive killmails from last 30 days
 */
export async function getMostValuableKills(
  filters: MostValuableFilters = {}
): Promise<MostValuableKill[]> {
  try {
    const {
      limit = 7,
      minValue = 0,
      days,
      characterIds,
      corporationIds,
      allianceIds,
    } = filters;

    // Build where conditions
    const conditions = [];

    // Add value filter (default: 0, meaning all kills)
    if (minValue > 0) {
      conditions.push(sql`CAST(${killmails.totalValue} AS REAL) >= ${minValue}`);
    }

    // Add time range filter if specified
    if (days !== undefined) {
      const now = new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      conditions.push(gte(killmails.killmailTime, startDate));
    }

    // Add entity filters (any victim matching these entities)
    const entityConditions = [];
    if (characterIds && characterIds.length > 0) {
      entityConditions.push(inArray(victims.characterId, characterIds));
    }
    if (corporationIds && corporationIds.length > 0) {
      entityConditions.push(inArray(victims.corporationId, corporationIds));
    }
    if (allianceIds && allianceIds.length > 0) {
      entityConditions.push(inArray(victims.allianceId, allianceIds));
    }
    if (entityConditions.length > 0) {
      conditions.push(or(...entityConditions));
    }

    // Build the base query with where clause
    const query = db
      .select({
        killmail_id: killmails.killmailId,
        killmail_time: killmails.killmailTime,
        victim_character_id: victims.characterId,
        victim_corporation_id: victims.corporationId,
        victim_alliance_id: victims.allianceId,
        victim_ship_type_id: victims.shipTypeId,
        victim_character_name: characters.name,
        victim_corporation_name: corporations.name,
        victim_corporation_ticker: corporations.ticker,
        victim_alliance_name: alliances.name,
        victim_alliance_ticker: alliances.ticker,
        victim_ship_name: types.name,
        victim_ship_group: groups.name,
        ship_value: killmails.shipValue,
        total_value: killmails.totalValue,
        solar_system_id: solarSystems.systemId,
        solar_system_name: solarSystems.name,
        region_id: solarSystems.regionId,
        region_name: regions.name,
      })
      .from(killmails)
      .leftJoin(victims, eq(victims.killmailId, killmails.id))
      .leftJoin(characters, eq(characters.characterId, victims.characterId))
      .leftJoin(corporations, eq(corporations.corporationId, victims.corporationId))
      .leftJoin(alliances, eq(alliances.allianceId, victims.allianceId))
      .leftJoin(types, eq(types.typeId, victims.shipTypeId))
      .leftJoin(groups, eq(groups.groupId, types.groupId))
      .leftJoin(solarSystems, eq(solarSystems.systemId, killmails.solarSystemId))
      .leftJoin(regions, eq(regions.regionId, solarSystems.regionId));

    // Apply conditions if any
    const finalQuery = conditions.length > 0
      ? query.where(and(...conditions))
      : query;

    // Execute query sorted by total value descending (cast to REAL for numeric sort)
    const results = await finalQuery
      .orderBy(sql`CAST(${killmails.totalValue} AS REAL) DESC`)
      .limit(limit);

    // Transform results into the expected format
    const kills = results.map((result) => ({
      killmail_id: result.killmail_id,
      killmail_time: result.killmail_time,
      victim: {
        character: result.victim_character_id
          ? {
              id: result.victim_character_id,
              name: result.victim_character_name || "Unknown",
            }
          : null,
        corporation: result.victim_corporation_id
          ? {
              id: result.victim_corporation_id,
              name: result.victim_corporation_name || "Unknown",
              ticker: result.victim_corporation_ticker || "",
            }
          : null,
        alliance: result.victim_alliance_id
          ? {
              id: result.victim_alliance_id,
              name: result.victim_alliance_name || "Unknown",
              ticker: result.victim_alliance_ticker || "",
            }
          : null,
        ship: {
          type_id: result.victim_ship_type_id || 0,
          name: result.victim_ship_name || "Unknown Ship",
          group: result.victim_ship_group || "Ship",
        },
      },
      solar_system: {
        id: result.solar_system_id || 0,
        name: result.solar_system_name || "Unknown System",
        region_id: result.region_id || 0,
        region: result.region_name || "Unknown Region",
      },
      ship_value: parseInt(result.ship_value as any) || 0,
      total_value: parseInt(result.total_value as any) || 0,
    }));

    return kills;
  } catch (error) {
    console.error("[Most Valuable Generator] Error:", error);
    return [];
  }
}

/**
 * Get most valuable kills with full killlist filters support
 * This applies the same filters as the killlist (security, regions, ship groups, value, etc.)
 */
export async function getMostValuableKillsWithFilters(
  days: number = 30,
  filters?: KilllistFilters,
  limit: number = 7
): Promise<MostValuableKill[]> {
  try {
    const conditions = [];

    // Add time range filter
    if (days) {
      const now = new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      conditions.push(gte(killmails.killmailTime, startDate));
    }

    if (!filters) {
      // No filters, just time-based query
      const results = await db
        .select({
          killmail_id: killmails.killmailId,
          killmail_time: killmails.killmailTime,
          victim_character_id: victims.characterId,
          victim_corporation_id: victims.corporationId,
          victim_alliance_id: victims.allianceId,
          victim_ship_type_id: victims.shipTypeId,
          victim_character_name: characters.name,
          victim_corporation_name: corporations.name,
          victim_corporation_ticker: corporations.ticker,
          victim_alliance_name: alliances.name,
          victim_alliance_ticker: alliances.ticker,
          victim_ship_name: types.name,
          victim_ship_group: groups.name,
          ship_value: killmails.shipValue,
          total_value: killmails.totalValue,
          solar_system_id: solarSystems.systemId,
          solar_system_name: solarSystems.name,
          region_id: solarSystems.regionId,
          region_name: regions.name,
        })
        .from(killmails)
        .leftJoin(victims, eq(victims.killmailId, killmails.id))
        .leftJoin(characters, eq(characters.characterId, victims.characterId))
        .leftJoin(corporations, eq(corporations.corporationId, victims.corporationId))
        .leftJoin(alliances, eq(alliances.allianceId, victims.allianceId))
        .leftJoin(types, eq(types.typeId, victims.shipTypeId))
        .leftJoin(groups, eq(groups.groupId, types.groupId))
        .leftJoin(solarSystems, eq(solarSystems.systemId, killmails.solarSystemId))
        .leftJoin(regions, eq(regions.regionId, solarSystems.regionId))
        .where(and(...conditions))
        .orderBy(sql`CAST(${killmails.totalValue} AS REAL) DESC`)
        .limit(limit);

      return results.map((result) => ({
        killmail_id: result.killmail_id,
        killmail_time: result.killmail_time,
        victim: {
          character: result.victim_character_id
            ? {
                id: result.victim_character_id,
                name: result.victim_character_name || "Unknown",
              }
            : null,
          corporation: result.victim_corporation_id
            ? {
                id: result.victim_corporation_id,
                name: result.victim_corporation_name || "Unknown",
                ticker: result.victim_corporation_ticker || "",
              }
            : null,
          alliance: result.victim_alliance_id
            ? {
                id: result.victim_alliance_id,
                name: result.victim_alliance_name || "Unknown",
                ticker: result.victim_alliance_ticker || "",
              }
            : null,
          ship: {
            type_id: result.victim_ship_type_id || 0,
            name: result.victim_ship_name || "Unknown Ship",
            group: result.victim_ship_group || "Ship",
          },
        },
        solar_system: {
          id: result.solar_system_id || 0,
          name: result.solar_system_name || "Unknown System",
          region_id: result.region_id || 0,
          region: result.region_name || "Unknown Region",
        },
        ship_value: parseInt(result.ship_value as any) || 0,
        total_value: parseInt(result.total_value as any) || 0,
      }));
    }

    // Add security status filters
    if (filters.minSecurityStatus !== undefined) {
      conditions.push(
        sql`CAST(${solarSystems.securityStatus} AS REAL) >= ${filters.minSecurityStatus}`
      );
    }
    if (filters.maxSecurityStatus !== undefined) {
      conditions.push(
        sql`CAST(${solarSystems.securityStatus} AS REAL) <= ${filters.maxSecurityStatus}`
      );
    }

    // Add region filters
    if (filters.regionId) {
      conditions.push(eq(solarSystems.regionId, filters.regionId));
    }

    // Add region range filter (for abyssal/wspace)
    if (filters.regionIdMin !== undefined && filters.regionIdMax !== undefined) {
      conditions.push(
        and(
          gte(solarSystems.regionId, filters.regionIdMin),
          sql`${solarSystems.regionId} <= ${filters.regionIdMax}`
        )
      );
    }

    // Add solo filter
    if (filters.isSolo) {
      conditions.push(eq(killmails.isSolo, true));
    }

    // Add NPC filter
    if (filters.isNpc) {
      conditions.push(eq(killmails.isNpc, true));
    }

    // Add minimum value filter
    if (filters.minValue !== undefined) {
      conditions.push(
        sql`CAST(${killmails.totalValue} AS REAL) >= ${filters.minValue}`
      );
    }

    // Add ship group filter
    if (filters.shipGroupIds && filters.shipGroupIds.length > 0) {
      conditions.push(
        sql`${groups.groupId} IN (${sql.join(filters.shipGroupIds.map(id => sql`${id}`), sql`, `)})`
      );
    }

    // Execute query with all filters
    const results = await db
      .select({
        killmail_id: killmails.killmailId,
        killmail_time: killmails.killmailTime,
        victim_character_id: victims.characterId,
        victim_corporation_id: victims.corporationId,
        victim_alliance_id: victims.allianceId,
        victim_ship_type_id: victims.shipTypeId,
        victim_character_name: characters.name,
        victim_corporation_name: corporations.name,
        victim_corporation_ticker: corporations.ticker,
        victim_alliance_name: alliances.name,
        victim_alliance_ticker: alliances.ticker,
        victim_ship_name: types.name,
        victim_ship_group: groups.name,
        ship_value: killmails.shipValue,
        total_value: killmails.totalValue,
        solar_system_id: solarSystems.systemId,
        solar_system_name: solarSystems.name,
        region_id: solarSystems.regionId,
        region_name: regions.name,
      })
      .from(killmails)
      .leftJoin(victims, eq(victims.killmailId, killmails.id))
      .leftJoin(characters, eq(characters.characterId, victims.characterId))
      .leftJoin(corporations, eq(corporations.corporationId, victims.corporationId))
      .leftJoin(alliances, eq(alliances.allianceId, victims.allianceId))
      .leftJoin(types, eq(types.typeId, victims.shipTypeId))
      .leftJoin(groups, eq(groups.groupId, types.groupId))
      .leftJoin(solarSystems, eq(solarSystems.systemId, killmails.solarSystemId))
      .leftJoin(regions, eq(regions.regionId, solarSystems.regionId))
      .where(and(...conditions))
      .orderBy(sql`CAST(${killmails.totalValue} AS REAL) DESC`)
      .limit(limit);

    // Transform results into the expected format
    return results.map((result) => ({
      killmail_id: result.killmail_id,
      killmail_time: result.killmail_time,
      victim: {
        character: result.victim_character_id
          ? {
              id: result.victim_character_id,
              name: result.victim_character_name || "Unknown",
            }
          : null,
        corporation: result.victim_corporation_id
          ? {
              id: result.victim_corporation_id,
              name: result.victim_corporation_name || "Unknown",
              ticker: result.victim_corporation_ticker || "",
            }
          : null,
        alliance: result.victim_alliance_id
          ? {
              id: result.victim_alliance_id,
              name: result.victim_alliance_name || "Unknown",
              ticker: result.victim_alliance_ticker || "",
            }
          : null,
        ship: {
          type_id: result.victim_ship_type_id || 0,
          name: result.victim_ship_name || "Unknown Ship",
          group: result.victim_ship_group || "Ship",
        },
      },
      solar_system: {
        id: result.solar_system_id || 0,
        name: result.solar_system_name || "Unknown System",
        region_id: result.region_id || 0,
        region: result.region_name || "Unknown Region",
      },
      ship_value: parseInt(result.ship_value as any) || 0,
      total_value: parseInt(result.total_value as any) || 0,
    }));
  } catch (error) {
    console.error("[Most Valuable Generator] Error:", error);
    return [];
  }
}


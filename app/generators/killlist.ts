import { db } from "../../src/db";
import { killmails } from "../../db/schema/killmails";
import { victims } from "../../db/schema/victims";
import { attackers } from "../../db/schema/attackers";
import { characters } from "../../db/schema/characters";
import { corporations } from "../../db/schema/corporations";
import { alliances } from "../../db/schema/alliances";
import { types } from "../../db/schema/types";
import { solarSystems } from "../../db/schema/solar-systems";
import { regions } from "../../db/schema/regions";
import { items as itemsTable, prices } from "../../db/schema";
import { desc, lt, eq, and, or, gte, count, sql } from "drizzle-orm";

// Create aliases for final blow attacker joins
const fbAttackers = attackers;
const fbCharacters = characters;
const fbCorporations = corporations;
const fbShips = types;

/**
 * Killmail data structure for display
 */
export interface KillmailDisplay {
  killmail_id: number;
  killmail_time: Date;
  ship_value: number;
  victim: {
    character: { id: number | null; name: string };
    corporation: { id: number; name: string };
    alliance: { id: number | null; name: string | null };
    ship: { type_id: number; name: string; group: string };
    damage_taken: number;
  };
  attackers: Array<{
    character: { id: number | null; name: string };
    corporation: { id: number | null; name: string };
    ship: { type_id: number | null; name: string };
    weapon: { type_id: number | null; name: string };
    damage_done: number;
    final_blow: boolean;
  }>;
  solar_system: {
    id: number;
    name: string;
    region: string;
    security_status: number;
  };
}

/**
 * Get the price for a ship type on a specific date (ignores time component)
 * Falls back to closest price within last 14 days if exact date not found
 */
/**
 * Get ship prices for multiple ships at once (batch query optimization)
 */
async function getShipPricesBatch(
  shipTypeIds: number[],
  targetDate: Date
): Promise<Map<number, number>> {
  if (shipTypeIds.length === 0) {
    return new Map();
  }

  const dateString = targetDate.toISOString().split('T')[0];
  const fourteenDaysAgo = new Date(targetDate);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const fourteenDaysAgoString = fourteenDaysAgo.toISOString().split('T')[0];

  // Fetch all prices for all ships in date range in a single query
  const priceRecords = await db
    .select()
    .from(prices)
    .where(
      and(
        sql`${prices.typeId} IN (${sql.join(shipTypeIds.map(id => sql`${id}`), sql`, `)})`,
        sql`date(${prices.date}, 'unixepoch') BETWEEN ${fourteenDaysAgoString} AND ${dateString}`
      )
    );

  // Build map of typeId -> price (prefer exact date, fallback to closest)
  const priceMap = new Map<number, number>();

  for (const typeId of shipTypeIds) {
    // Find exact date match first
    const exactMatch = priceRecords.find(
      p => p.typeId === typeId &&
      new Date(Number(p.date) * 1000).toISOString().split('T')[0] === dateString
    );

    if (exactMatch) {
      priceMap.set(typeId, exactMatch.average || 0);
      continue;
    }

    // Fallback: find closest date
    const typeRecords = priceRecords.filter(p => p.typeId === typeId);
    if (typeRecords.length > 0) {
      // Sort by date and pick the most recent
      typeRecords.sort((a, b) => Number(b.date) - Number(a.date));
      priceMap.set(typeId, typeRecords[0]!.average || 0);
    } else {
      priceMap.set(typeId, 0);
    }
  }

  return priceMap;
}

/**
 * Filter options for killmail queries
 */
export interface KilllistFilters {
  /** Character IDs to filter by (involved as victim OR attacker) */
  characterIds?: number[];
  /** Corporation IDs to filter by (involved as victim OR attacker) */
  corporationIds?: number[];
  /** Alliance IDs to filter by (involved as victim OR attacker) */
  allianceIds?: number[];
  /** Filter for kills only (character/corp/alliance as attacker) */
  killsOnly?: boolean;
  /** Filter for losses only (character/corp/alliance as victim) */
  lossesOnly?: boolean;
  /** Timestamp to fetch killmails before (for pagination) */
  before?: Date;
  /** Offset for pagination (alternative to 'before') */
  offset?: number;
}

/**
 * Generate killmail list data from database with optional filters
 *
 * @param limit Number of killmails to fetch (default: 20)
 * @param filters Optional filters for character, corporation, alliance, kills/losses
 * @returns Array of formatted killmail data
 */
export async function generateKilllist(
  limit: number = 20,
  filters?: KilllistFilters
): Promise<KillmailDisplay[]> {
  // Build the where conditions
  const whereConditions: any[] = [];

  // Add timestamp filter
  if (filters?.before) {
    whereConditions.push(lt(killmails.killmailTime, filters.before));
  }

  // For entity filters, we need to handle two scenarios:
  // 1. If killsOnly/lossesOnly is specified, collect killmail IDs first
  // 2. Otherwise, we need to query both kills and losses separately and combine

  if (filters?.killsOnly && (filters?.characterIds || filters?.corporationIds || filters?.allianceIds)) {
    // Get killmail IDs where entity is an attacker (kills)
    const attackerConditions: any[] = [];

    if (filters.characterIds && filters.characterIds.length > 0) {
      attackerConditions.push(
        sql`${attackers.characterId} IN (${sql.join(filters.characterIds.map(id => sql`${id}`), sql`, `)})`
      );
    }
    if (filters.corporationIds && filters.corporationIds.length > 0) {
      attackerConditions.push(
        sql`${attackers.corporationId} IN (${sql.join(filters.corporationIds.map(id => sql`${id}`), sql`, `)})`
      );
    }
    if (filters.allianceIds && filters.allianceIds.length > 0) {
      attackerConditions.push(
        sql`${attackers.allianceId} IN (${sql.join(filters.allianceIds.map(id => sql`${id}`), sql`, `)})`
      );
    }

    if (attackerConditions.length > 0) {
      const attackerKills = await db
        .selectDistinct({ killmailId: attackers.killmailId })
        .from(attackers)
        .where(attackerConditions.length === 1 ? attackerConditions[0] : or(...attackerConditions));

      const killmailIds = attackerKills.map(k => k.killmailId);

      if (killmailIds.length > 0) {
        whereConditions.push(
          sql`${killmails.id} IN (${sql.join(killmailIds.map(id => sql`${id}`), sql`, `)})`
        );
      } else {
        // No results found, return early
        return [];
      }
    }
  } else if (filters?.lossesOnly && (filters?.characterIds || filters?.corporationIds || filters?.allianceIds)) {
    // Get killmail IDs where entity is a victim (losses)
    const victimConditions: any[] = [];

    if (filters.characterIds && filters.characterIds.length > 0) {
      victimConditions.push(
        sql`${victims.characterId} IN (${sql.join(filters.characterIds.map(id => sql`${id}`), sql`, `)})`
      );
    }
    if (filters.corporationIds && filters.corporationIds.length > 0) {
      victimConditions.push(
        sql`${victims.corporationId} IN (${sql.join(filters.corporationIds.map(id => sql`${id}`), sql`, `)})`
      );
    }
    if (filters.allianceIds && filters.allianceIds.length > 0) {
      victimConditions.push(
        sql`${victims.allianceId} IN (${sql.join(filters.allianceIds.map(id => sql`${id}`), sql`, `)})`
      );
    }

    if (victimConditions.length > 0) {
      const victimLosses = await db
        .selectDistinct({ killmailId: victims.killmailId })
        .from(victims)
        .where(victimConditions.length === 1 ? victimConditions[0] : or(...victimConditions));

      const killmailIds = victimLosses.map(v => v.killmailId);

      if (killmailIds.length > 0) {
        whereConditions.push(
          sql`${killmails.id} IN (${sql.join(killmailIds.map(id => sql`${id}`), sql`, `)})`
        );
      } else {
        // No results found, return early
        return [];
      }
    }
  } else if (!filters?.killsOnly && !filters?.lossesOnly && (filters?.characterIds || filters?.corporationIds || filters?.allianceIds)) {
    // Both kills and losses - need to use a subquery to get killmail IDs first
    const killmailIdsFromAttackers: number[] = [];
    const killmailIdsFromVictims: number[] = [];

    // Get killmail IDs where entity is an attacker
    const attackerConditions: any[] = [];
    if (filters.characterIds && filters.characterIds.length > 0) {
      attackerConditions.push(
        sql`${attackers.characterId} IN (${sql.join(filters.characterIds.map(id => sql`${id}`), sql`, `)})`
      );
    }
    if (filters.corporationIds && filters.corporationIds.length > 0) {
      attackerConditions.push(
        sql`${attackers.corporationId} IN (${sql.join(filters.corporationIds.map(id => sql`${id}`), sql`, `)})`
      );
    }
    if (filters.allianceIds && filters.allianceIds.length > 0) {
      attackerConditions.push(
        sql`${attackers.allianceId} IN (${sql.join(filters.allianceIds.map(id => sql`${id}`), sql`, `)})`
      );
    }

    if (attackerConditions.length > 0) {
      const attackerKills = await db
        .selectDistinct({ killmailId: attackers.killmailId })
        .from(attackers)
        .where(attackerConditions.length === 1 ? attackerConditions[0] : or(...attackerConditions));
      killmailIdsFromAttackers.push(...attackerKills.map(k => k.killmailId));
    }

    // Get killmail IDs where entity is a victim
    const victimConditions: any[] = [];
    if (filters.characterIds && filters.characterIds.length > 0) {
      victimConditions.push(
        sql`${victims.characterId} IN (${sql.join(filters.characterIds.map(id => sql`${id}`), sql`, `)})`
      );
    }
    if (filters.corporationIds && filters.corporationIds.length > 0) {
      victimConditions.push(
        sql`${victims.corporationId} IN (${sql.join(filters.corporationIds.map(id => sql`${id}`), sql`, `)})`
      );
    }
    if (filters.allianceIds && filters.allianceIds.length > 0) {
      victimConditions.push(
        sql`${victims.allianceId} IN (${sql.join(filters.allianceIds.map(id => sql`${id}`), sql`, `)})`
      );
    }

    if (victimConditions.length > 0) {
      const victimLosses = await db
        .selectDistinct({ killmailId: victims.killmailId })
        .from(victims)
        .where(victimConditions.length === 1 ? victimConditions[0] : or(...victimConditions));
      killmailIdsFromVictims.push(...victimLosses.map(v => v.killmailId));
    }

    // Combine and deduplicate killmail IDs
    const allKillmailIds = [...new Set([...killmailIdsFromAttackers, ...killmailIdsFromVictims])];

    if (allKillmailIds.length > 0) {
      whereConditions.push(
        sql`${killmails.id} IN (${sql.join(allKillmailIds.map(id => sql`${id}`), sql`, `)})`
      );
    } else {
      // No results found, return early
      return [];
    }
  }

  const whereCondition = whereConditions.length > 0
    ? (whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions))
    : undefined;

  // Build the base query
  const query = db
    .select({
      killmail: killmails,
      victim: victims,
      victimCharacter: characters,
      victimCorporation: corporations,
      victimAlliance: alliances,
      victimShip: types,
      solarSystem: solarSystems,
      region: regions,
    })
    .from(killmails)
    .leftJoin(victims, eq(killmails.id, victims.killmailId))
    .leftJoin(characters, eq(victims.characterId, characters.characterId))
    .leftJoin(corporations, eq(victims.corporationId, corporations.corporationId))
    .leftJoin(alliances, eq(victims.allianceId, alliances.allianceId))
    .leftJoin(types, eq(victims.shipTypeId, types.typeId))
    .leftJoin(solarSystems, eq(killmails.solarSystemId, solarSystems.systemId))
    .leftJoin(regions, eq(solarSystems.regionId, regions.regionId));

  // Apply where condition, ordering, offset, and limit
  let finalQuery = query
    .where(whereCondition)
    .orderBy(desc(killmails.killmailTime));

  // Add offset if provided
  if (filters?.offset) {
    finalQuery = finalQuery.offset(filters.offset) as any;
  }

  const killmailsData = await finalQuery.limit(limit);

  if (killmailsData.length === 0) {
    return [];
  }

  // Fetch ALL final blow attackers in a single batch query
  const killmailIds = killmailsData.map(km => km.killmail?.id).filter(Boolean) as number[];

  const finalBlowAttackersData = await db
    .select({
      killmailId: attackers.killmailId,
      attacker: attackers,
      character: characters,
      corporation: corporations,
      ship: types,
    })
    .from(attackers)
    .leftJoin(characters, eq(attackers.characterId, characters.characterId))
    .leftJoin(corporations, eq(attackers.corporationId, corporations.corporationId))
    .leftJoin(types, eq(attackers.shipTypeId, types.typeId))
    .where(
      and(
        sql`${attackers.killmailId} IN (${sql.join(killmailIds.map(id => sql`${id}`), sql`, `)})`,
        eq(attackers.finalBlow, true)
      )
    );

  // Create a map for quick lookup: killmailId -> final blow attacker
  const finalBlowMap = new Map();
  for (const fb of finalBlowAttackersData) {
    finalBlowMap.set(fb.killmailId, fb);
  }

  // Batch fetch all ship prices - get unique ship type IDs
  const shipTypeIds = [...new Set(killmailsData.map(km => km.victim?.shipTypeId).filter(Boolean))] as number[];
  const shipPricesMap = await getShipPricesBatch(shipTypeIds, killmailsData[0]?.killmail?.killmailTime || new Date());

  // Format the data
  const result: KillmailDisplay[] = [];

  for (const km of killmailsData) {
    // Skip if killmail or victim is missing (essential data)
    if (!km.killmail || !km.victim) {
      console.log(`[Killlist] Skipping killmail due to missing essential data`);
      continue;
    }

    // Get final blow attacker from the map
    const finalBlowData = finalBlowMap.get(km.killmail.id);

    // Get ship price from batch results
    const shipPrice = shipPricesMap.get(km.victim.shipTypeId) || 0;

    const formattedKillmail: KillmailDisplay = {
      killmail_id: km.killmail.killmailId,
      killmail_time: km.killmail.killmailTime,
      ship_value: shipPrice,
      victim: {
        character: {
          id: km.victim.characterId,
          name: km.victimCharacter?.name || "Unknown",
        },
        corporation: {
          id: km.victim.corporationId,
          name: km.victimCorporation?.name || "Unknown Corporation",
        },
        alliance: {
          id: km.victim.allianceId,
          name: km.victimAlliance?.name || null,
        },
        ship: {
          type_id: km.victim.shipTypeId,
          name: km.victimShip?.name || "Unknown Ship",
          group: "Ship", // TODO: Add group lookup
        },
        damage_taken: km.victim.damageTaken,
      },
      attackers: finalBlowData
        ? [{
            character: {
              id: finalBlowData.attacker.characterId,
              name: finalBlowData.character?.name || "Unknown",
            },
            corporation: {
              id: finalBlowData.attacker.corporationId,
              name: finalBlowData.corporation?.name || "Unknown",
            },
            ship: {
              type_id: finalBlowData.attacker.shipTypeId,
              name: finalBlowData.ship?.name || "Unknown",
            },
            weapon: {
              type_id: finalBlowData.attacker.weaponTypeId,
              name: "Unknown Weapon", // TODO: Add weapon lookup
            },
            final_blow: true,
            damage_done: finalBlowData.attacker.damageDone,
          }]
        : [],
      solar_system: {
        id: km.killmail.solarSystemId,
        name: km.solarSystem?.name || "Unknown System",
        region: km.region?.name || "Unknown Region",
        security_status: parseFloat(km.solarSystem?.securityStatus || "0"),
      },
    };

    result.push(formattedKillmail);
  }

  return result;
}

/**
 * Get killboard statistics
 */
export async function getKillboardStats() {
  // Get total killmails count
  const [totalResult] = await db
    .select({ count: count() })
    .from(killmails);

  // Get killmails from last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [recentResult] = await db
    .select({ count: count() })
    .from(killmails)
    .where(gte(killmails.killmailTime, oneDayAgo));

  // Get unique character count (approximate - using victims only for now)
  const uniqueVictims = await db
    .selectDistinct({ characterId: victims.characterId })
    .from(victims);

  return {
    totalKillmails: totalResult?.count || 0,
    totalISK: 0, // TODO: Calculate from totalValue
    activePilots: uniqueVictims.length,
    recentKills: recentResult?.count || 0,
  };
}

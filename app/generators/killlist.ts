import { db } from "../../src/db";
import { killmails } from "../../db/schema/killmails";
import { victims } from "../../db/schema/victims";
import { attackers } from "../../db/schema/attackers";
import { characters } from "../../db/schema/characters";
import { corporations } from "../../db/schema/corporations";
import { alliances } from "../../db/schema/alliances";
import { types } from "../../db/schema/types";
import { solarSystems } from "../../db/schema/solar-systems";
import { items as itemsTable, prices } from "../../db/schema";
import { desc, lt, eq, and, gte, count, sql } from "drizzle-orm";

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
async function getShipPrice(
  shipTypeId: number,
  targetDate: Date
): Promise<number> {
  // Format date as YYYY-MM-DD for SQLite date comparison
  const dateString = targetDate.toISOString().split('T')[0];

  // Try exact date match first
  let priceRecord = await db
    .select()
    .from(prices)
    .where(
      and(
        eq(prices.typeId, shipTypeId),
        sql`date(${prices.date}, 'unixepoch') = ${dateString}`
      )
    )
    .limit(1);

  if (priceRecord.length > 0) {
    return priceRecord[0]?.average || 0;
  }

  // Fallback: Get prices from last 14 days and find closest
  const fourteenDaysAgo = new Date(targetDate);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const fourteenDaysAgoString = fourteenDaysAgo.toISOString().split('T')[0];

  const priceRecords = await db
    .select()
    .from(prices)
    .where(
      and(
        eq(prices.typeId, shipTypeId),
        sql`date(${prices.date}, 'unixepoch') >= ${fourteenDaysAgoString}`,
        sql`date(${prices.date}, 'unixepoch') <= ${dateString}`
      )
    );

  if (priceRecords.length === 0) {
    return 0;
  }

  // Find closest date to target
  let closestRecord = priceRecords[0]!;
  let minDiff = Math.abs(new Date(closestRecord.date).getTime() - targetDate.getTime());

  for (const record of priceRecords) {
    const diff = Math.abs(new Date(record.date).getTime() - targetDate.getTime());
    if (diff < minDiff) {
      minDiff = diff;
      closestRecord = record;
    }
  }

  return closestRecord?.average || 0;

  return closestRecord?.average || 0;
}

/**
 * Generate killmail list data from database
 *
 * @param limit Number of killmails to fetch (default: 20)
 * @param before Timestamp to fetch killmails before (for pagination)
 * @returns Array of formatted killmail data
 */
export async function generateKilllist(
  limit: number = 20,
  before?: Date
): Promise<KillmailDisplay[]> {
  // Build the where condition
  const whereCondition = before
    ? lt(killmails.killmailTime, before)
    : undefined;

  // Fetch killmails with all related data
  const killmailsData = await db
    .select({
      killmail: killmails,
      victim: victims,
      victimCharacter: characters,
      victimCorporation: corporations,
      victimAlliance: alliances,
      victimShip: types,
      solarSystem: solarSystems,
    })
    .from(killmails)
    .leftJoin(victims, eq(killmails.id, victims.killmailId))
    .leftJoin(characters, eq(victims.characterId, characters.characterId))
    .leftJoin(corporations, eq(victims.corporationId, corporations.corporationId))
    .leftJoin(alliances, eq(victims.allianceId, alliances.allianceId))
    .leftJoin(types, eq(victims.shipTypeId, types.typeId))
    .leftJoin(solarSystems, eq(killmails.solarSystemId, solarSystems.systemId))
    .where(whereCondition)
    .orderBy(desc(killmails.killmailTime))
    .limit(limit);

  // For each killmail, fetch the final blow attacker only
  const result: KillmailDisplay[] = [];

  for (const km of killmailsData) {
    // Skip if killmail or victim is missing (essential data)
    if (!km.killmail || !km.victim) {
      console.log(`[Killlist] Skipping killmail due to missing essential data`);
      continue;
    }

    // Fetch only the final blow attacker for this killmail - single efficient query
    const finalBlowAttackerData = await db
      .select({
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
          eq(attackers.killmailId, km.killmail.id),
          eq(attackers.finalBlow, true)
        )
      )
      .limit(1); // Only get the final blow attacker

    // Format the data
    const shipPrice = await getShipPrice(km.victim.shipTypeId, km.killmail.killmailTime);

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
      attackers: finalBlowAttackerData.length > 0
        ? finalBlowAttackerData.map((att) => ({
            character: {
              id: att.attacker.characterId,
              name: att.character?.name || "Unknown",
            },
            corporation: {
              id: att.attacker.corporationId,
              name: att.corporation?.name || "Unknown",
            },
            ship: {
              type_id: att.attacker.shipTypeId,
              name: att.ship?.name || "Unknown",
            },
            weapon: {
              type_id: att.attacker.weaponTypeId,
              name: "Unknown", // TODO: Implement weapon lookup
            },
            damage_done: att.attacker.damageDone,
            final_blow: att.attacker.finalBlow,
          }))
        : [],
      solar_system: {
        id: km.killmail.solarSystemId,
        name: km.solarSystem?.name || "Unknown System",
        region: "Unknown", // TODO: Add region lookup
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

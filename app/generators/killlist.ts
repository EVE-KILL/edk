import { db } from "../db";
import { killmails } from "../db/schema/killmails";
import { victims } from "../db/schema/victims";
import { attackers } from "../db/schema/attackers";
import { characters } from "../db/schema/characters";
import { corporations } from "../db/schema/corporations";
import { alliances } from "../db/schema/alliances";
import { types } from "../db/schema/types";
import { solarSystems } from "../db/schema/solar-systems";
import { desc, lt, eq, and, gte, count } from "drizzle-orm";

/**
 * Killmail data structure for display
 */
export interface KillmailDisplay {
  killmail_id: number;
  killmail_time: Date;
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
  zkb: {
    totalValue: string;
    points: number;
  };
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

  // For each killmail, fetch attackers
  const result: KillmailDisplay[] = [];

  for (const km of killmailsData) {
    // Skip if killmail or victim is missing (essential data)
    if (!km.killmail || !km.victim) {
      console.log(`[Killlist] Skipping killmail due to missing essential data`);
      continue;
    }

    // Fetch attackers for this killmail (get final blow first, then others)
    const attackersData = await db
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
      .where(eq(attackers.killmailId, km.killmail.id))
      .orderBy(desc(attackers.finalBlow))
      .limit(10); // Limit to 10 attackers for display

    // Format the data
    const formattedKillmail: KillmailDisplay = {
      killmail_id: km.killmail.killmailId,
      killmail_time: km.killmail.killmailTime,
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
      attackers: attackersData.map((att) => ({
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
      })),
      solar_system: {
        id: km.killmail.solarSystemId,
        name: km.solarSystem?.name || "Unknown System",
        region: "Unknown", // TODO: Add region lookup
        security_status: parseFloat(km.solarSystem?.securityStatus || "0"),
      },
      zkb: {
        totalValue: km.killmail.totalValue,
        points: km.killmail.points,
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

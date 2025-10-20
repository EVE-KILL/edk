import { db } from "../../src/db";
import {
  killmails,
  victims,
  attackers,
  characters,
  corporations,
  alliances,
  solarSystems,
  types,
  prices,
} from "../../db/schema";
import { eq, desc, sql, and } from "drizzle-orm";

export interface CorporationStats {
  corporation: {
    id: number;
    name: string;
    ticker: string;
  };
  stats: {
    kills: number;
    losses: number;
    killLossRatio: number;
    totalDamageDone: number;
    efficiency: number;
  };
  recentKills: any[];
  recentLosses: any[];
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
  let closestRecord = priceRecords[0];
  let minDiff = Math.abs(new Date(closestRecord.date).getTime() - targetDate.getTime());

  for (const record of priceRecords) {
    const diff = Math.abs(new Date(record.date).getTime() - targetDate.getTime());
    if (diff < minDiff) {
      minDiff = diff;
      closestRecord = record;
    }
  }

  return closestRecord?.average || 0;
}export async function generateCorporationDetail(
  corporationId: number
): Promise<CorporationStats | null> {
  try {
    // Get corporation info
    const corporation = await db
      .select({
        id: corporations.corporationId,
        name: corporations.name,
        ticker: corporations.ticker,
      })
      .from(corporations)
      .where(eq(corporations.corporationId, corporationId))
      .limit(1)
      .then((r) => r[0]);

    if (!corporation) {
      return null;
    }

    // Get kills (where corp was attacker)
    const killsCount = await db
      .select({ count: attackers.id })
      .from(attackers)
      .innerJoin(killmails, eq(killmails.id, attackers.killmailId))
      .where(eq(attackers.corporationId, corporationId));

    const kills = killsCount.length;

    // Get losses (where corp was victim)
    const lossesCount = await db
      .select({ count: victims.id })
      .from(victims)
      .innerJoin(killmails, eq(killmails.id, victims.killmailId))
      .where(eq(victims.corporationId, corporationId));

    const losses = lossesCount.length;

    // Define aliases for victim and final blow characters/corps
    const victimChar = characters;
    const victimCorp = corporations;
    const victimAllianceAlias = alliances;

    // Get recent kills with full structure for killlist partial
    const recentKillsRaw = await db
      .select({
        killmail_internal_id: killmails.id,
        killmail_id: killmails.killmailId,
        killmail_time: killmails.killmailTime,
        total_value: killmails.totalValue,
        attacker_count: killmails.attackerCount,
        victim_char_id: victimChar.characterId,
        victim_char_name: victimChar.name,
        victim_corp_id: victimCorp.corporationId,
        victim_corp_name: victimCorp.name,
        victim_alliance_id: victimAllianceAlias.allianceId,
        victim_alliance_name: victimAllianceAlias.name,
        ship_type_id: victims.shipTypeId,
        ship_name: types.name,
        ship_group_id: types.groupId,
        system_id: solarSystems.systemId,
        system_name: solarSystems.name,
        region: solarSystems.rawData,
      })
      .from(attackers)
      .innerJoin(killmails, eq(killmails.id, attackers.killmailId))
      .innerJoin(victims, eq(victims.killmailId, killmails.id))
      .leftJoin(victimChar, eq(victimChar.characterId, victims.characterId))
      .leftJoin(victimCorp, eq(victimCorp.corporationId, victims.corporationId))
      .leftJoin(victimAllianceAlias, eq(victimAllianceAlias.allianceId, victims.allianceId))
      .leftJoin(types, eq(types.typeId, victims.shipTypeId))
      .leftJoin(solarSystems, eq(solarSystems.systemId, killmails.solarSystemId))
      .where(eq(attackers.corporationId, corporationId))
      .orderBy(desc(killmails.killmailTime))
      .limit(10);

    // For each kill, fetch the final blow attacker info and calculate ship value
    const recentKills = await Promise.all(
      recentKillsRaw.map(async (kill) => {
        // Single query to get final blow attacker - very fast with index
        const finalBlowData = await db
          .select({
            char_id: characters.characterId,
            char_name: characters.name,
            corp_id: corporations.corporationId,
            corp_name: corporations.name,
          })
          .from(attackers)
          .leftJoin(characters, eq(attackers.characterId, characters.characterId))
          .leftJoin(corporations, eq(attackers.corporationId, corporations.corporationId))
          .where(
            and(
              eq(attackers.killmailId, kill.killmail_internal_id),
              eq(attackers.finalBlow, true)
            )
          )
          .limit(1);

        const regionData = kill.region as any;
        const regionName = regionData?.region_name || "Unknown Region";
        const finalBlowInfo = finalBlowData[0] || null;

        // Get ship price for value calculation
        const shipPrice = kill.ship_type_id
          ? await getShipPrice(kill.ship_type_id, kill.killmail_time)
          : 0;

        return {
          killmail_id: kill.killmail_id,
          killmail_time: kill.killmail_time,
          ship_value: shipPrice,
          victim: {
            character: {
              id: kill.victim_char_id || 0,
              name: kill.victim_char_name || "Unknown",
            },
            corporation: {
              id: kill.victim_corp_id || 0,
              name: kill.victim_corp_name || "Unknown",
            },
            alliance: {
              id: kill.victim_alliance_id || 0,
              name: kill.victim_alliance_name || "",
            },
            ship: {
              type_id: kill.ship_type_id || 0,
              name: kill.ship_name || "Unknown Ship",
              group: `Group ${kill.ship_group_id}`,
            },
          },
          solar_system: {
            id: kill.system_id || 0,
            name: kill.system_name || "Unknown System",
            region: regionName,
          },
          attackers: finalBlowInfo
            ? [
                {
                  character: {
                    id: finalBlowInfo.char_id || 0,
                    name: finalBlowInfo.char_name || "NPC",
                  },
                  corporation: {
                    id: finalBlowInfo.corp_id || 0,
                    name: finalBlowInfo.corp_name || "Unknown",
                  },
                },
              ]
            : [],
        };
      })
    );

    // Get recent losses - single efficient query with final blow info
    const recentLossesRaw = await db
      .select({
        killmail_internal_id: killmails.id,
        killmail_id: killmails.killmailId,
        killmail_time: killmails.killmailTime,
        total_value: killmails.totalValue,
        attacker_count: killmails.attackerCount,
        victim_char_id: victimChar.characterId,
        victim_char_name: victimChar.name,
        victim_corp_id: victimCorp.corporationId,
        victim_corp_name: victimCorp.name,
        victim_alliance_id: victimAllianceAlias.allianceId,
        victim_alliance_name: victimAllianceAlias.name,
        ship_type_id: victims.shipTypeId,
        ship_name: types.name,
        ship_group_id: types.groupId,
        system_id: solarSystems.systemId,
        system_name: solarSystems.name,
        region: solarSystems.rawData,
      })
      .from(victims)
      .innerJoin(killmails, eq(killmails.id, victims.killmailId))
      .leftJoin(victimChar, eq(victimChar.characterId, victims.characterId))
      .leftJoin(victimCorp, eq(victimCorp.corporationId, victims.corporationId))
      .leftJoin(victimAllianceAlias, eq(victimAllianceAlias.allianceId, victims.allianceId))
      .leftJoin(types, eq(types.typeId, victims.shipTypeId))
      .leftJoin(solarSystems, eq(solarSystems.systemId, killmails.solarSystemId))
      .where(eq(victims.corporationId, corporationId))
      .orderBy(desc(killmails.killmailTime))
      .limit(10);

    // For each loss, fetch the final blow attacker info and calculate ship value
    const recentLosses = await Promise.all(
      recentLossesRaw.map(async (loss) => {
        // Single query to get final blow attacker - very fast with index
        const finalBlowData = await db
          .select({
            char_id: characters.characterId,
            char_name: characters.name,
            corp_id: corporations.corporationId,
            corp_name: corporations.name,
          })
          .from(attackers)
          .leftJoin(characters, eq(characters.characterId, attackers.characterId))
          .leftJoin(corporations, eq(corporations.corporationId, attackers.corporationId))
          .where(
            and(
              eq(attackers.killmailId, loss.killmail_internal_id),
              eq(attackers.finalBlow, true)
            )
          )
          .limit(1);

        const regionData = loss.region as any;
        const regionName = regionData?.region_name || "Unknown Region";
        const finalBlowInfo = finalBlowData[0] || null;

        // Get ship price for value calculation
        const shipPrice = loss.ship_type_id
          ? await getShipPrice(loss.ship_type_id, loss.killmail_time)
          : 0;

        return {
          killmail_id: loss.killmail_id,
          killmail_time: loss.killmail_time,
          ship_value: shipPrice,
          victim: {
            character: {
              id: loss.victim_char_id || 0,
              name: loss.victim_char_name || "Unknown",
            },
            corporation: {
              id: loss.victim_corp_id || 0,
              name: loss.victim_corp_name || "Unknown",
            },
            alliance: {
              id: loss.victim_alliance_id || 0,
              name: loss.victim_alliance_name || "",
            },
            ship: {
              type_id: loss.ship_type_id || 0,
              name: loss.ship_name || "Unknown Ship",
              group: `Group ${loss.ship_group_id}`,
            },
          },
          solar_system: {
            id: loss.system_id || 0,
            name: loss.system_name || "Unknown System",
            region: regionName,
          },
          attackers: finalBlowInfo ? [{
            character: {
              id: finalBlowInfo.char_id || 0,
              name: finalBlowInfo.char_name || "NPC",
            },
            corporation: {
              id: finalBlowInfo.corp_id || 0,
              name: finalBlowInfo.corp_name || "Unknown",
            },
          }] : [],
        };
      })
    );

    return {
      corporation,
      stats: {
        kills,
        losses,
        killLossRatio: losses > 0 ? kills / losses : kills,
        totalDamageDone: 0,
        efficiency: kills + losses > 0 ? (kills / (kills + losses)) * 100 : 0,
      },
      recentKills,
      recentLosses,
    };
  } catch (error) {
    console.error("[Corporation Generator] Error:", error);
    return null;
  }
}

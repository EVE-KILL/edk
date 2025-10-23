import { db } from "../../src/db";
import {
  killmails,
  victims,
  attackers,
  characters,
  corporations,
  alliances,
} from "../../db/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { generateKilllist, type KillmailDisplay } from "./killlist";

export interface CharacterStats {
  character: {
    id: number;
    name: string;
    corporationId: number;
    corporationName?: string;
    corporationTicker?: string;
    allianceId?: number;
    allianceName?: string;
    allianceTicker?: string;
  };
  stats: {
    kills: number;
    losses: number;
    killLossRatio: number;
    totalDamageDone: number;
    efficiency: number;
    iskDestroyed: string;
    iskLost: string;
    iskEfficiency: number;
  };
  recentKillmails: KillmailDisplay[];
}

export async function generateCharacterDetail(
  characterId: number
): Promise<CharacterStats | null> {
  try {
    // Get character info with corporation and alliance
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
      .leftJoin(corporations, eq(characters.corporationId, corporations.corporationId))
      .where(eq(characters.characterId, characterId))
      .limit(1)
      .then((r) => r[0]);

    if (!characterData) {
      return null;
    }

    // Get alliance info if character has one
    let allianceData = null;
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

    const character = {
      id: characterData.id,
      name: characterData.name,
      corporationId: characterData.corporationId,
      corporationName: characterData.corporationName || undefined,
      corporationTicker: characterData.corporationTicker || undefined,
      allianceId: characterData.allianceId || undefined,
      allianceName: allianceData?.name || undefined,
      allianceTicker: allianceData?.ticker || undefined,
    };

    // Get kill count - count distinct killmails from attackers table
    const [killsResult] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${attackers.killmailId})`.mapWith(Number),
      })
      .from(attackers)
      .where(eq(attackers.characterId, characterId))
      .execute();

    const kills = killsResult?.count || 0;

    // Get loss count - count distinct killmails from victims table
    const [lossesResult] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${victims.killmailId})`.mapWith(Number),
      })
      .from(victims)
      .where(eq(victims.characterId, characterId))
      .execute();

    const losses = lossesResult?.count || 0;

    // Get ISK destroyed (as attacker)
    const [iskDestroyedResult] = await db
      .select({
        total: sql<string>`CAST(COALESCE(SUM(CAST(${killmails.totalValue} AS REAL)), 0) AS TEXT)`,
      })
      .from(attackers)
      .innerJoin(killmails, eq(killmails.id, attackers.killmailId))
      .where(eq(attackers.characterId, characterId))
      .execute();

    const iskDestroyed = iskDestroyedResult?.total || "0";

    // Get ISK lost (as victim)
    const [iskLostResult] = await db
      .select({
        total: sql<string>`CAST(COALESCE(SUM(CAST(${killmails.totalValue} AS REAL)), 0) AS TEXT)`,
      })
      .from(victims)
      .innerJoin(killmails, eq(killmails.id, victims.killmailId))
      .where(eq(victims.characterId, characterId))
      .execute();

    const iskLost = iskLostResult?.total || "0";

    // Calculate ISK efficiency
    const iskDestroyedNum = parseFloat(iskDestroyed);
    const iskLostNum = parseFloat(iskLost);
    const iskEfficiency = iskDestroyedNum + iskLostNum > 0
      ? (iskDestroyedNum / (iskDestroyedNum + iskLostNum)) * 100
      : 0;

    // Use the generalized killlist generator for recent activity (both kills and losses)
    const recentKillmails = await generateKilllist(20, { characterIds: [characterId] });

    return {
      character,
      stats: {
        kills,
        losses,
        killLossRatio: losses > 0 ? kills / losses : kills,
        totalDamageDone: 0,
        efficiency: kills + losses > 0 ? (kills / (kills + losses)) * 100 : 0,
        iskDestroyed,
        iskLost,
        iskEfficiency,
      },
      recentKillmails,
    };
  } catch (error) {
    console.error("[Character Generator] Error:", error);
    return null;
  }
}

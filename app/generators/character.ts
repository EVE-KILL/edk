import { db } from "../../src/db";
import {
  killmails,
  victims,
  attackers,
  characters,
} from "../../db/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { generateKilllist, type KillmailDisplay } from "./killlist";

export interface CharacterStats {
  character: {
    id: number;
    name: string;
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
  recentKills: KillmailDisplay[];
  recentLosses: KillmailDisplay[];
}

export async function generateCharacterDetail(
  characterId: number
): Promise<CharacterStats | null> {
  try {
    // Get character info
    const character = await db
      .select({
        id: characters.characterId,
        name: characters.name,
      })
      .from(characters)
      .where(eq(characters.characterId, characterId))
      .limit(1)
      .then((r) => r[0]);

    if (!character) {
      return null;
    }

    // Get kill count
    const killCount = await db
      .select({ count: killmails.id })
      .from(attackers)
      .innerJoin(killmails, eq(killmails.id, attackers.killmailId))
      .where(eq(attackers.characterId, characterId));

    const kills = killCount.length;

    // Get loss count
    const lossCount = await db
      .select({ count: victims.id })
      .from(victims)
      .innerJoin(killmails, eq(killmails.id, victims.killmailId))
      .where(eq(victims.characterId, characterId));

    const losses = lossCount.length;

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

    // Use the generalized killlist generator for recent kills and losses
    const [recentKills, recentLosses] = await Promise.all([
      generateKilllist(10, { characterIds: [characterId], killsOnly: true }),
      generateKilllist(10, { characterIds: [characterId], lossesOnly: true }),
    ]);

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
      recentKills,
      recentLosses,
    };
  } catch (error) {
    console.error("[Character Generator] Error:", error);
    return null;
  }
}

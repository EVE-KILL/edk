import { db } from "../../src/db";
import {
  killmails,
  victims,
  attackers,
  characters,
} from "../../db/schema";
import { eq, and, desc, count } from "drizzle-orm";
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
      },
      recentKills,
      recentLosses,
    };
  } catch (error) {
    console.error("[Character Generator] Error:", error);
    return null;
  }
}

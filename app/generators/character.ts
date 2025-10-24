import { generateKilllist, type KillmailDisplay } from "./killlist";
import { getEntityInfo, getEntityStats } from "./entity-stats";

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
    // Get character info using unified function
    const character = await getEntityInfo("character", characterId);

    if (!character) {
      return null;
    }

    // Get stats using unified function
    const stats = await getEntityStats({
      characterIds: [characterId],
      statsType: "all",
    });

    // Use the generalized killlist generator for recent activity (both kills and losses)
    const recentKillmails = await generateKilllist(20, {
      characterIds: [characterId],
    });

    return {
      character,
      stats: {
        ...stats,
        totalDamageDone: 0, // This field isn't calculated anywhere, keeping it as 0
      },
      recentKillmails,
    };
  } catch (error) {
    console.error("[Character Generator] Error:", error);
    return null;
  }
}

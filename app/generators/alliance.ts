import { generateKilllist, type KillmailDisplay } from "./killlist";
import { getEntityInfo, getEntityStats } from "./entity-stats";

export interface AllianceStats {
  alliance: {
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
    iskDestroyed: string;
    iskLost: string;
    iskEfficiency: number;
  };
  recentKillmails: KillmailDisplay[];
}

export async function generateAllianceDetail(
  allianceId: number
): Promise<AllianceStats | null> {
  try {
    // Get alliance info using unified function
    const alliance = await getEntityInfo("alliance", allianceId);

    if (!alliance) {
      return null;
    }

    // Get stats using unified function
    const stats = await getEntityStats({
      allianceIds: [allianceId],
      statsType: "all",
    });

    // Use the generalized killlist generator for recent activity (both kills and losses)
    const recentKillmails = await generateKilllist(20, {
      allianceIds: [allianceId],
    });

    return {
      alliance,
      stats: {
        ...stats,
        totalDamageDone: 0, // This field isn't calculated anywhere, keeping it as 0
      },
      recentKillmails,
    };
  } catch (error) {
    console.error("[Alliance Generator] Error:", error);
    return null;
  }
}

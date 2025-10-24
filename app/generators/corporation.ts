import { generateKilllist, type KillmailDisplay } from "./killlist";
import { getEntityInfo, getEntityStats } from "./entity-stats";

export interface CorporationStats {
  corporation: {
    id: number;
    name: string;
    ticker: string;
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

export async function generateCorporationDetail(
  corporationId: number
): Promise<CorporationStats | null> {
  try {
    // Get corporation info using unified function
    const corporation = await getEntityInfo("corporation", corporationId);

    if (!corporation) {
      return null;
    }

    // Get stats using unified function
    const stats = await getEntityStats({
      corporationIds: [corporationId],
      statsType: "all",
    });

    // Use the generalized killlist generator for recent activity (both kills and losses)
    const recentKillmails = await generateKilllist(20, {
      corporationIds: [corporationId],
    });

    return {
      corporation,
      stats: {
        ...stats,
        totalDamageDone: 0, // This field isn't calculated anywhere, keeping it as 0
      },
      recentKillmails,
    };
  } catch (error) {
    console.error("[Corporation Generator] Error:", error);
    return null;
  }
}

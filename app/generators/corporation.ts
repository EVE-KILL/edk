import { db } from "../../src/db";
import {
  killmails,
  victims,
  attackers,
  corporations,
  alliances,
} from "../../db/schema";
import { eq, sql } from "drizzle-orm";
import { generateKilllist, type KillmailDisplay } from "./killlist";

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
    // Get corporation info with alliance
    const corporationData = await db
      .select({
        id: corporations.corporationId,
        name: corporations.name,
        ticker: corporations.ticker,
        allianceId: corporations.allianceId,
      })
      .from(corporations)
      .where(eq(corporations.corporationId, corporationId))
      .limit(1)
      .then((r) => r[0]);

    if (!corporationData) {
      return null;
    }

    // Get alliance info if corporation has one
    let allianceData = null;
    if (corporationData.allianceId) {
      allianceData = await db
        .select({
          name: alliances.name,
          ticker: alliances.ticker,
        })
        .from(alliances)
        .where(eq(alliances.allianceId, corporationData.allianceId))
        .limit(1)
        .then((r) => r[0]);
    }

    const corporation = {
      id: corporationData.id,
      name: corporationData.name,
      ticker: corporationData.ticker,
      allianceId: corporationData.allianceId || undefined,
      allianceName: allianceData?.name || undefined,
      allianceTicker: allianceData?.ticker || undefined,
    };

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

    // Get ISK destroyed (as attacker)
    const [iskDestroyedResult] = await db
      .select({
        total: sql<string>`CAST(COALESCE(SUM(CAST(${killmails.totalValue} AS REAL)), 0) AS TEXT)`,
      })
      .from(attackers)
      .innerJoin(killmails, eq(killmails.id, attackers.killmailId))
      .where(eq(attackers.corporationId, corporationId))
      .execute();

    const iskDestroyed = iskDestroyedResult?.total || "0";

    // Get ISK lost (as victim)
    const [iskLostResult] = await db
      .select({
        total: sql<string>`CAST(COALESCE(SUM(CAST(${killmails.totalValue} AS REAL)), 0) AS TEXT)`,
      })
      .from(victims)
      .innerJoin(killmails, eq(killmails.id, victims.killmailId))
      .where(eq(victims.corporationId, corporationId))
      .execute();

    const iskLost = iskLostResult?.total || "0";

    // Calculate ISK efficiency
    const iskDestroyedNum = parseFloat(iskDestroyed);
    const iskLostNum = parseFloat(iskLost);
    const iskEfficiency = iskDestroyedNum + iskLostNum > 0
      ? (iskDestroyedNum / (iskDestroyedNum + iskLostNum)) * 100
      : 0;

    // Use the generalized killlist generator for recent activity (both kills and losses)
    const recentKillmails = await generateKilllist(20, { corporationIds: [corporationId] });

    return {
      corporation,
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
    console.error("[Corporation Generator] Error:", error);
    return null;
  }
}

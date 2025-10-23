import { db } from "../../src/db";
import {
  killmails,
  victims,
  attackers,
  alliances,
} from "../../db/schema";
import { eq, sql } from "drizzle-orm";
import { generateKilllist, type KillmailDisplay } from "./killlist";

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
    // Get alliance info
    const alliance = await db
      .select({
        id: alliances.allianceId,
        name: alliances.name,
        ticker: alliances.ticker,
      })
      .from(alliances)
      .where(eq(alliances.allianceId, allianceId))
      .limit(1)
      .then((r) => r[0]);

    if (!alliance) {
      return null;
    }

    // Get kills (where alliance was attacker) - count distinct killmails from attackers table
    const [killsResult] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${attackers.killmailId})`.mapWith(Number),
      })
      .from(attackers)
      .where(eq(attackers.allianceId, allianceId))
      .execute();

    const kills = killsResult?.count || 0;

    // Get losses (where alliance was victim) - count distinct killmails from victims table
    const [lossesResult] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${victims.killmailId})`.mapWith(Number),
      })
      .from(victims)
      .where(eq(victims.allianceId, allianceId))
      .execute();

    const losses = lossesResult?.count || 0;

    // Get ISK destroyed (as attacker)
    const [iskDestroyedResult] = await db
      .select({
        total: sql<string>`CAST(COALESCE(SUM(CAST(${killmails.totalValue} AS REAL)), 0) AS TEXT)`,
      })
      .from(attackers)
      .innerJoin(killmails, eq(killmails.id, attackers.killmailId))
      .where(eq(attackers.allianceId, allianceId))
      .execute();

    const iskDestroyed = iskDestroyedResult?.total || "0";

    // Get ISK lost (as victim)
    const [iskLostResult] = await db
      .select({
        total: sql<string>`CAST(COALESCE(SUM(CAST(${killmails.totalValue} AS REAL)), 0) AS TEXT)`,
      })
      .from(victims)
      .innerJoin(killmails, eq(killmails.id, victims.killmailId))
      .where(eq(victims.allianceId, allianceId))
      .execute();

    const iskLost = iskLostResult?.total || "0";

    // Calculate ISK efficiency
    const iskDestroyedNum = parseFloat(iskDestroyed);
    const iskLostNum = parseFloat(iskLost);
    const iskEfficiency = iskDestroyedNum + iskLostNum > 0
      ? (iskDestroyedNum / (iskDestroyedNum + iskLostNum)) * 100
      : 0;

    // Use the generalized killlist generator for recent activity (both kills and losses)
    const recentKillmails = await generateKilllist(20, { allianceIds: [allianceId] });

    return {
      alliance,
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
    console.error("[Alliance Generator] Error:", error);
    return null;
  }
}

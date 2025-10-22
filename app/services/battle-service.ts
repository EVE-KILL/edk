import { db } from "../../src/db";
import { killmails, victims, attackers } from "../../db/schema";
import { eq, and, gte, lt, sql } from "drizzle-orm";
import { logger } from "../../src/utils/logger";

/**
 * Battle Service
 * Determines if a killmail was part of a battle based on:
 * - Same solar system
 * - Within ±1 hour time window
 * - At least 10 killmails in the same system within the time window
 */
export class BattleService {
  /**
   * Check if a killmail was part of a battle
   * A battle is defined as:
   * - Multiple kills in the same system
   * - Within a 1-hour time window
   * - At least 10 kills total
   */
  static async isKillmailInBattle(killmailId: number): Promise<boolean> {
    try {
      const battleInfo = await this.findBattleForKillmail(killmailId);
      return battleInfo !== null;
    } catch (error) {
      logger.error("Error checking if killmail is in battle", { killmailId, error });
      return false;
    }
  }

  /**
   * Find battle information for a killmail
   * Returns battle metadata including time window and system
   */
  static async findBattleForKillmail(
    killmailId: number
  ): Promise<{
    systemId: number;
    startTime: Date;
    endTime: Date;
    killCount: number;
  } | null> {
    try {
      // Fetch the target killmail to get system and time
      const targetKm = await db.query.killmails.findFirst({
        where: eq(killmails.killmailId, killmailId),
        columns: {
          solarSystemId: true,
          killmailTime: true,
        },
      });

      if (!targetKm) {
        return null;
      }

      const systemId = targetKm.solarSystemId;
      const killTime = targetKm.killmailTime;

      // Create ±1 hour time window
      const startTime = new Date(killTime.getTime() - 3600 * 1000);
      const endTime = new Date(killTime.getTime() + 3600 * 1000);

      // Count killmails in the same system within the time window
      const [result] = await db
        .select({
          count: sql<number>`COUNT(*)`,
        })
        .from(killmails)
        .where(
          and(
            eq(killmails.solarSystemId, systemId),
            gte(killmails.killmailTime, startTime),
            lt(killmails.killmailTime, endTime)
          )
        );

      const killCount = result?.count || 0;

      // A battle requires at least 10 kills in the same system within the time window
      if (killCount < 10) {
        return null;
      }

      return {
        systemId,
        startTime,
        endTime,
        killCount,
      };
    } catch (error) {
      logger.error("Error finding battle for killmail", { killmailId, error });
      return null;
    }
  }

  /**
   * Get all killmails in a battle
   * Fetches all killmails in the same system within the time window
   */
  static async getBattleKillmails(
    killmailId: number
  ): Promise<
    Array<{
      killmailId: number;
      killmailTime: Date;
      solarSystemId: number;
      victimCharacterId: number | null;
      victimCorporationId: number | null;
      victimAllianceId: number | null;
      attackerCount: number;
    }>
  > {
    try {
      const battleInfo = await this.findBattleForKillmail(killmailId);

      if (!battleInfo) {
        return [];
      }

      const { systemId, startTime, endTime } = battleInfo;

      const battleKillmails = await db
        .select({
          killmailId: killmails.killmailId,
          killmailTime: killmails.killmailTime,
          solarSystemId: killmails.solarSystemId,
          victimCharacterId: victims.characterId,
          victimCorporationId: victims.corporationId,
          victimAllianceId: victims.allianceId,
          attackerCount: killmails.attackerCount,
        })
        .from(killmails)
        .leftJoin(victims, eq(victims.killmailId, killmails.id))
        .where(
          and(
            eq(killmails.solarSystemId, systemId),
            gte(killmails.killmailTime, startTime),
            lt(killmails.killmailTime, endTime)
          )
        );

      return battleKillmails;
    } catch (error) {
      logger.error("Error getting battle killmails", { killmailId, error });
      return [];
    }
  }

  /**
   * Get battle summary statistics
   */
  static async getBattleSummary(killmailId: number): Promise<{
    systemId: number;
    startTime: Date;
    endTime: Date;
    durationMinutes: number;
    killCount: number;
    uniqueCharacters: number;
    uniqueCorporations: number;
    uniqueAlliances: number;
  } | null> {
    try {
      const battleInfo = await this.findBattleForKillmail(killmailId);

      if (!battleInfo) {
        return null;
      }

      const { systemId, startTime, endTime, killCount } = battleInfo;

      // Get unique entities
      const battleKillmails = await this.getBattleKillmails(killmailId);

      const uniqueCharacters = new Set(
        battleKillmails
          .map((km) => km.victimCharacterId)
          .filter((id) => id !== null)
      );

      const uniqueCorporations = new Set(
        battleKillmails
          .map((km) => km.victimCorporationId)
          .filter((id) => id !== null)
      );

      const uniqueAlliances = new Set(
        battleKillmails
          .map((km) => km.victimAllianceId)
          .filter((id) => id !== null)
      );

      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

      return {
        systemId,
        startTime,
        endTime,
        durationMinutes,
        killCount,
        uniqueCharacters: uniqueCharacters.size,
        uniqueCorporations: uniqueCorporations.size,
        uniqueAlliances: uniqueAlliances.size,
      };
    } catch (error) {
      logger.error("Error getting battle summary", { killmailId, error });
      return null;
    }
  }
}

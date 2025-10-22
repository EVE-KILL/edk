import { WebController } from "../../../src/controllers/web-controller";
import { db } from "../../../src/db";
import { killmails, solarSystems, regions } from "../../../db/schema";
import { eq, and, gte, lt } from "drizzle-orm";
import { BattleService } from "../../services/battle-service";
import { generateKilllist } from "../../generators/killlist";
import { logger } from "../../../src/utils/logger";

export class Controller extends WebController {
  // Cache battle pages for 10 minutes (fresh) + 1 hour (stale)
  static cacheConfig = {
    ttl: 600,
    staleWhileRevalidate: 3600,
    vary: ["id"],
  };

  override async handle(): Promise<Response> {
    const killmailId = this.getParam("id");

    if (!killmailId) {
      return this.notFound("Battle not found");
    }

    const killmailIdNum = parseInt(killmailId, 10);
    if (isNaN(killmailIdNum)) {
      return this.notFound("Invalid killmail ID");
    }

    try {
      // Find the battle using the killmail ID
      const battleInfo = await BattleService.findBattleForKillmail(killmailIdNum);

      if (!battleInfo) {
        return this.notFound(`No battle found for killmail #${killmailIdNum}`);
      }

      const battleData = await this.generateBattleData(battleInfo);

      if (!battleData) {
        return this.notFound(`Battle data could not be generated`);
      }

      return await this.renderPage(
        "pages/battle",
        `Battle in ${battleData.system.name}`,
        `${battleData.stats.killCount} kills, ${Math.floor(battleData.stats.totalIsk / 1000000)}M ISK destroyed`,
        battleData
      );
    } catch (error) {
      logger.error("[Battle Route] Error:", { killmailId, error });
      return this.notFound("Failed to load battle data");
    }
  }

  private async generateBattleData(battleInfo: {
    systemId: number;
    startTime: Date;
    endTime: Date;
    killCount: number;
  }) {
    try {
      const { systemId, startTime, endTime } = battleInfo;

      // Use generateKilllist to fetch all battle killmails
      const allKillmails = await generateKilllist(
        battleInfo.killCount + 100, // Fetch more than needed to ensure we get everything
        { systemId }
      );

      // Filter to the exact battle time window
      const battleKillmails = allKillmails.filter(
        (km) => km.killmail_time >= startTime && km.killmail_time < endTime
      );

      if (battleKillmails.length < 10) {
        return null;
      }

      // Get system and region info
      const system = await db.query.solarSystems.findFirst({
        where: eq(solarSystems.systemId, systemId),
      });

      if (!system) {
        return null;
      }

      const region = system?.regionId
        ? await db.query.regions.findFirst({
            where: eq(regions.regionId, system.regionId),
          })
        : null;

      // Calculate stats
      const uniqueCharacterIds = new Set<number>();
      const uniqueCorporationIds = new Set<number>();
      const uniqueAllianceIds = new Set<number>();

      for (const km of battleKillmails) {
        if (km.victim.character.id) uniqueCharacterIds.add(km.victim.character.id);
        if (km.victim.corporation.id) uniqueCorporationIds.add(km.victim.corporation.id);
        if (km.victim.alliance.id) uniqueAllianceIds.add(km.victim.alliance.id);
        for (const attacker of km.attackers) {
          if (attacker.character.id) uniqueCharacterIds.add(attacker.character.id);
          if (attacker.corporation.id) uniqueCorporationIds.add(attacker.corporation.id);
          if (attacker.alliance.id) uniqueAllianceIds.add(attacker.alliance.id);
        }
      }

      const totalIsk = battleKillmails.reduce((sum, km) => sum + (km.ship_value || 0), 0);

      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

      return {
        system: {
          id: system.systemId,
          name: system.name,
          security: system.securityStatus,
          region: region?.name || "Unknown Region",
        },
        timeWindow: {
          startTime,
          endTime,
          durationMinutes,
        },
        stats: {
          killCount: battleKillmails.length,
          uniqueCharacters: uniqueCharacterIds.size,
          uniqueCorporations: uniqueCorporationIds.size,
          uniqueAlliances: uniqueAllianceIds.size,
          totalIsk,
        },
        killCount: battleKillmails.length,
        uniqueParticipants: uniqueAllianceIds.size + uniqueCorporationIds.size,
        topKillmails: battleKillmails
          .sort((a, b) => (b.ship_value || 0) - (a.ship_value || 0))
          .slice(0, 10),
        killmails: battleKillmails, // All killmails for the killmail-list partial
        filterConfig: {
          disableWebsocket: true, // Prevent live updates on battle page
        },
      };
    } catch (error) {
      logger.error("[Battle Route] Error generating battle data:", { error });
      return null;
    }
  }
}

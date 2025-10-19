import { WebController } from "../../utils/web-controller";

export class Controller extends WebController {
  // Cache killmail pages for 5 minutes
  static cacheConfig = {
    ttl: 300,
    vary: ["id"],
  };

  override async handle(): Promise<Response> {
    const killmailId = this.getParam("id");

    if (!killmailId) {
      return this.notFound("Killmail not found");
    }

    // Try to fetch from database using the killmail ID (not the database ID)
    const killmail = await this.models.Killmails.findByKillmailId(parseInt(killmailId, 10));

    if (!killmail) {
      return this.notFound(`Killmail #${killmailId} not found`);
    }

    const data = {
      killmail: {
        id: killmail.id,
        killmailId: killmail.killmailId,
        hash: killmail.hash,
        time: killmail.killmailTime,
        victim: killmail.victim,
        attackers: killmail.attackers,
        items: killmail.items,
        totalValue: killmail.totalValue,
        attackerCount: killmail.attackerCount,
        isSolo: killmail.isSolo,
        solarSystemId: killmail.solarSystemId,
      },
    };

    const victimInfo = killmail.victim as any;
    const victimName = victimInfo?.characterId ? `Character ${victimInfo.characterId}` : "Unknown";
    const shipType = victimInfo?.shipTypeId ? `Ship ${victimInfo.shipTypeId}` : "Unknown Ship";
    const value = killmail.totalValue ? `${Math.floor(killmail.totalValue / 1000000)}M` : "0";

    return await this.renderPage(
      "pages/killmail",
      `Killmail #${killmail.killmailId} - ${victimName} (${shipType})`,
      `Killmail details for ${victimName} who lost a ${shipType} worth ${value} ISK`,
      data
    );
  }
}

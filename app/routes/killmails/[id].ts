import { WebController } from "../../utils/web-controller";
import { generateKillmailDetail } from "../../generators/killmail";

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

    // Fetch killmail detail from generator
    const killmailDetail = await generateKillmailDetail(parseInt(killmailId, 10));

    if (!killmailDetail) {
      return this.notFound(`Killmail #${killmailId} not found`);
    }

    // Find final blow attacker
    const finalBlow = killmailDetail.attackers.find(a => a.finalBlow);

    const data = {
      ...killmailDetail,
      finalBlow,
    };

    const victimName = killmailDetail.victim.character?.name || "Unknown";
    const shipName = killmailDetail.victim.ship.name;
    const valueMB = Math.floor(killmailDetail.stats.totalValue / 1000000);

    return await this.renderPage(
      "pages/killmail",
      `Killmail #${killmailDetail.killmail.killmailId} - ${victimName} (${shipName})`,
      `${victimName} lost a ${shipName} worth ${valueMB}M ISK`,
      data
    );
  }
}

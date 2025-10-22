import { WebController } from "../../../src/controllers/web-controller";
import { generateSystemDetail } from "../../generators/system";
import { generateKilllist } from "../../generators/killlist";
import { getTop10StatsBySystem } from "../../generators/top-10-stats";

export class Controller extends WebController {
  static cacheConfig = {
    ttl: 120,                    // Fresh for 2 minutes
    staleWhileRevalidate: 300,   // Serve stale for 5 more minutes while refreshing
    vary: ["id"],
  };

  override async handle(): Promise<Response> {
    const systemId = this.getParam("id");

    if (!systemId) {
      return this.notFound("System not found");
    }

    const systemDetail = await generateSystemDetail(parseInt(systemId, 10));

    if (!systemDetail) {
      return this.notFound(`System #${systemId} not found`);
    }

    // Fetch killlist for this system
    const killmails = await generateKilllist(20, {
      systemId: parseInt(systemId, 10),
      before: new Date(),
      offset: 0,
    });
    // No need to filter manually anymore - the generator handles it
    const filteredKillmails = killmails;

    // Fetch top 10 stats for this system (last 7 days)
    const top10Stats = await getTop10StatsBySystem(parseInt(systemId, 10), 7);

    const data = {
      ...systemDetail,
      killmails: filteredKillmails,
      top10Stats,
      filterConfig: {
        systemId: parseInt(systemId, 10),
      },
      entityName: systemDetail.system.name,
      imageUrl: `https://images.eve-kill.com/systems/${systemDetail.system.id}`,
      currentTab: 'dashboard',
      baseUrl: `/system/${systemId}`,
    };

    return await this.renderPage(
      "pages/system-detail",
      `${systemDetail.system.name}`,
      `System profile for ${systemDetail.system.name}`,
      data
    );
  }
}

import { WebController } from "../../../src/controllers/web-controller";
import { generateRegionDetail } from "../../generators/region";
import { generateKilllist } from "../../generators/killlist";
import { getTop10StatsByRegion } from "../../generators/top-10-stats";

export class Controller extends WebController {
  static cacheConfig = {
    ttl: 120,                    // Fresh for 2 minutes
    staleWhileRevalidate: 300,   // Serve stale for 5 more minutes while refreshing
    vary: ["id"],
  };

  override async handle(): Promise<Response> {
    const regionId = this.getParam("id");

    if (!regionId) {
      return this.notFound("Region not found");
    }

    const regionDetail = await generateRegionDetail(parseInt(regionId, 10));

    if (!regionDetail) {
      return this.notFound(`Region #${regionId} not found`);
    }

    // Fetch killlist for this region
    const killmails = await generateKilllist(20, {
      regionId: parseInt(regionId, 10),
      before: new Date(),
      offset: 0,
    });
    // No need to filter manually anymore - the generator handles it
    const filteredKillmails = killmails;

    // Fetch top 10 stats for this region (last 7 days)
    const top10Stats = await getTop10StatsByRegion(parseInt(regionId, 10), 7);

    const data = {
      ...regionDetail,
      killmails: filteredKillmails,
      top10Stats,
      filterConfig: {
        regionId: parseInt(regionId, 10),
      },
      entityName: regionDetail.region.name,
      imageUrl: `https://images.eve-kill.com/regions/${regionDetail.region.id}`,
      currentTab: 'dashboard',
      baseUrl: `/region/${regionId}`,
    };

    return await this.renderPage(
      "pages/region-detail",
      `${regionDetail.region.name}`,
      `Region profile for ${regionDetail.region.name}`,
      data
    );
  }
}

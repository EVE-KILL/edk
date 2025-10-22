import { WebController } from "../../../src/controllers/web-controller";
import { generateAllianceDetail } from "../../generators/alliance";
import {
  getShipGroupCombinedStatistics,
  type ShipGroupStatsFilters,
} from "../../generators/ship-group-stats";

export class Controller extends WebController {
  static cacheConfig = {
    ttl: 300,
    vary: ["id"],
  };

  override async handle(): Promise<Response> {
    const allianceId = this.getParam("id");

    if (!allianceId) {
      return this.notFound("Alliance not found");
    }

    const allianceDetail = await generateAllianceDetail(parseInt(allianceId, 10));

    if (!allianceDetail) {
      return this.notFound(`Alliance #${allianceId} not found`);
    }

    // Fetch ship group combined statistics for last 30 days
    const shipGroupFilters: ShipGroupStatsFilters = {
      allianceIds: [parseInt(allianceId, 10)],
    };
    const shipGroupStats = await getShipGroupCombinedStatistics(30, shipGroupFilters);

    // Split ship group stats into 3 columns
    const itemsPerColumn = Math.ceil(shipGroupStats.length / 3);
    const shipGroupColumns = [
      shipGroupStats.slice(0, itemsPerColumn),
      shipGroupStats.slice(itemsPerColumn, itemsPerColumn * 2),
      shipGroupStats.slice(itemsPerColumn * 2),
    ].filter((col) => col.length > 0);

    const data = {
      ...allianceDetail,
      entityName: allianceDetail.alliance.name,
      entityType: "alliance",
      ticker: allianceDetail.alliance.ticker,
      imageUrl: `https://images.evetech.net/alliances/${allianceDetail.alliance.id}/logo?size=512`,
      currentTab: "dashboard",
      baseUrl: `/alliance/${allianceId}`,
      // Ship group statistics
      shipGroupStats,
      shipGroupColumns,
    };

    return await this.renderPage(
      "pages/alliance-detail",
      `${allianceDetail.alliance.name}`,
      `Alliance profile for ${allianceDetail.alliance.name}`,
      data
    );
  }
}

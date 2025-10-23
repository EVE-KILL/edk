import { WebController } from "../../../src/controllers/web-controller";
import { generateAllianceDetail } from "../../generators/alliance";
import {
  getShipGroupCombinedStatistics,
  type ShipGroupStatsFilters,
} from "../../generators/ship-group-stats";
import { getTop10StatsByAlliance } from "../../generators/top-10-stats";
import { getMostValuableKills } from "../../generators/mostvaluable";

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

    // Fetch top 10 stats for this alliance
    const top10Stats = await getTop10StatsByAlliance(parseInt(allianceId, 10), 7);

    // Fetch most valuable kills for this alliance (last 7 days, top 6)
    const mostValuableKills = await getMostValuableKills({
      limit: 6,
      days: 7,
      allianceIds: [parseInt(allianceId, 10)],
    });

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
      entityId: parseInt(allianceId, 10),
      entityType: "alliance",
      type: "alliance",
      ticker: allianceDetail.alliance.ticker,
      imageUrl: `https://images.eve-kill.com/alliances/${allianceDetail.alliance.id}/logo?size=512`,
      parent: undefined,
      grandparent: undefined,
      currentTab: "dashboard",
      baseUrl: `/alliance/${allianceId}`,
      // Ship group statistics
      shipGroupStats,
      shipGroupColumns,
      // Top 10 stats for sidebar
      top10Stats,
      // Most valuable kills
      mostValuableKills,
      // Filter config for WebSocket killlist updates
      filterConfig: {
        type: 'all',
        allianceIds: [parseInt(allianceId, 10)],
      },
    };

    // Use streaming for better TTFB on alliance pages
    return await this.renderPage(
      "pages/alliance-detail",
      `${allianceDetail.alliance.name}`,
      `Alliance profile for ${allianceDetail.alliance.name}`,
      data
    );
  }
}

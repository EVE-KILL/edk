import { WebController } from "../../../src/controllers/web-controller";
import { generateCorporationDetail } from "../../generators/corporation";
import {
  getShipGroupCombinedStatistics,
  type ShipGroupStatsFilters,
} from "../../generators/ship-group-stats";

export class Controller extends WebController {
  static cacheConfig = {
    ttl: 120,
    staleWhileRevalidate: 300,
    vary: ["id"],
  };

  override async handle(): Promise<Response> {
    const corporationId = this.getParam("id");

    if (!corporationId) {
      return this.notFound("Corporation not found");
    }

    const corporationDetail = await generateCorporationDetail(parseInt(corporationId, 10));

    if (!corporationDetail) {
      return this.notFound(`Corporation #${corporationId} not found`);
    }

    // Fetch ship group combined statistics for last 30 days
    const shipGroupFilters: ShipGroupStatsFilters = {
      corporationIds: [parseInt(corporationId, 10)],
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
      ...corporationDetail,
      entityName: corporationDetail.corporation.name,
      ticker: corporationDetail.corporation.ticker,
      imageUrl: `https://images.evetech.net/corporations/${corporationDetail.corporation.id}/logo?size=512`,
      currentTab: "dashboard",
      baseUrl: `/corporation/${corporationId}`,
      // Entity info for loss highlighting
      entityType: 'corporation',
      entityId: parseInt(corporationId, 10),
      // Ship group statistics
      shipGroupStats,
      shipGroupColumns,
    };

    return await this.renderPage(
      "pages/corporation-detail",
      `${corporationDetail.corporation.name}`,
      `Corporation profile for ${corporationDetail.corporation.name}`,
      data
    );
  }
}

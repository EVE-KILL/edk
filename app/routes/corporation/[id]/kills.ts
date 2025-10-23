import { WebController } from "../../../../src/controllers/web-controller";
import { generateKilllist } from "../../../generators/killlist";
import { generateCorporationDetail } from "../../../generators/corporation";
import {
  getShipGroupKillStatistics,
  type ShipGroupStatsFilters,
} from "../../../generators/ship-group-stats";

export class Controller extends WebController {
  static override methods = ["GET"];

  static cacheConfig = {
    ttl: 60,
    staleWhileRevalidate: 120,
    vary: ["id", "page"],
  };

  override async handle(): Promise<Response> {
    const corporationId = this.getParam("id");
    if (!corporationId) {
      return this.notFound("Corporation not found");
    }

    const currentPage = parseInt(this.getQuery("page") || "1");
    const limit = 20;
    const offset = (currentPage - 1) * limit;

    // Fetch corporation and stats
    const corporationDetail = await generateCorporationDetail(parseInt(corporationId, 10));
    if (!corporationDetail) {
      return this.notFound(`Corporation #${corporationId} not found`);
    }

    const { corporation, stats } = corporationDetail;

    // Fetch kills with limit+1 to check for next page
    const killmails = await generateKilllist(limit + 1, {
      corporationIds: [parseInt(corporationId)],
      killsOnly: true,
      offset,
    });

    // Check if there's a next page
    const hasNextPage = killmails.length > limit;
    if (hasNextPage) {
      killmails.pop(); // Remove the extra item
    }

    // Generate pagination URLs
    const baseUrl = `/corporation/${corporationId}/kills`;
    const hasPrevPage = currentPage > 1;

    // Calculate page range (show 5 pages)
    const totalPages = Math.ceil(stats.kills / limit);
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    // Fetch ship group kill statistics for last 30 days
    const shipGroupFilters: ShipGroupStatsFilters = {
      corporationIds: [parseInt(corporationId, 10)],
    };
    const shipGroupStats = await getShipGroupKillStatistics(30, shipGroupFilters);

    // Split ship group stats into 3 columns
    const itemsPerColumn = Math.ceil(shipGroupStats.length / 3);
    const shipGroupColumns = [
      shipGroupStats.slice(0, itemsPerColumn),
      shipGroupStats.slice(itemsPerColumn, itemsPerColumn * 2),
      shipGroupStats.slice(itemsPerColumn * 2),
    ].filter((col) => col.length > 0);

    return await this.renderPage(
      "pages/corporation-kills",
      `${corporation.name} - Kills`,
      `Kills for ${corporation.name}`,
      {
        entityName: corporation.name,
        ticker: corporation.ticker,
        entityType: 'corporation',
        entityId: parseInt(corporationId, 10),
        imageUrl: `https://images.eve-kill.com/corporations/${corporation.id}/logo?size=512`,
        stats,
        killmails,
        currentTab: "kills",
        baseUrl: `/corporation/${corporationId}`,
        // Ship group statistics
        shipGroupStats,
        shipGroupColumns,
        pagination: {
          currentPage,
          hasPrevPage,
          hasNextPage,
          prevUrl: hasPrevPage
            ? currentPage === 2
              ? baseUrl
              : `${baseUrl}?page=${currentPage - 1}`
            : null,
          nextUrl: hasNextPage ? `${baseUrl}?page=${currentPage + 1}` : null,
          firstUrl: baseUrl,
          lastUrl:
            totalPages > 1 ? `${baseUrl}?page=${totalPages}` : baseUrl,
          basePageUrl: baseUrl,
          pages,
          totalPages,
          showFirst: startPage > 1,
          showLast: hasNextPage,
        },
        // Filter config for WebSocket killlist updates (only kills where corporation was attacker)
        filterConfig: {
          type: 'kills',
          corporationIds: [parseInt(corporationId, 10)],
        },
      }
    );
  }
}

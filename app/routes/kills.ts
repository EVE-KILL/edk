import { WebController } from "../../src/controllers/web-controller";
import { generateKilllist } from "../generators/killlist";
import { getShipGroupStatistics } from "../generators/ship-group-stats";
import { getTop10Stats } from "../generators/top-10-stats";

export class Controller extends WebController {
  static cacheConfig = {
    ttl: 30,
    staleWhileRevalidate: 60,
    vary: ["page"],
  };

  override async handle(): Promise<Response> {
    // Get pagination parameters
    const url = new URL(this.request.url);
    const pageParam = url.searchParams.get("page");
    const currentPage = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;

    const limit = 20;
    const offset = (currentPage - 1) * limit;

    // Fetch ship group statistics for the last 30 days
    const shipGroupStats = await getShipGroupStatistics(30);

    // Fetch top 10 statistics for the last 7 days
    const top10Stats = await getTop10Stats(7);

    // Split ship group stats into 3 columns
    const itemsPerColumn = Math.ceil(shipGroupStats.length / 3);
    const shipGroupColumns = [
      shipGroupStats.slice(0, itemsPerColumn),
      shipGroupStats.slice(itemsPerColumn, itemsPerColumn * 2),
      shipGroupStats.slice(itemsPerColumn * 2),
    ].filter((col) => col.length > 0);

    // Fetch all killmails with pagination
    const killmails = await generateKilllist(limit + 1, {
      offset,
    });

    // Check if there's a next page
    const hasNextPage = killmails.length > limit;
    if (hasNextPage) {
      killmails.pop();
    }

    const hasPrevPage = currentPage > 1;

    // For global feed, we don't know total so use high number
    const totalPages = 999;

    // Calculate page numbers to display
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    const pages: number[] = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    const data = {
      killmails,
      shipGroupStats,
      shipGroupColumns,
      top10Stats,
      pagination: {
        currentPage,
        totalPages: null,
        hasNextPage,
        hasPrevPage,
        nextPageUrl: hasNextPage ? `/kills?page=${currentPage + 1}` : null,
        prevPageUrl: hasPrevPage
          ? currentPage > 2
            ? `/kills?page=${currentPage - 1}`
            : `/kills`
          : null,
        pages,
        showFirst: startPage > 1,
        showLast: hasNextPage && endPage < totalPages,
      },
      // Filter config for WebSocket killlist updates (global feed shows all)
      filterConfig: {
        type: "all",
      },
    };

    // Use streaming for better TTFB on large kill lists
    return await this.renderPage(
      "pages/kills",
      "Kills - EDK",
      "Browse recent killmails on EDK",
      data
    );
  }
}

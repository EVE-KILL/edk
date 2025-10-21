import { WebController } from "../../src/controllers/web-controller";
import { generateKilllist, getKillboardStats } from "../generators/killlist";

export class Controller extends WebController {
  override async handle(): Promise<Response> {
    try {
      // Get pagination parameters
      const url = new URL(this.request.url);
      const pageParam = url.searchParams.get("page");
      const currentPage = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;

      const limit = 20;
      const offset = (currentPage - 1) * limit;

      // Fetch killmails with offset
      const killmails = await generateKilllist(limit, { offset });

      // Fetch statistics (always show them for consistency)
      const statistics = await getKillboardStats();

      // Calculate pagination
      const totalPages = statistics ? Math.ceil(statistics.totalKillmails / limit) : 999;
      const hasNextPage = currentPage < totalPages;
      const hasPrevPage = currentPage > 1;

      // Calculate page numbers to display (show 5 pages around current)
      const maxPagesToShow = 5;

      let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
      let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

      // Adjust startPage if we're near the end
      if (endPage - startPage < maxPagesToShow - 1) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
      }

      const pages = [];
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      const data = {
        config: {
          title: "EVE Kill v4",
          subtitle: "The Ultimate EVE Online Killboard"
        },
        killmails,
        statistics,
        pagination: {
          currentPage,
          totalPages: statistics ? totalPages : null,
          hasNextPage,
          hasPrevPage,
          nextPageUrl: hasNextPage ? `/?page=${currentPage + 1}` : null,
          prevPageUrl: hasPrevPage ? (currentPage > 2 ? `/?page=${currentPage - 1}` : '/') : null,
          pages,
          showFirst: startPage > 1,
          showLast: endPage < totalPages,
        },
      };

      return await this.renderPage(
        "pages/home",
        "EVE Kill v4",
        "Track EVE Online killmails with classic EVEDEV-KB layout. Real-time killmail tracking and comprehensive statistics.",
        data
      );
    } catch (error) {
      console.error("Error loading home page:", error);

      // Fallback to empty data if there's an error
      const data = {
        config: {
          title: "EVE Kill v4",
          subtitle: "The Ultimate EVE Online Killboard"
        },
        killmails: [],
        statistics: {
          totalKillmails: 0,
          totalISK: 0,
          activePilots: 0,
          recentKills: 0,
        },
        pagination: {
          currentPage: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
          nextPageUrl: null,
          prevPageUrl: null,
          pages: [1],
          showFirst: false,
          showLast: false,
        },
      };

      return await this.renderPage(
        "pages/home",
        "EVE Kill v4",
        "Track EVE Online killmails with classic EVEDEV-KB layout. Real-time killmail tracking and comprehensive statistics.",
        data
      );
    }
  }
}

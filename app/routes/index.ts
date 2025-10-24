import { WebController } from "../../src/controllers/web-controller";
import { generateKilllist } from "../generators/killlist";
import { getTop10Stats } from "../generators/top-10-stats";
import { getMostValuableKills } from "../generators/mostvaluable";
import { db } from "../../src/db";
import { killmails } from "../../db/schema";
import { sql } from "drizzle-orm";

export class Controller extends WebController {
  static cacheConfig = {
    ttl: 30,                     // Fresh for 30 seconds
    staleWhileRevalidate: 60,    // Serve stale for 60 more seconds while refreshing
    vary: ["page"],
  };
  override async handle(): Promise<Response> {
    try {
      // Get pagination parameters
      const url = new URL(this.request.url);
      const pageParam = url.searchParams.get("page");
      const currentPage = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;

      const limit = 33;
      const offset = (currentPage - 1) * limit;

      // Get total killmail count for pagination
      const [countResult] = await db
        .select({ count: sql<number>`COUNT(*)`.mapWith(Number) })
        .from(killmails)
        .execute();

      const totalKillmails = countResult?.count || 0;
      const totalPages = Math.ceil(totalKillmails / limit) || 1;

      // Fetch killmails WITHOUT filters - show all kills globally
      const killmails_data = await generateKilllist(limit, { offset });

      // Fetch top 10 statistics for the last 7 days (unfiltered - global top 10)
      const top10Stats = await getTop10Stats(7);

      // Fetch most valuable kills (all time, top 6)
      const mostValuableKillsDays = 7;
      const mostValuableKills = await getMostValuableKills({
        limit: 6,
        days: mostValuableKillsDays
      });

      // Calculate pagination
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
          title: "EDK"
        },
        killmails: killmails_data,
        top10Stats,
        mostValuableKills,
        mostValuableTimeRange: `Last ${mostValuableKillsDays} Days`,
        pagination: {
          currentPage,
          totalPages: totalPages,
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
        "EDK",
        "Track EVE Online killmails with classic EVEDEV-KB layout. Real-time killmail tracking and comprehensive statistics.",
        data
      );
    } catch (error) {
      console.error("Error loading home page:", error);

      // Fallback to empty data if there's an error
      const data = {
        config: {
          title: "EDK"
        },
        killmails: [],
        top10Stats: {
          characters: [],
          corporations: [],
          alliances: [],
          systems: [],
          regions: [],
        },
        mostValuableKills: [],
        mostValuableTimeRange: "Last 7 Days",
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
        "EDK",
        "Track EVE Online killmails with classic EVEDEV-KB layout. Real-time killmail tracking and comprehensive statistics.",
        data
      );
    }
  }
}

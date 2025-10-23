import { WebController } from "../../src/controllers/web-controller";
import { generateKilllist } from "../generators/killlist";
import {
  getKillboardStatistics,
  type StatsFilters,
} from "../generators/statistics";
import { getTop10Stats } from "../generators/top-10-stats";
import { getMostValuableKills } from "../generators/mostvaluable";

// Parse .env followed entities configuration
// Empty strings should result in empty arrays, not arrays with NaN
const FOLLOWED_CHARACTER_IDS =
  process.env.FOLLOWED_CHARACTER_IDS?.trim()
    ? process.env.FOLLOWED_CHARACTER_IDS.split(",").map((id) =>
        parseInt(id.trim(), 10)
      )
    : [];
const FOLLOWED_CORPORATION_IDS =
  process.env.FOLLOWED_CORPORATION_IDS?.trim()
    ? process.env.FOLLOWED_CORPORATION_IDS.split(",").map((id) =>
        parseInt(id.trim(), 10)
      )
    : [];
const FOLLOWED_ALLIANCE_IDS =
  process.env.FOLLOWED_ALLIANCE_IDS?.trim()
    ? process.env.FOLLOWED_ALLIANCE_IDS.split(",").map((id) =>
        parseInt(id.trim(), 10)
      )
    : [];

// Build stats filters from .env
const statsFilters: StatsFilters | undefined =
  FOLLOWED_CHARACTER_IDS.length > 0 ||
  FOLLOWED_CORPORATION_IDS.length > 0 ||
  FOLLOWED_ALLIANCE_IDS.length > 0
    ? {
        characterIds:
          FOLLOWED_CHARACTER_IDS.length > 0 ? FOLLOWED_CHARACTER_IDS : undefined,
        corporationIds:
          FOLLOWED_CORPORATION_IDS.length > 0
            ? FOLLOWED_CORPORATION_IDS
            : undefined,
        allianceIds:
          FOLLOWED_ALLIANCE_IDS.length > 0 ? FOLLOWED_ALLIANCE_IDS : undefined,
      }
    : undefined;

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

      const limit = 20;
      const offset = (currentPage - 1) * limit;

      // Fetch killmails WITHOUT filters - show all kills globally
      const killmails = await generateKilllist(limit, { offset });

      // Fetch comprehensive statistics WITHOUT filtering - show global stats
      const statistics = await getKillboardStatistics();

      // Fetch top 10 statistics for the last 7 days (unfiltered - global top 10)
      const top10Stats = await getTop10Stats(7);

      // Fetch most valuable kills (all time, top 6)
      const mostValuableKills = await getMostValuableKills({
        limit: 6,
      });

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
          title: "EDK",
          subtitle: "The Ultimate EVE Online Killboard"
        },
        killmails,
        statistics,
        top10Stats,
        mostValuableKills,
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
        "EDK",
        "Track EVE Online killmails with classic EVEDEV-KB layout. Real-time killmail tracking and comprehensive statistics.",
        data
      );
    } catch (error) {
      console.error("Error loading home page:", error);

      // Fallback to empty data if there's an error
      const data = {
        config: {
          title: "EDK",
          subtitle: "The Ultimate EVE Online Killboard"
        },
        killmails: [],
        statistics: {
          totalKillmails: 0,
          totalISK: 0,
          activePilots: 0,
          recentKills: 0,
        },
        top10Stats: {
          characters: [],
          corporations: [],
          alliances: [],
          systems: [],
          regions: [],
        },
        mostValuableKills: [],
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

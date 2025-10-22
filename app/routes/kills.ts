import { WebController } from "../../src/controllers/web-controller";
import { generateKilllist } from "../generators/killlist";
import {
  getKillsStatistics,
  type StatsFilters,
} from "../generators/statistics";
import { getShipGroupStatistics } from "../generators/ship-group-stats";

// Parse .env followed entities configuration
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

// Check if we have any followed entities
const HAS_FOLLOWED_ENTITIES =
  FOLLOWED_CHARACTER_IDS.length > 0 ||
  FOLLOWED_CORPORATION_IDS.length > 0 ||
  FOLLOWED_ALLIANCE_IDS.length > 0;

// Build stats filters from .env
const statsFilters: StatsFilters | undefined = HAS_FOLLOWED_ENTITIES
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

    // If no followed entities are configured, show ALL killmails (global feed)
    if (!HAS_FOLLOWED_ENTITIES) {
      // Fetch ship group statistics for the last 30 days
      const shipGroupStats = await getShipGroupStatistics(30);

      // Split ship group stats into 3 columns
      const itemsPerColumn = Math.ceil(shipGroupStats.length / 3);
      const shipGroupColumns = [
        shipGroupStats.slice(0, itemsPerColumn),
        shipGroupStats.slice(itemsPerColumn, itemsPerColumn * 2),
        shipGroupStats.slice(itemsPerColumn * 2),
      ].filter(col => col.length > 0);

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
      };

      // Use streaming for better TTFB on large kill lists
      return await this.renderPageStreaming(
        "pages/kills",
        "Kills - EVE Kill v4",
        "Browse recent killmails on EVE Kill v4",
        data
      );
    }

    // Otherwise, redirect to entities/kills for tracked entities
    return Response.redirect(`${new URL(this.request.url).origin}/entities/kills`, 302);
  }
}

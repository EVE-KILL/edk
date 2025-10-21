import { WebController } from "../../src/controllers/web-controller";
import { generateKilllist } from "../generators/killlist";
import {
  getLossesStatistics,
  type StatsFilters,
} from "../generators/statistics";

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
  override async handle(): Promise<Response> {
    // If no followed entities are configured, redirect to kills
    if (!HAS_FOLLOWED_ENTITIES) {
      return this.redirect("/kills");
    }

    // Show losses only for the followed entities
    const url = new URL(this.request.url);
    const pageParam = url.searchParams.get("page");
    const currentPage = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;

    const limit = 20;
    const offset = (currentPage - 1) * limit;

    // Fetch killmails with offset - LOSSES ONLY
    const killmails = await generateKilllist(limit + 1, {
      offset,
      lossesOnly: true,
      characterIds:
        FOLLOWED_CHARACTER_IDS.length > 0 ? FOLLOWED_CHARACTER_IDS : undefined,
      corporationIds:
        FOLLOWED_CORPORATION_IDS.length > 0
          ? FOLLOWED_CORPORATION_IDS
          : undefined,
      allianceIds:
        FOLLOWED_ALLIANCE_IDS.length > 0 ? FOLLOWED_ALLIANCE_IDS : undefined,
    });

    // Check if there's a next page
    const hasNextPage = killmails.length > limit;
    if (hasNextPage) {
      killmails.pop();
    }

    // Fetch comprehensive statistics with .env filtering - LOSSES ONLY
    const statistics = await getLossesStatistics(statsFilters);

    // Calculate pagination based on losses only
    const totalPages = statistics
      ? Math.ceil(statistics.totalLosses / limit)
      : 999;
    const hasPrevPage = currentPage > 1;

    // Calculate page numbers to display (show 5 pages around current)
    const maxPagesToShow = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    // Adjust startPage if we're near the end
    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    const pages: number[] = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    const data = {
      config: {
        title: "EVE Kill v4",
        subtitle: "Losses for Followed Entities",
      },
      killmails,
      statistics,
      pagination: {
        currentPage,
        totalPages: statistics ? totalPages : null,
        hasNextPage,
        hasPrevPage,
        nextPageUrl: hasNextPage ? `/losses?page=${currentPage + 1}` : null,
        prevPageUrl: hasPrevPage
          ? currentPage > 2
            ? `/losses?page=${currentPage - 1}`
            : "/losses"
          : null,
        pages,
        showFirst: startPage > 1,
        showLast: endPage < totalPages,
      },
    };

    return await this.renderPage(
      "pages/losses",
      "Losses - EVE Kill v4",
      "Browse losses for followed entities on EVE Kill v4",
      data
    );
  }
}

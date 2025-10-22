import { WebController } from "../../../src/controllers/web-controller";
import { generateKilllist } from "../../generators/killlist";
import {
  getKillsStatistics,
  getLossesStatistics,
  type StatsFilters,
} from "../../generators/statistics";
import { characters, corporations, alliances } from "../../../db/schema";
import { inArray } from "drizzle-orm";
import { db } from "../../../src/db";
import {
  getShipGroupKillStatistics,
  type ShipGroupStatsFilters,
} from "../../generators/ship-group-stats";

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
    // If no followed entities are configured, return not found
    if (!HAS_FOLLOWED_ENTITIES) {
      return this.notFound("No entities configured");
    }

    // Fetch entity names
    const [characterNames, corporationNames, allianceNames] = await Promise.all([
      FOLLOWED_CHARACTER_IDS.length > 0
        ? db
            .select({ id: characters.characterId, name: characters.name })
            .from(characters)
            .where(inArray(characters.characterId, FOLLOWED_CHARACTER_IDS))
        : [],
      FOLLOWED_CORPORATION_IDS.length > 0
        ? db
            .select({ id: corporations.corporationId, name: corporations.name })
            .from(corporations)
            .where(inArray(corporations.corporationId, FOLLOWED_CORPORATION_IDS))
        : [],
      FOLLOWED_ALLIANCE_IDS.length > 0
        ? db
            .select({ id: alliances.allianceId, name: alliances.name })
            .from(alliances)
            .where(inArray(alliances.allianceId, FOLLOWED_ALLIANCE_IDS))
        : [],
    ]);

    // Build entity list for display
    const entityList = [
      ...characterNames.map((c) => ({ type: "character", id: c.id, name: c.name })),
      ...corporationNames.map((c) => ({ type: "corporation", id: c.id, name: c.name })),
      ...allianceNames.map((a) => ({ type: "alliance", id: a.id, name: a.name })),
    ];

    // Build entity image URLs for collage
    const entityImages = [
      ...characterNames.map((c) => `https://images.evetech.net/characters/${c.id}/portrait?size=128`),
      ...corporationNames.map((c) => `https://images.evetech.net/corporations/${c.id}/logo?size=128`),
      ...allianceNames.map((a) => `https://images.evetech.net/alliances/${a.id}/logo?size=128`),
    ];

    // Build ship group stats filters
    const shipGroupFilters: ShipGroupStatsFilters = {
      characterIds: FOLLOWED_CHARACTER_IDS.length > 0 ? FOLLOWED_CHARACTER_IDS : undefined,
      corporationIds: FOLLOWED_CORPORATION_IDS.length > 0 ? FOLLOWED_CORPORATION_IDS : undefined,
      allianceIds: FOLLOWED_ALLIANCE_IDS.length > 0 ? FOLLOWED_ALLIANCE_IDS : undefined,
    };

    // Fetch ship group KILL statistics for the last 30 days
    const shipGroupStats = await getShipGroupKillStatistics(30, shipGroupFilters);

    // Split ship group stats into 3 columns
    const itemsPerColumn = Math.ceil(shipGroupStats.length / 3);
    const shipGroupColumns = [
      shipGroupStats.slice(0, itemsPerColumn),
      shipGroupStats.slice(itemsPerColumn, itemsPerColumn * 2),
      shipGroupStats.slice(itemsPerColumn * 2),
    ].filter((col) => col.length > 0);

    // Fetch comprehensive statistics
    const killStats = await getKillsStatistics(statsFilters);
    const lossStats = await getLossesStatistics(statsFilters);

    const totalISKDestroyed = parseFloat(killStats?.totalISKDestroyed || "0");
    const totalISKLost = parseFloat(lossStats?.totalISKLost || "0");
    const efficiency =
      totalISKDestroyed + totalISKLost > 0
        ? ((totalISKDestroyed / (totalISKDestroyed + totalISKLost)) * 100).toFixed(2)
        : "0.00";

    // Get pagination parameters
    const url = new URL(this.request.url);
    const pageParam = url.searchParams.get("page");
    const currentPage = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;

    const limit = 20;
    const offset = (currentPage - 1) * limit;

    // Fetch kills with pagination
    const killmails = await generateKilllist(limit + 1, {
      killsOnly: true,
      characterIds:
        FOLLOWED_CHARACTER_IDS.length > 0 ? FOLLOWED_CHARACTER_IDS : undefined,
      corporationIds:
        FOLLOWED_CORPORATION_IDS.length > 0
          ? FOLLOWED_CORPORATION_IDS
          : undefined,
      allianceIds:
        FOLLOWED_ALLIANCE_IDS.length > 0 ? FOLLOWED_ALLIANCE_IDS : undefined,
      offset,
    });

    // Check if there's a next page
    const hasNextPage = killmails.length > limit;
    if (hasNextPage) {
      killmails.pop();
    }

    const hasPrevPage = currentPage > 1;

    // Calculate total pages based on total kills
    const totalPages = killStats
      ? Math.ceil(killStats.totalKills / limit)
      : 999;

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
      entityName: "Tracked Entities",
      entityType: "entities",
      imageUrl: entityImages.length > 0 ? entityImages[0] : "https://images.evetech.net/alliances/1/logo?size=128",
      entityImages, // For collage display
      currentTab: "kills",
      baseUrl: "/entities",
      entityList,
      // Ship group statistics (kills only)
      shipGroupStats,
      shipGroupColumns,
      stats: {
        kills: killStats?.totalKills || 0,
        losses: lossStats?.totalLosses || 0,
        killLossRatio:
          (lossStats?.totalLosses || 0) > 0
            ? ((killStats?.totalKills || 0) / (lossStats?.totalLosses || 0)).toFixed(2)
            : (killStats?.totalKills || 0).toString(),
        efficiency,
        iskDestroyed: killStats?.totalISKDestroyed || "0",
        iskLost: lossStats?.totalISKLost || "0",
        iskEfficiency: efficiency,
      },
      pagination: {
        currentPage,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPageUrl: hasNextPage
          ? `/entities/kills?page=${currentPage + 1}`
          : null,
        prevPageUrl: hasPrevPage
          ? currentPage > 2
            ? `/entities/kills?page=${currentPage - 1}`
            : `/entities/kills`
          : null,
        pages,
        showFirst: startPage > 1,
        showLast: hasNextPage && endPage < totalPages,
      },
    };

    return await this.renderPage(
      "pages/entities-kills",
      "All Entities - Kills",
      "Kill history for all followed entities",
      data
    );
  }
}

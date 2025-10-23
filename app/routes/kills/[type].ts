import { WebController } from "../../../src/controllers/web-controller";
import { generateKilllist, type KilllistFilters } from "../../generators/killlist";
import { getShipGroupStatisticsWithFilters } from "../../generators/ship-group-stats";
import { getTop10StatsWithFilters } from "../../generators/top-10-stats";
import { getMostValuableKillsWithFilters } from "../../generators/mostvaluable";

// Valid kill types
const VALID_KILL_TYPES = [
  "latest",
  "big",
  "solo",
  "npc",
  "highsec",
  "lowsec",
  "nullsec",
  "w-space",
  "abyssal",
  "pochven",
  "5b",
  "10b",
  "frigates",
  "destroyers",
  "cruisers",
  "battlecruisers",
  "battleships",
  "capitals",
  "supercarriers",
  "titans",
  "freighters",
  "citadels",
  "structures",
  "t1",
  "t2",
  "t3",
] as const;

type KillType = typeof VALID_KILL_TYPES[number];

/**
 * Build filters based on the kill type
 */
function buildFiltersForType(type: KillType): KilllistFilters {
  const filters: KilllistFilters = {};

  // Ship group IDs based on MongoDB filters
  const SHIP_GROUPS = {
    // Big kills - Capitals, Supercarriers, Titans, Freighters, Jump Freighters, Rorquals
    big: [547, 485, 513, 902, 941, 30, 659],
    // Citadels
    citadels: [1657, 1406, 1404, 1408, 2017, 2016],
    // T1 ships
    t1: [419, 27, 29, 547, 26, 420, 25, 28, 941, 463, 237, 31],
    // T2 ships
    t2: [324, 898, 906, 540, 830, 893, 543, 541, 833, 358, 894, 831, 902, 832, 900, 834, 380],
    // T3 ships
    t3: [963, 1305],
    // Frigates
    frigates: [324, 893, 25, 831, 237],
    // Destroyers
    destroyers: [420, 541],
    // Cruisers
    cruisers: [906, 26, 833, 358, 894, 832, 963],
    // Battlecruisers
    battlecruisers: [419, 540],
    // Battleships
    battleships: [27, 898, 900],
    // Capitals
    capitals: [547, 485],
    // Freighters
    freighters: [513, 902],
    // Supercarriers
    supercarriers: [659],
    // Titans
    titans: [30],
  };

  switch (type) {
    case "latest":
      // No special filters - just latest kills
      break;

    case "big":
      filters.shipGroupIds = SHIP_GROUPS.big;
      break;

    case "solo":
      filters.isSolo = true;
      break;

    case "npc":
      filters.isNpc = true;
      break;

    case "highsec":
      filters.minSecurityStatus = 0.45;
      break;

    case "lowsec":
      filters.minSecurityStatus = 0.0;
      filters.maxSecurityStatus = 0.45;
      break;

    case "nullsec":
      filters.maxSecurityStatus = 0.0;
      break;

    case "w-space":
      // Wormhole space region IDs: 11000001 to 11000033
      filters.regionIdMin = 11000001;
      filters.regionIdMax = 11000033;
      break;

    case "abyssal":
      // Abyssal space region IDs: 12000000 to 13000000
      filters.regionIdMin = 12000000;
      filters.regionIdMax = 13000000;
      break;

    case "pochven":
      // Pochven region ID: 10000070
      filters.regionId = 10000070;
      break;

    case "5b":
      filters.minValue = 5_000_000_000;
      break;

    case "10b":
      filters.minValue = 10_000_000_000;
      break;

    case "frigates":
      filters.shipGroupIds = SHIP_GROUPS.frigates;
      break;

    case "destroyers":
      filters.shipGroupIds = SHIP_GROUPS.destroyers;
      break;

    case "cruisers":
      filters.shipGroupIds = SHIP_GROUPS.cruisers;
      break;

    case "battlecruisers":
      filters.shipGroupIds = SHIP_GROUPS.battlecruisers;
      break;

    case "battleships":
      filters.shipGroupIds = SHIP_GROUPS.battleships;
      break;

    case "capitals":
      filters.shipGroupIds = SHIP_GROUPS.capitals;
      break;

    case "supercarriers":
      filters.shipGroupIds = SHIP_GROUPS.supercarriers;
      break;

    case "titans":
      filters.shipGroupIds = SHIP_GROUPS.titans;
      break;

    case "freighters":
      filters.shipGroupIds = SHIP_GROUPS.freighters;
      break;

    case "citadels":
      filters.shipGroupIds = SHIP_GROUPS.citadels;
      break;

    case "structures":
      // All structure kills - using citadel groups as a base
      // TODO: Add more structure groups if needed
      filters.shipGroupIds = SHIP_GROUPS.citadels;
      break;

    case "t1":
      filters.shipGroupIds = SHIP_GROUPS.t1;
      break;

    case "t2":
      filters.shipGroupIds = SHIP_GROUPS.t2;
      break;

    case "t3":
      filters.shipGroupIds = SHIP_GROUPS.t3;
      break;
  }

  return filters;
}

/**
 * Get display title for the kill type
 */
function getTitleForType(type: KillType): string {
  const titles: Record<KillType, string> = {
    latest: "Latest Kills",
    big: "Big Kills",
    solo: "Solo Kills",
    npc: "NPC Kills",
    highsec: "High-Sec Kills",
    lowsec: "Low-Sec Kills",
    nullsec: "Null-Sec Kills",
    "w-space": "W-Space Kills",
    abyssal: "Abyssal Kills",
    pochven: "Pochven Kills",
    "5b": "5B+ Kills",
    "10b": "10B+ Kills",
    frigates: "Frigate Kills",
    destroyers: "Destroyer Kills",
    cruisers: "Cruiser Kills",
    battlecruisers: "Battlecruiser Kills",
    battleships: "Battleship Kills",
    capitals: "Capital Kills",
    supercarriers: "Supercarrier Kills",
    titans: "Titan Kills",
    freighters: "Freighter Kills",
    citadels: "Citadel Kills",
    structures: "Structure Kills",
    t1: "T1 Ship Kills",
    t2: "T2 Ship Kills",
    t3: "T3 Ship Kills",
  };

  return titles[type] || "Kills";
}

export class Controller extends WebController {
  static methods = ["GET"];
  static cacheConfig = {
    ttl: 30,
    staleWhileRevalidate: 60,
    vary: ["page"],
  };

  async get(): Promise<Response> {
    // Get the type from the URL parameters
    const type = this.request.params?.type as string | undefined;

    // Validate the type
    if (!type || !VALID_KILL_TYPES.includes(type as KillType)) {
      return new Response("Invalid kill type", { status: 404 });
    }

    const killType = type as KillType;

    // Get pagination parameters
    const url = new URL(this.request.url);
    const pageParam = url.searchParams.get("page");
    const currentPage = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;

    const limit = 20;
    const offset = (currentPage - 1) * limit;

    // Build filters based on the type
    const filters = buildFiltersForType(killType);
    filters.offset = offset;

    // Fetch ship group statistics for the last 30 days with the same filters
    const shipGroupStats = await getShipGroupStatisticsWithFilters(30, filters);

    // Fetch top 10 stats for the last 7 days with the same filters
    const top10Stats = await getTop10StatsWithFilters(30, filters);

    // Fetch most valuable kills for the last 30 days with the same filters
    const mostValuableKills = await getMostValuableKillsWithFilters(30, filters, 6);

    // Split ship group stats into 3 columns
    const itemsPerColumn = Math.ceil(shipGroupStats.length / 3);
    const shipGroupColumns = [
      shipGroupStats.slice(0, itemsPerColumn),
      shipGroupStats.slice(itemsPerColumn, itemsPerColumn * 2),
      shipGroupStats.slice(itemsPerColumn * 2),
    ].filter((col) => col.length > 0);

    // Fetch killmails with the type-specific filters
    const killmails = await generateKilllist(limit + 1, filters);

    // Check if there's a next page
    const hasNextPage = killmails.length > limit;
    if (hasNextPage) {
      killmails.pop();
    }

    const hasPrevPage = currentPage > 1;

    // For filtered feeds, we don't know total so use high number
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
      mostValuableKills,
      pagination: {
        currentPage,
        totalPages: null,
        hasNextPage,
        hasPrevPage,
        nextPageUrl: hasNextPage
          ? `/kills/${type}?page=${currentPage + 1}`
          : null,
        prevPageUrl: hasPrevPage
          ? currentPage > 2
            ? `/kills/${type}?page=${currentPage - 1}`
            : `/kills/${type}`
          : null,
        pages,
        showFirst: startPage > 1,
        showLast: hasNextPage && endPage < totalPages,
      },
      // Filter config for WebSocket killlist updates
      filterConfig: {
        type: killType,
      },
      killType,
      pageTitle: getTitleForType(killType),
    };

    // Use streaming for better TTFB on large kill lists
    return await this.renderPage(
      "pages/kills",
      `${getTitleForType(killType)} - EDK`,
      `Browse ${getTitleForType(killType).toLowerCase()} on EDK`,
      data
    );
  }
}

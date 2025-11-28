/**
 * Filtered kills page - shows kills filtered by type (solo, big, nullsec, etc.)
 */
import type { H3Event } from 'h3';
import { timeAgo } from '../../helpers/time';
import { render, normalizeKillRow } from '../../helpers/templates';
import {
  getFilteredKillsWithNames,
  getMostValuableKillsFiltered,
  estimateFilteredKills,
  type KilllistFilters,
} from '../../models/killlist';
import {
  parseKilllistFilters,
  CAPSULE_TYPE_IDS,
} from '../../helpers/killlist-filters';
import {
  getTopSystemsFiltered,
  getTopRegionsFiltered,
  getTopCharactersFiltered,
  getTopCorporationsFiltered,
  getTopAlliancesFiltered,
  getTopShipsFiltered,
} from '../../models/topBoxes';
import { track } from '../../utils/performance-decorators';

// Ship group IDs for filtering
const SHIP_GROUPS = {
  // Big kills - Capitals, Supercarriers, Titans, Freighters, Jump Freighters, Rorquals
  big: [547, 485, 513, 902, 941, 30, 659],
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
  // Industrials (Industrial Ships, Haulers, Transport Ships, Mining Barges, Exhumers, Industrial Command Ships)
  industrials: [28, 380, 513, 902, 941, 883, 463, 543],
  // Supercarriers
  supercarriers: [659],
  // Titans
  titans: [30],
  // Citadels
  citadels: [1657, 1406, 1404, 1408, 2017, 2016],
  // T1 ships
  t1: [419, 27, 29, 547, 26, 420, 25, 28, 941, 463, 237, 31],
  // T2 ships
  t2: [
    324, 898, 906, 540, 830, 893, 543, 541, 833, 358, 894, 831, 902, 832, 900,
    834, 380,
  ],
  // T3 ships
  t3: [963, 1305],
};

// Valid kill types
const VALID_KILL_TYPES = [
  'latest',
  'big',
  'solo',
  'npc',
  'highsec',
  'lowsec',
  'nullsec',
  'w-space',
  'abyssal',
  'pochven',
  '5b',
  '10b',
  'awox',
  'frigates',
  'destroyers',
  'cruisers',
  'battlecruisers',
  'battleships',
  'capitals',
  'supercarriers',
  'titans',
  'freighters',
  'industrials',
  'citadels',
  'structures',
  't1',
  't2',
  't3',
] as const;

type KillType = (typeof VALID_KILL_TYPES)[number];
const TOP_BOX_LOOKBACK_DAYS = 7;
const MOST_VALUABLE_LOOKBACK_DAYS = 7;

/**
 * Build filters based on the kill type
 * Uses pre-computed columns in killlist for maximum performance
 */
function buildFiltersForType(type: KillType): KilllistFilters {
  const filters: KilllistFilters = {};

  switch (type) {
    case 'latest':
      // No special filters - just latest kills
      break;

    case 'big':
      filters.isBig = true;
      break;

    case 'solo':
      filters.isSolo = true;
      break;

    case 'npc':
      filters.isNpc = true;
      break;

    case 'awox':
      filters.isAwox = true;
      break;

    case 'highsec':
      filters.minSecurityStatus = 0.45;
      break;

    case 'lowsec':
      filters.minSecurityStatus = 0.0;
      filters.maxSecurityStatus = 0.45;
      break;

    case 'nullsec':
      filters.maxSecurityStatus = 0.0;
      break;

    case 'w-space':
      filters.regionIdMin = 11000001;
      filters.regionIdMax = 11000033;
      break;

    case 'abyssal':
      filters.regionIdMin = 12000000;
      filters.regionIdMax = 13000000;
      break;

    case 'pochven':
      filters.regionId = 10000070;
      break;

    case '5b':
      filters.minValue = 5_000_000_000;
      break;

    case '10b':
      filters.minValue = 10_000_000_000;
      break;

    case 'frigates':
      filters.shipGroupIds = SHIP_GROUPS.frigates;
      break;

    case 'destroyers':
      filters.shipGroupIds = SHIP_GROUPS.destroyers;
      break;

    case 'cruisers':
      filters.shipGroupIds = SHIP_GROUPS.cruisers;
      break;

    case 'battlecruisers':
      filters.shipGroupIds = SHIP_GROUPS.battlecruisers;
      break;

    case 'battleships':
      filters.shipGroupIds = SHIP_GROUPS.battleships;
      break;

    case 'capitals':
      filters.shipGroupIds = SHIP_GROUPS.capitals;
      break;

    case 'supercarriers':
      filters.shipGroupIds = SHIP_GROUPS.supercarriers;
      break;

    case 'titans':
      filters.shipGroupIds = SHIP_GROUPS.titans;
      break;

    case 'freighters':
      filters.shipGroupIds = SHIP_GROUPS.freighters;
      break;

    case 'industrials':
      filters.shipGroupIds = SHIP_GROUPS.industrials;
      break;

    case 'citadels':
      filters.shipGroupIds = SHIP_GROUPS.citadels;
      break;

    case 'structures':
      filters.shipGroupIds = SHIP_GROUPS.citadels;
      break;

    case 't1':
      filters.metaGroupIds = [1]; // Tech I
      break;

    case 't2':
      filters.metaGroupIds = [2]; // Tech II
      break;

    case 't3':
      filters.shipGroupIds = [963, 1305]; // T3 Strategic Cruisers and Tactical Destroyers
      break;
  }

  return filters;
}

/**
 * Get display title for the kill type
 */
function getTitleForType(type: KillType): string {
  const titles: Record<KillType, string> = {
    latest: 'Latest Kills',
    big: 'Big Kills',
    solo: 'Solo Kills',
    npc: 'NPC Kills',
    awox: 'Awox Kills',
    highsec: 'High-Sec Kills',
    lowsec: 'Low-Sec Kills',
    nullsec: 'Null-Sec Kills',
    'w-space': 'W-Space Kills',
    abyssal: 'Abyssal Kills',
    pochven: 'Pochven Kills',
    '5b': '5B+ Kills',
    '10b': '10B+ Kills',
    frigates: 'Frigate Kills',
    destroyers: 'Destroyer Kills',
    cruisers: 'Cruiser Kills',
    battlecruisers: 'Battlecruiser Kills',
    battleships: 'Battleship Kills',
    capitals: 'Capital Kills',
    supercarriers: 'Supercarrier Kills',
    titans: 'Titan Kills',
    freighters: 'Freighter Kills',
    industrials: 'Industrial Kills',
    citadels: 'Citadel Kills',
    structures: 'Structure Kills',
    t1: 'T1 Ship Kills',
    t2: 'T2 Ship Kills',
    t3: 'T3 Ship Kills',
  };

  return titles[type] || 'Kills';
}

import { handleError } from '../../utils/error';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const type = getRouterParam(event, 'type') as string | undefined;

    // Validate the type
    if (!type || !VALID_KILL_TYPES.includes(type as KillType)) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Invalid kill type',
      });
    }

    const killType = type as KillType;

    // Get pagination parameters
    const query = getQuery(event);
    const page = Math.max(1, Number.parseInt(query.page as string) || 1);
    const perPage = Math.min(
      100,
      Math.max(5, Number.parseInt(query.limit as string) || 25)
    );

    // Build filters based on the type
    const filters = buildFiltersForType(killType);

    // Merge user-provided filters (column-aligned query params)
    const {
      filters: userFilters,
      filterQueryString,
      securityStatus,
      techLevel,
      shipClass,
    } = parseKilllistFilters(query);
    for (const [key, value] of Object.entries(userFilters)) {
      // Only override when a value is actually provided
      if (value !== undefined) {
        // @ts-expect-error dynamic assignment is fine here
        filters[key] = value;
      }
    }

    // Determine securityStatus string from route or query
    let effectiveSecurityStatus = securityStatus;
    if (!effectiveSecurityStatus) {
      // Map route-based filters to securityStatus string
      if (killType === 'highsec') {
        effectiveSecurityStatus = 'highsec';
      } else if (killType === 'lowsec') {
        effectiveSecurityStatus = 'lowsec';
      } else if (killType === 'nullsec') {
        effectiveSecurityStatus = 'nullsec';
      } else if (killType === 'w-space') {
        effectiveSecurityStatus = 'wormhole';
      } else if (killType === 'abyssal') {
        effectiveSecurityStatus = 'abyssal';
      } else if (killType === 'pochven') {
        effectiveSecurityStatus = 'pochven';
      }
    }

    // Determine techLevel string from route or query
    let effectiveTechLevel = techLevel;
    if (!effectiveTechLevel) {
      if (killType === 't1') {
        effectiveTechLevel = 't1';
      } else if (killType === 't2') {
        effectiveTechLevel = 't2';
      } else if (killType === 't3') {
        effectiveTechLevel = 't3';
      }
    }

    // Determine minTotalValue display string from route or query
    let effectiveMinValue = filters.minTotalValue;
    if (!effectiveMinValue && (killType === '5b' || killType === '10b')) {
      effectiveMinValue = filters.minValue;
    }

    // Determine shipClass string from route or query
    let effectiveShipClass = shipClass;
    if (!effectiveShipClass) {
      if (killType === 'frigates') {
        effectiveShipClass = 'frigate';
      } else if (killType === 'destroyers') {
        effectiveShipClass = 'destroyer';
      } else if (killType === 'cruisers') {
        effectiveShipClass = 'cruiser';
      } else if (killType === 'battlecruisers') {
        effectiveShipClass = 'battlecruiser';
      } else if (killType === 'battleships') {
        effectiveShipClass = 'battleship';
      } else if (killType === 'capitals') {
        effectiveShipClass = 'carrier'; // Capitals includes carriers and dreads
      } else if (killType === 'supercarriers') {
        effectiveShipClass = 'supercarrier';
      } else if (killType === 'titans') {
        effectiveShipClass = 'titan';
      } else if (killType === 'freighters') {
        effectiveShipClass = 'freighter';
      } else if (killType === 'industrials') {
        effectiveShipClass = 'industrial';
      } else if (killType === 'citadels' || killType === 'structures') {
        effectiveShipClass = 'structure';
      }
    }

    const filterDefaults = {
      ...filters,
      securityStatus: effectiveSecurityStatus,
      techLevel: effectiveTechLevel,
      shipClass: effectiveShipClass,
      minTotalValue: effectiveMinValue,
      skipCapsules:
        filters.excludeTypeIds?.some((id) => CAPSULE_TYPE_IDS.includes(id)) ||
        false,
    };

    // Fetch killmails and count in parallel using model functions
    const [killmailsData, totalKillmails] = await track(
      `kills:fetch_${killType}`,
      'application',
      async () => {
        return await Promise.all([
          getFilteredKillsWithNames(filters, page, perPage),
          estimateFilteredKills(filters),
        ]);
      }
    );

    const totalPages = Math.ceil(totalKillmails / perPage);

    // Format killmail data for template
    const recentKillmails = await track(
      `kills_${killType}:normalize_killmails`,
      'application',
      async () => {
        return killmailsData.map((km) => {
          const normalized = normalizeKillRow(km);
          return {
            ...normalized,
            killmailTimeRelative: timeAgo(
              km.killmailTime ?? normalized.killmailTime
            ),
          };
        });
      }
    );

    // Get Top Boxes data using model functions with conditions
    const [
      topSystems,
      topRegions,
      topCharacters,
      topCorporations,
      topAlliances,
      topShips,
    ] = await track(`kills_${killType}:top_boxes`, 'application', async () => {
      return await Promise.all([
        getTopSystemsFiltered(filters, 10, TOP_BOX_LOOKBACK_DAYS),
        getTopRegionsFiltered(filters, 10, TOP_BOX_LOOKBACK_DAYS),
        getTopCharactersFiltered(filters, 10, TOP_BOX_LOOKBACK_DAYS),
        getTopCorporationsFiltered(filters, 10, TOP_BOX_LOOKBACK_DAYS),
        getTopAlliancesFiltered(filters, 10, TOP_BOX_LOOKBACK_DAYS),
        getTopShipsFiltered(filters, 10, TOP_BOX_LOOKBACK_DAYS),
      ]);
    });

    // Get Most Valuable Kills for this filter
    // Fetches ALL kills from the lookback period (no limit), then we sort by value
    const mostValuableKillsData = await track(
      `kills_${killType}:most_valuable`,
      'application',
      async () => {
        return await getMostValuableKillsFiltered(
          filters, // Keep all filters intact
          MOST_VALUABLE_LOOKBACK_DAYS
        );
      }
    );
    // Sort by value descending and take top 6
    mostValuableKillsData.sort((a, b) => b.totalValue - a.totalValue);
    const topValuableKills = mostValuableKillsData.slice(0, 6);

    const mostValuableKills = await track(
      `kills_${killType}:normalize_valuable`,
      'application',
      async () => {
        return topValuableKills.map((k) => {
          const normalized = normalizeKillRow(k);
          const killmailTimeRaw: unknown =
            k.killmailTime ?? normalized.killmailTime;
          const killmailTimeValue =
            killmailTimeRaw instanceof Date
              ? killmailTimeRaw.toISOString()
              : String(killmailTimeRaw);
          return {
            ...normalized,
            totalValue: k.totalValue ?? normalized.totalValue,
            killmailTime: killmailTimeValue,
          };
        });
      }
    );

    // Format top boxes data for partial
    const {
      topCharactersFormatted,
      topCorporationsFormatted,
      topAlliancesFormatted,
      topSystemsFormatted,
      topRegionsFormatted,
      topShipsFormatted,
    } = await track(
      `kills_${killType}:format_top_boxes`,
      'application',
      async () => {
        return {
          topCharactersFormatted: topCharacters.map((c) => ({
            name: c.name,
            kills: c.kills,
            imageType: 'character',
            imageId: c.id,
            link: `/character/${c.id}`,
          })),
          topCorporationsFormatted: topCorporations.map((c) => ({
            name: c.name,
            kills: c.kills,
            imageType: 'corporation',
            imageId: c.id,
            link: `/corporation/${c.id}`,
          })),
          topAlliancesFormatted: topAlliances.map((a) => ({
            name: a.name,
            kills: a.kills,
            imageType: 'alliance',
            imageId: a.id,
            link: `/alliance/${a.id}`,
          })),
          topSystemsFormatted: topSystems.map((s) => ({
            name: s.name,
            kills: s.kills,
            imageType: 'system',
            imageId: s.id,
            link: `/system/${s.id}`,
          })),
          topRegionsFormatted: topRegions.map((r) => ({
            name: r.name,
            kills: r.kills,
            imageType: 'region',
            imageId: r.id,
            link: `/region/${r.id}`,
          })),
          topShipsFormatted: topShips.map((s) => ({
            name: s.name,
            kills: s.kills,
            imageType: 'ship',
            imageId: s.id,
            link: `/item/${s.id}`,
          })),
        };
      }
    );

    // Pagination
    const pagination = {
      currentPage: page,
      totalPages,
      limit: perPage,
      pages: generatePageNumbers(page, totalPages),
      hasPrev: page > 1,
      hasNext: page < totalPages,
      prevPage: page - 1,
      nextPage: page + 1,
      showFirst: page > 3 && totalPages > 5,
      showLast: page < totalPages - 2 && totalPages > 5,
    };

    const baseUrl = `/kills/${killType}`;

    // Get EVE time
    const eveTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Page header light data
    const pageHeaderLight = {
      title: getTitleForType(killType),
      breadcrumbs: [
        { label: 'Home', url: '/' },
        { label: 'Kills', url: '/kills/latest' },
        { label: getTitleForType(killType), url: baseUrl },
      ],
      info: [
        { icon: '🕐', text: `EVE Time: ${eveTime}` },
        { text: `Total: ${totalKillmails.toLocaleString()} kills` },
      ],
    };

    // Render the template
    return render(
      'pages/kills',
      {
        title: getTitleForType(killType),
        description: `Browse ${getTitleForType(killType).toLowerCase()} on EDK`,
        keywords: 'eve online, killmail, pvp, kills',
      },
      {
        pageHeaderLight,
        title: getTitleForType(killType),
        baseUrl,
        recentKillmails,
        pagination,
        topCharactersFormatted,
        topCorporationsFormatted,
        topAlliancesFormatted,
        topSystemsFormatted,
        topRegionsFormatted,
        topShipsFormatted,
        mostValuableKills,
        filterQueryString,
        filterDefaults,
        wsFilter: {
          type: 'killType',
          topic: killType,
          mode: 'kills',
        },
        topTimeRangeLabel: `Last ${TOP_BOX_LOOKBACK_DAYS} Days`,
        mostValuableTimeRange: `Last ${MOST_VALUABLE_LOOKBACK_DAYS} Days`,
        topBoxesAvailable:
          topCharacters.length +
            topCorporations.length +
            topAlliances.length +
            topSystems.length +
            topRegions.length +
            topShips.length >
          0,
      },
      event
    );
  } catch (error) {
    return handleError(event, error);
  }
});

import { generatePageNumbers } from '../../helpers/pagination';

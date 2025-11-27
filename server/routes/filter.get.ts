/**
 * Dedicated filter page - shows kills based on user-provided filters
 */
import type { H3Event } from 'h3';
import { timeAgo } from '../helpers/time';
import { render, normalizeKillRow } from '../helpers/templates';
import {
  getFilteredKillsWithNames,
  getMostValuableKillsFiltered,
  estimateFilteredKills,
  type KilllistFilters,
} from '../models/killlist';
import {
  parseKilllistFilters,
  CAPSULE_TYPE_IDS,
} from '../helpers/killlist-filters';
import {
  getTopSystemsFiltered,
  getTopRegionsFiltered,
  getTopCharactersFiltered,
  getTopCorporationsFiltered,
  getTopAlliancesFiltered,
} from '../models/topBoxes';
import { track } from '../utils/performance-decorators';
import { handleError } from '../utils/error';
import { generatePageNumbers } from '../helpers/pagination';

const TOP_BOX_LOOKBACK_DAYS = 7;
const MOST_VALUABLE_LOOKBACK_DAYS = 7;

export default defineEventHandler(async (event: H3Event) => {
  try {
    // Get pagination parameters
    const query = getQuery(event);
    const page = Math.max(1, Number.parseInt(query.page as string) || 1);
    const perPage = Math.min(
      100,
      Math.max(5, Number.parseInt(query.limit as string) || 25)
    );

    // Initialize an empty filters object
    const filters: KilllistFilters = {};

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

    const filterDefaults = {
      ...filters,
      securityStatus,
      techLevel,
      shipClass,
      minTotalValue: filters.minTotalValue,
      isSolo: !!filters.isSolo,
      isAwox: !!filters.isAwox,
      isNpc: !!filters.isNpc,
      noCapsules:
        filters.excludeTypeIds?.some((id) => CAPSULE_TYPE_IDS.includes(id)) ||
        false,
    };

    // Fetch killmails and count in parallel using model functions
    const [killmailsData, totalKillmails] = await track(
      'filter:fetch_kills',
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
      'filter:normalize_killmails',
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
    ] = await track('filter:top_boxes', 'application', async () => {
      return await Promise.all([
        getTopSystemsFiltered(filters, 10, TOP_BOX_LOOKBACK_DAYS),
        getTopRegionsFiltered(filters, 10, TOP_BOX_LOOKBACK_DAYS),
        getTopCharactersFiltered(filters, 10, TOP_BOX_LOOKBACK_DAYS),
        getTopCorporationsFiltered(filters, 10, TOP_BOX_LOOKBACK_DAYS),
        getTopAlliancesFiltered(filters, 10, TOP_BOX_LOOKBACK_DAYS),
      ]);
    });

    // Get Most Valuable Kills for this filter
    const mostValuableKillsData = await track(
      'filter:most_valuable',
      'application',
      async () => {
        return await getMostValuableKillsFiltered(
          filters,
          MOST_VALUABLE_LOOKBACK_DAYS
        );
      }
    );
    mostValuableKillsData.sort((a, b) => b.totalValue - a.totalValue);
    const topValuableKills = mostValuableKillsData.slice(0, 6);

    const mostValuableKills = await track(
      'filter:normalize_valuable',
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
    } = await track('filter:format_top_boxes', 'application', async () => {
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
      };
    });

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

    const baseUrl = '/filter';

    // Get EVE time
    const eveTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Page header light data
    const pageHeaderLight = {
      title: 'Filtered Kills',
      breadcrumbs: [
        { label: 'Home', url: '/' },
        { label: 'Kills', url: '/kills/latest' },
        { label: 'Filter', url: baseUrl },
      ],
      info: [
        { icon: '🕐', text: `EVE Time: ${eveTime}` },
        { text: `Total: ${totalKillmails.toLocaleString()} kills` },
      ],
    };

    // Render the template
    return render(
      'pages/filter',
      {
        title: 'Filtered Kills',
        description: 'Filter and browse EVE Online killmails.',
        keywords: 'eve online, killmail, pvp, kills, filter, search',
      },
      {
        pageHeaderLight,
        title: 'Filtered Kills',
        baseUrl,
        recentKillmails,
        pagination,
        topCharactersFormatted,
        topCorporationsFormatted,
        topAlliancesFormatted,
        topSystemsFormatted,
        topRegionsFormatted,
        mostValuableKills,
        filterQueryString,
        filterDefaults,
        wsFilter: {
          type: 'killType',
          topic: 'latest', // Subscribe to latest kills as a fallback
          mode: 'kills',
        },
        topTimeRangeLabel: `Last ${TOP_BOX_LOOKBACK_DAYS} Days`,
        mostValuableTimeRange: `Last ${MOST_VALUABLE_LOOKBACK_DAYS} Days`,
      },
      event
    );
  } catch (error) {
    return handleError(event, error);
  }
});

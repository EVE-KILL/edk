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
import { env } from '../helpers/env';

const TOP_BOX_LOOKBACK_DAYS = 7;
const MOST_VALUABLE_LOOKBACK_DAYS = 7;

/**
 * Get a human-readable label for the time range being displayed
 */
function getTimeRangeLabel(
  timeRange: string | undefined,
  killTimeFrom: Date | undefined,
  killTimeTo: Date | undefined,
  defaultDays: number
): string {
  if (!timeRange || timeRange === '') {
    return `Last ${defaultDays} Days`;
  }

  switch (timeRange) {
    case 'today':
      return 'Today';
    case 'yesterday':
      return 'Yesterday';
    case 'last7days':
      return 'Last 7 Days';
    case 'thisweek':
      return 'This Week';
    case 'last30days':
      return 'Last 30 Days';
    case 'thismonth':
      return 'This Month';
    case 'custom':
      if (killTimeFrom && killTimeTo) {
        const from = new Date(killTimeFrom).toLocaleDateString();
        const to = new Date(killTimeTo).toLocaleDateString();
        return `${from} - ${to}`;
      }
      return 'Custom Range';
    default:
      return `Last ${defaultDays} Days`;
  }
}

export default defineCachedEventHandler(
  async (event: H3Event) => {
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

      // Check if any filters are active
      const hasActiveFilters =
        securityStatus !== undefined ||
        techLevel !== undefined ||
        shipClass !== undefined ||
        filters.minTotalValue !== undefined ||
        filters.isSolo ||
        filters.isAwox ||
        filters.isNpc ||
        filters.excludeTypeIds?.some((id) => CAPSULE_TYPE_IDS.includes(id)) ||
        query.attackerCount !== undefined ||
        query.timeRange !== undefined ||
        Object.keys(userFilters).length > 0;

      // Fetch entity names for active filters
      const entityFiltersWithNames = await track(
        'filter:fetch_entity_names',
        'application',
        async () => {
          const victim = [];
          const attacker = [];
          const both = [];

          // Victim entities
          if (filters.victimCharacterIds?.length) {
            for (const id of filters.victimCharacterIds) {
              const char = await getCharacter(id);
              if (char) victim.push({ id, name: char.name, type: 'character' });
            }
          }
          if (filters.victimCorporationIds?.length) {
            for (const id of filters.victimCorporationIds) {
              const corp = await getCorporation(id);
              if (corp)
                victim.push({
                  id,
                  name: corp.name,
                  type: 'corporation',
                  ticker: corp.ticker,
                });
            }
          }
          if (filters.victimAllianceIds?.length) {
            for (const id of filters.victimAllianceIds) {
              const alliance = await getAlliance(id);
              if (alliance)
                victim.push({
                  id,
                  name: alliance.name,
                  type: 'alliance',
                  ticker: alliance.ticker,
                });
            }
          }

          // Attacker entities
          if (filters.attackerCharacterIds?.length) {
            for (const id of filters.attackerCharacterIds) {
              const char = await getCharacter(id);
              if (char)
                attacker.push({ id, name: char.name, type: 'character' });
            }
          }
          if (filters.attackerCorporationIds?.length) {
            for (const id of filters.attackerCorporationIds) {
              const corp = await getCorporation(id);
              if (corp)
                attacker.push({
                  id,
                  name: corp.name,
                  type: 'corporation',
                  ticker: corp.ticker,
                });
            }
          }
          if (filters.attackerAllianceIds?.length) {
            for (const id of filters.attackerAllianceIds) {
              const alliance = await getAlliance(id);
              if (alliance)
                attacker.push({
                  id,
                  name: alliance.name,
                  type: 'alliance',
                  ticker: alliance.ticker,
                });
            }
          }

          // Both entities
          if (filters.bothCharacterIds?.length) {
            for (const id of filters.bothCharacterIds) {
              const char = await getCharacter(id);
              if (char) both.push({ id, name: char.name, type: 'character' });
            }
          }
          if (filters.bothCorporationIds?.length) {
            for (const id of filters.bothCorporationIds) {
              const corp = await getCorporation(id);
              if (corp)
                both.push({
                  id,
                  name: corp.name,
                  type: 'corporation',
                  ticker: corp.ticker,
                });
            }
          }
          if (filters.bothAllianceIds?.length) {
            for (const id of filters.bothAllianceIds) {
              const alliance = await getAlliance(id);
              if (alliance)
                both.push({
                  id,
                  name: alliance.name,
                  type: 'alliance',
                  ticker: alliance.ticker,
                });
            }
          }

          return { victim, attacker, both };
        }
      );

      // Fetch location and item names for active filters
      const locationFiltersWithNames = await track(
        'filter:fetch_location_names',
        'application',
        async () => {
          const locations = [];

          // System filters (arrays)
          if (filters.solarSystemIds && filters.solarSystemIds.length > 0) {
            for (const id of filters.solarSystemIds) {
              const system = await getSolarSystem(id);
              if (system)
                locations.push({ id, name: system.name, type: 'system' });
            }
          } else if (filters.solarSystemId) {
            const system = await getSolarSystem(filters.solarSystemId);
            if (system)
              locations.push({
                id: filters.solarSystemId,
                name: system.name,
                type: 'system',
              });
          }

          // Constellation filters (arrays)
          if (filters.constellationIds && filters.constellationIds.length > 0) {
            for (const id of filters.constellationIds) {
              const constellation = await getConstellation(id);
              if (constellation)
                locations.push({
                  id,
                  name: constellation.name,
                  type: 'constellation',
                });
            }
          } else if (filters.constellationId) {
            const constellation = await getConstellation(
              filters.constellationId
            );
            if (constellation)
              locations.push({
                id: filters.constellationId,
                name: constellation.name,
                type: 'constellation',
              });
          }

          // Region filters (arrays)
          if (filters.regionIds && filters.regionIds.length > 0) {
            for (const id of filters.regionIds) {
              const region = await getRegion(id);
              if (region)
                locations.push({ id, name: region.name, type: 'region' });
            }
          } else if (filters.regionId) {
            const region = await getRegion(filters.regionId);
            if (region)
              locations.push({
                id: filters.regionId,
                name: region.name,
                type: 'region',
              });
          }

          return locations;
        }
      );

      const itemFiltersWithNames = await track(
        'filter:fetch_item_names',
        'application',
        async () => {
          const items = [];

          // Item filters (arrays)
          if (
            filters.victimShipTypeIds &&
            filters.victimShipTypeIds.length > 0
          ) {
            for (const id of filters.victimShipTypeIds) {
              const type = await TypeQueries.getType(id);
              if (type) items.push({ id, name: type.name, type: 'item' });
            }
          } else if (filters.victimShipTypeId) {
            const type = await TypeQueries.getType(filters.victimShipTypeId);
            if (type)
              items.push({
                id: filters.victimShipTypeId,
                name: type.name,
                type: 'item',
              });
          }

          return items;
        }
      );

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
        hasActiveFilters,
        // Entity filters with names for UI initialization
        entityFilters: entityFiltersWithNames,
        // Location filters with names for UI initialization
        locationFilters: locationFiltersWithNames,
        // Item filters with names for UI initialization
        itemFilters: itemFiltersWithNames,
        // New filters
        attackerCount: query.attackerCount || '',
        timeRange: query.timeRange || 'last7days',
        killTimeFrom: query.killTimeFrom || '',
        killTimeTo: query.killTimeTo || '',
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
          topTimeRangeLabel: getTimeRangeLabel(
            query.timeRange as string,
            filters.killTimeFrom,
            filters.killTimeTo,
            TOP_BOX_LOOKBACK_DAYS
          ),
          mostValuableTimeRange: getTimeRangeLabel(
            query.timeRange as string,
            filters.killTimeFrom,
            filters.killTimeTo,
            MOST_VALUABLE_LOOKBACK_DAYS
          ),
        },
        event
      );
    } catch (error) {
      return handleError(event, error);
    }
  },
  {
    maxAge: 5,
    staleMaxAge: -1,
    base: 'redis',
    shouldBypassCache: () => env.NODE_ENV !== 'production',
  }
);

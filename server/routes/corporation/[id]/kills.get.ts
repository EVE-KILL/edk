import type { H3Event } from 'h3';
import { timeAgo } from '../../../helpers/time';
import { render, normalizeKillRow } from '../../../helpers/templates';
import {
  getEntityStatsFromCache,
  isStatsCachePopulated,
} from '../../../models/entityStatsCache';
import { getEntityStatsFromView } from '../../../models/entityStatsView';
import { getCorporationWithAlliance } from '../../../models/corporations';
import {
  getEntityKillmails,
  estimateEntityKillmails,
} from '../../../models/killlist';
import { getMostValuableKillsByCorporation } from '../../../models/mostValuableKills';
import { getTopVictimsByAttacker } from '../../../models/topBoxes';
import { track } from '../../../utils/performance-decorators';

import { parseKilllistFilters } from '../../../helpers/killlist-filters';

import { handleError } from '../../../utils/error';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const corporationId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!corporationId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid corporation ID',
      });
    }

    // Fetch corporation basic info with alliance using model
    const corporationData = await track(
      'corporation:kills:fetch_basic_info',
      'application',
      async () => {
        return await getCorporationWithAlliance(corporationId);
      }
    );

    if (!corporationData) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Corporation not found',
      });
    }

    // Get corporation stats
    const stats = await track(
      'corporation:kills:fetch_stats',
      'application',
      async () => {
        const useCache = await isStatsCachePopulated();
        return useCache
          ? await getEntityStatsFromCache(corporationId, 'corporation', 'all')
          : await getEntityStatsFromView(corporationId, 'corporation', 'all');
      }
    );

    // Fetch all entity data in parallel
    const [
      topCharacters,
      topCorps,
      topAlliances,
      topShips,
      topSystems,
      topRegions,
      mostValuable,
    ] = await track(
      'corporation:kills:fetch_dashboard_data',
      'application',
      async () => {
        return await Promise.all([
          getTopVictimsByAttacker(
            corporationId,
            'corporation',
            'week',
            'character',
            10
          ),
          getTopVictimsByAttacker(
            corporationId,
            'corporation',
            'week',
            'corporation',
            10
          ),
          getTopVictimsByAttacker(
            corporationId,
            'corporation',
            'week',
            'alliance',
            10
          ),
          getTopVictimsByAttacker(
            corporationId,
            'corporation',
            'week',
            'ship',
            10
          ),
          getTopVictimsByAttacker(
            corporationId,
            'corporation',
            'week',
            'system',
            10
          ),
          getTopVictimsByAttacker(
            corporationId,
            'corporation',
            'week',
            'region',
            10
          ),
          getMostValuableKillsByCorporation(corporationId, 'week', 6),
        ]);
      }
    );

    // Get pagination parameters
    const query = getQuery(event);
    const page = Math.max(1, Number.parseInt(query.page as string) || 1);
    const perPage = Math.min(
      100,
      Math.max(5, Number.parseInt(query.limit as string) || 25)
    );

    // Parse filters from query parameters
    const {
      filters: userFilters,
      securityStatus,
      techLevel,
      shipClass,
    } = parseKilllistFilters(query);

    // Fetch killmails where corporation was attacker (kills) using model
    const [killmailsData, totalKillmails] = await track(
      'corporation:kills:fetch_killmails',
      'application',
      async () => {
        return await Promise.all([
          getEntityKillmails(
            corporationId,
            'corporation',
            'kills',
            page,
            perPage,
            userFilters
          ),
          estimateEntityKillmails(
            corporationId,
            'corporation',
            'kills',
            userFilters
          ),
        ]);
      }
    );

    // Calculate pagination
    const totalPages = await track(
      'corporation:kills:calculate_pagination',
      'application',
      async () => {
        return Math.ceil(totalKillmails / perPage);
      }
    );

    const pagination = {
      currentPage: page,
      totalPages,
      pages: generatePageNumbers(page, totalPages),
      hasPrev: page > 1,
      hasNext: page < totalPages,
      prevPage: page - 1,
      nextPage: page + 1,
      showFirst: page > 3 && totalPages > 5,
      showLast: page < totalPages - 2 && totalPages > 5,
      limit: perPage,
    };

    // Transform killmail data to match component expectations
    const killmails = await track(
      'corporation:kills:normalize_killmails',
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

    // Entity header data
    const entityData = {
      entityId: corporationId,
      entityType: 'corporation',
      name: corporationData.name,
      type: 'corporation',
      stats,
      baseUrl: `/corporation/${corporationId}/kills`,
      entityBaseUrl: `/corporation/${corporationId}`,
      currentTab: 'kills',
      parent: corporationData.allianceId
        ? {
            id: corporationData.allianceId,
            name: corporationData.allianceName,
            ticker: corporationData.allianceTicker,
          }
        : null,
      grandparent: null,
    };

    // Top 10 boxes - transform to match partial expectations
    const top10 = await track(
      'corporation:kills:transform_top10',
      'application',
      async () => {
        return {
          ships: (topShips as any[]).map((s: any) => ({
            ...s,
            imageType: 'type',
            imageId: s.id,
            link: `/type/${s.id}`,
          })),
          characters: (topCharacters as any[]).map((c: any) => ({
            ...c,
            imageType: 'character',
            imageId: c.id,
            link: `/character/${c.id}`,
          })),
          systems: (topSystems as any[]).map((s: any) => ({
            ...s,
            imageType: 'system',
            imageId: s.id,
            link: `/system/${s.id}`,
          })),
          regions: (topRegions as any[]).map((r: any) => ({
            ...r,
            imageType: 'region',
            imageId: r.id,
            link: `/region/${r.id}`,
          })),
          corporations: (topCorps as any[]).map((c: any) => ({
            ...c,
            imageType: 'corporation',
            imageId: c.id,
            link: `/corporation/${c.id}`,
          })),
          alliances: (topAlliances as any[]).map((a: any) => ({
            ...a,
            imageType: 'alliance',
            imageId: a.id,
            link: `/alliance/${a.id}`,
          })),
        };
      }
    );

    // Transform most valuable kills to template format
    const transformedMostValuable = await track(
      'corporation:kills:transform_most_valuable',
      'application',
      async () => {
        return mostValuable.map((kill) => {
          const normalized = normalizeKillRow(kill);
          return {
            ...normalized,
            totalValue: kill.totalValue ?? normalized.totalValue,
            killmailTime: normalized.killmailTime,
          };
        });
      }
    );

    // Render the template
    return render(
      'pages/corporation-kills',
      {
        title: `${corporationData.name} - Kills`,
        description: `Kills by ${corporationData.name}`,
        keywords: 'eve online, corporation, killmail, kills, pvp',
      },
      {
        ...entityData,
        top10Stats: top10,
        characterTitle: 'Most Hunted Characters',
        corporationTitle: 'Most Hunted Corps',
        allianceTitle: 'Most Hunted Alliances',
        shipTitle: 'Most Hunted Ships',
        systemTitle: 'Top Hunting Grounds',
        regionTitle: 'Top Regions',
        timeRange: 'Last 7 Days',
        mostValuableKills: transformedMostValuable,
        killmails,
        pagination,
        filterDefaults: {
          ...userFilters,
          securityStatus,
          techLevel,
          shipClass,
          skipCapsules:
            userFilters.excludeTypeIds?.some((id) =>
              [670, 33328].includes(id)
            ) || false,
        },
        wsFilter: {
          type: 'corporation',
          id: corporationId,
          mode: 'kills',
        },
      },
      event
    );
  } catch (error) {
    return handleError(event, error);
  }
});

import { generatePageNumbers } from '../../../helpers/pagination';

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
import { track } from '../../../utils/performance-decorators';
import { getDashboardData } from '../../../helpers/dashboard-data';

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

    // Fetch all data in parallel
    const [stats, dashboardData, [killmailsData, totalKillmails]] = await Promise.all([
      track('corporation:kills:fetch_stats', 'application', async () => {
        const useCache = await isStatsCachePopulated();
        return useCache
          ? await getEntityStatsFromCache(corporationId, 'corporation', 'all')
          : await getEntityStatsFromView(corporationId, 'corporation', 'all');
      }),
      getDashboardData(corporationId, 'corporation', 'kills', userFilters),
      track('corporation:kills:fetch_killmails', 'application', async () => {
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
      }),
    ]);

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
        ...dashboardData,
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

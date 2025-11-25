import type { H3Event } from 'h3';
import { timeAgo } from '../../../helpers/time';
import { render, normalizeKillRow } from '../../../helpers/templates';
import {
  getEntityStatsFromCache,
  isStatsCachePopulated,
} from '../../../models/entityStatsCache';
import { getEntityStatsFromView } from '../../../models/entityStatsView';
import { getAlliance } from '../../../models/alliances';
import {
  getEntityKillmails,
  estimateEntityKillmails,
  estimateEntityKillmails,
} from '../../../models/killlist';
import { track } from '../../../utils/performance-decorators';

import { parseKilllistFilters } from '../../../helpers/killlist-filters';

import { handleError } from '../../../utils/error';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const allianceId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!allianceId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid alliance ID',
      });
    }

    // Fetch alliance basic info using model
    const allianceData = await track(
      'alliance:losses:fetch_basic_info',
      'application',
      async () => {
        return await getAlliance(allianceId);
      }
    );

    if (!allianceData) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Alliance not found',
      });
    }

    // Get alliance stats
    const stats = await track(
      'alliance:losses:fetch_stats',
      'application',
      async () => {
        const useCache = await isStatsCachePopulated();
        return useCache
          ? await getEntityStatsFromCache(allianceId, 'alliance', 'all')
          : await getEntityStatsFromView(allianceId, 'alliance', 'all');
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

    // Fetch killmails and count in parallel using model functions
    const [killmailsData, totalKillmails] = await track(
      'alliance:losses:fetch_killmails',
      'application',
      async () => {
        return await Promise.all([
          getEntityKillmails(
            allianceId,
            'alliance',
            'losses',
            page,
            perPage,
            userFilters
          ),
          estimateEntityKillmails(
            allianceId,
            'alliance',
            'losses',
            userFilters
          ),
        ]);
      }
    );

    // Calculate pagination
    const totalPages = await track(
      'alliance:losses:calculate_pagination',
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
      'alliance:losses:normalize_killmails',
      'application',
      async () => {
        return killmailsData.map((km) => {
          const normalized = normalizeKillRow(km);
          return {
            ...normalized,
            isLoss: km.victimAllianceId === allianceId,
            killmailTimeRelative: timeAgo(
              km.killmailTime ?? normalized.killmailTime
            ),
          };
        });
      }
    );

    // Entity header data
    const entityData = {
      entityId: allianceId,
      entityType: 'alliance',
      name: allianceData.name,
      type: 'alliance',
      stats,
      baseUrl: `/alliance/${allianceId}/losses`,
      entityBaseUrl: `/alliance/${allianceId}`,
      currentTab: 'losses',
      parent: null,
      grandparent: null,
    };

    // Render the template
    return render(
      'pages/alliance-losses',
      {
        title: `${allianceData.name} - Losses`,
        description: `Losses by ${allianceData.name}`,
        keywords: 'eve online, alliance, killmail, losses, pvp',
      },
      {
        ...entityData,
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
          type: 'alliance',
          id: allianceId,
          mode: 'losses',
        },
      },
      event
    );
  } catch (error) {
    return handleError(event, error);
  }
});

import { generatePageNumbers } from '../../../helpers/pagination';

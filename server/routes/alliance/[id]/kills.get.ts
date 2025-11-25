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
      'alliance:kills:fetch_basic_info',
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
      'alliance:kills:fetch_stats',
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

    // Fetch killmails where alliance was attacker (kills) using model
    const [killmailsData, totalKillmails] = await track(
      'alliance:kills:fetch_killmails',
      'application',
      async () => {
        return await Promise.all([
          getEntityKillmails(
            allianceId,
            'alliance',
            'kills',
            page,
            perPage,
            userFilters
          ),
          estimateEntityKillmails(allianceId, 'alliance', 'kills', userFilters),
        ]);
      }
    );

    // Calculate pagination
    const totalPages = Math.ceil(totalKillmails / perPage);
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
    const killmails = killmailsData.map((km) => {
      const normalized = normalizeKillRow(km);
      return {
        ...normalized,
        killmailTimeRelative: timeAgo(
          km.killmailTime ?? normalized.killmailTime
        ),
      };
    });

    // Entity header data
    const entityData = {
      entityId: allianceId,
      entityType: 'alliance',
      name: allianceData.name,
      type: 'alliance',
      stats,
      baseUrl: `/alliance/${allianceId}/kills`,
      entityBaseUrl: `/alliance/${allianceId}`,
      currentTab: 'kills',
      parent: null,
      grandparent: null,
    };

    // Render the template
    return render(
      'pages/alliance-kills',
      {
        title: `${allianceData.name} - Kills`,
        description: `Kills by ${allianceData.name}`,
        keywords: 'eve online, alliance, killmail, kills, pvp',
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

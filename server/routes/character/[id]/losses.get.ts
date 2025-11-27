import type { H3Event } from 'h3';
import { timeAgo } from '../../../helpers/time';
import { render, normalizeKillRow } from '../../../helpers/templates';
import {
  getEntityStatsFromCache,
  isStatsCachePopulated,
} from '../../../models/entityStatsCache';
import { getEntityStatsFromView } from '../../../models/entityStatsView';
import { getCharacterWithCorporationAndAlliance } from '../../../models/characters';
import {
  getEntityKillmails,
  estimateEntityKillmails,
} from '../../../models/killlist';
import { parseKilllistFilters } from '../../../helpers/killlist-filters';
import { track } from '../../../utils/performance-decorators';
import { getDashboardData } from '../../../helpers/dashboard-data';

import { handleError } from '../../../utils/error';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const characterId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!characterId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid character ID',
      });
    }

    // Fetch character basic info using model
    const characterData = await track(
      'character:losses:fetch_basic_info',
      'application',
      async () => {
        return await getCharacterWithCorporationAndAlliance(characterId);
      }
    );

    if (!characterData) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Character not found',
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
      track('character:losses:fetch_stats', 'application', async () => {
        const useCache = await isStatsCachePopulated();
        return useCache
          ? await getEntityStatsFromCache(characterId, 'character', 'all')
          : await getEntityStatsFromView(characterId, 'character', 'all');
      }),
      getDashboardData(characterId, 'character', 'losses', userFilters),
      track('character:losses:fetch_killmails', 'application', async () => {
        return await Promise.all([
          getEntityKillmails(
            characterId,
            'character',
            'losses',
            page,
            perPage,
            userFilters
          ),
          estimateEntityKillmails(
            characterId,
            'character',
            'losses',
            userFilters
          ),
        ]);
      }),
    ]);

    // Calculate pagination
    const totalPages = await track(
      'character:losses:calculate_pagination',
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
      'character:losses:normalize_killmails',
      'application',
      async () => {
        return killmailsData.map((km) => {
          const normalized = normalizeKillRow(km);
          return {
            ...normalized,
            isLoss: true,
            killmailTimeRelative: timeAgo(
              km.killmailTime ?? normalized.killmailTime
            ),
          };
        });
      }
    );

    // Entity header data
    const entityData = {
      entityId: characterId,
      entityType: 'character',
      name: characterData.name,
      type: 'character',
      stats,
      baseUrl: `/character/${characterId}/losses`,
      entityBaseUrl: `/character/${characterId}`,
      currentTab: 'losses',
      parent: characterData.corporationId
        ? {
            id: characterData.corporationId,
            name: characterData.corporationName,
            ticker: characterData.corporationTicker,
          }
        : null,
      grandparent: characterData.allianceId
        ? {
            id: characterData.allianceId,
            name: characterData.allianceName,
            ticker: characterData.allianceTicker,
          }
        : null,
    };

    // Render the template
    return render(
      'pages/character-losses',
      {
        title: `${characterData.name} - Losses`,
        description: `Losses by ${characterData.name}`,
        keywords: 'eve online, character, killmail, losses, pvp',
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
          type: 'character',
          id: characterId,
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

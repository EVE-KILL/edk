import type { H3Event } from 'h3';
import { timeAgo } from '../../../helpers/time';
import { render, normalizeKillRow } from '../../../helpers/templates';
import { getEntityStatsFromView } from '../../../models/entityStatsView';
import { getCharacterWithCorporationAndAlliance } from '../../../models/characters';
import {
  getEntityKillmails,
  countEntityKillmails,
} from '../../../models/killlist';
import { parseKilllistFilters } from '../../../helpers/killlist-filters';

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
    const characterData =
      await getCharacterWithCorporationAndAlliance(characterId);

    if (!characterData) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Character not found',
      });
    }

    // Get character stats using the same query as dashboard
    const stats = await getEntityStatsFromView(characterId, 'character', 'all');

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
      filterQueryString,
      securityStatus,
      techLevel,
      shipClass,
    } = parseKilllistFilters(query);

    // Fetch killmails where character was victim (losses) using model
    const [killmailsData, totalKillmails] = await Promise.all([
      getEntityKillmails(
        characterId,
        'character',
        'losses',
        page,
        perPage,
        userFilters
      ),
      countEntityKillmails(characterId, 'character', 'losses', userFilters),
    ]);

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
        isLoss: true,
        killmailTimeRelative: timeAgo(
          km.killmailTime ?? normalized.killmailTime
        ),
      };
    });

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
      parent: {
        id: characterData.corporationId,
        name: characterData.corporationName,
        ticker: characterData.corporationTicker,
      },
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

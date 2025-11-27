import type { H3Event } from 'h3';
import { timeAgo } from '../../../helpers/time';
import { render, normalizeKillRow } from '../../../helpers/templates';
import { getEntityStatsFromView } from '../../../models/entityStatsView';
import { getCharacterWithCorporationAndAlliance } from '../../../models/characters';
import {
  getEntityKillmails,
  estimateEntityKillmails,
  estimateEntityKillmails,
} from '../../../models/killlist';
import { parseKilllistFilters } from '../../../helpers/killlist-filters';
import { getMostValuableLossesByCharacter } from '../../../models/mostValuableKills';
import { getTopAttackersByVictim } from '../../../models/topBoxes';
import { track } from '../../../utils/performance-decorators';

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

    // Fetch all entity data in parallel
    const [
      stats,
      topCorps,
      topAlliances,
      topShips,
      topSystems,
      topRegions,
      mostValuable,
    ] = await track(
      'character:losses:fetch_dashboard_stats',
      'application',
      async () => {
        // Use cache if available, fallback to view
        const statsPromise = getEntityStatsFromView(
          characterId,
          'character',
          'all'
        );

        return await Promise.all([
          statsPromise,
          getTopAttackersByVictim(
            characterId,
            'character',
            'week',
            'corporation',
            10
          ),
          getTopAttackersByVictim(
            characterId,
            'character',
            'week',
            'alliance',
            10
          ),
          getTopAttackersByVictim(characterId, 'character', 'week', 'ship', 10),
          getTopAttackersByVictim(
            characterId,
            'character',
            'week',
            'system',
            10
          ),
          getTopAttackersByVictim(
            characterId,
            'character',
            'week',
            'region',
            10
          ),
          getMostValuableLossesByCharacter(characterId, 'week', 6),
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
      estimateEntityKillmails(characterId, 'character', 'losses', userFilters),
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

    // Top 10 boxes - transform to match partial expectations
    const top10 = {
      ships: (topShips as any[]).map((s: any) => ({
        ...s,
        imageType: 'type',
        imageId: s.id,
        link: `/type/${s.id}`,
      })),
      characters: [],
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

    // Transform most valuable kills to template format
    const transformedMostValuable = mostValuable.map((kill) => {
      const normalized = normalizeKillRow(kill);
      return {
        ...normalized,
        totalValue: kill.totalValue ?? normalized.totalValue,
        killmailTime: normalized.killmailTime,
      };
    });

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
        top10Stats: top10,
        corporationTitle: 'Top Agressor Corps',
        allianceTitle: 'Top Agressor Alliances',
        shipTitle: 'Top Agressor Ships',
        systemTitle: 'Top Systems',
        regionTitle: 'Top Regions',
        timeRange: 'Last 7 Days',
        mostValuableKills: transformedMostValuable,
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

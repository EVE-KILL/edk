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
import { getMostValuableKillsByCharacter } from '../../../models/mostValuableKills';
import { getTopVictimsByAttacker } from '../../../models/topBoxes';
import { parseKilllistFilters } from '../../../helpers/killlist-filters';
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
    const characterData = await track(
      'character:kills:fetch_basic_info',
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

    // Get character stats
    const stats = await track(
      'character:kills:fetch_stats',
      'application',
      async () => {
        const useCache = await isStatsCachePopulated();
        return useCache
          ? await getEntityStatsFromCache(characterId, 'character', 'all')
          : await getEntityStatsFromView(characterId, 'character', 'all');
      }
    );

    // Fetch all entity data in parallel
    const [
      topCorps,
      topAlliances,
      topShips,
      topSystems,
      topRegions,
      mostValuable,
    ] = await track('character:fetch_stats', 'application', async () => {
      return await Promise.all([
        getTopVictimsByAttacker(
          characterId,
          'character',
          'week',
          'corporation',
          10
        ),
        getTopVictimsByAttacker(
          characterId,
          'character',
          'week',
          'alliance',
          10
        ),
        getTopVictimsByAttacker(characterId, 'character', 'week', 'ship', 10),
        getTopVictimsByAttacker(characterId, 'character', 'week', 'system', 10),
        getTopVictimsByAttacker(characterId, 'character', 'week', 'region', 10),
        getMostValuableKillsByCharacter(characterId, 'week', 6),
      ]);
    });

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

    // Fetch killmails where character was attacker (kills) using model
    const [killmailsData, totalKillmails] = await track(
      'character:kills:fetch_killmails',
      'application',
      async () => {
        return await Promise.all([
          getEntityKillmails(
            characterId,
            'character',
            'kills',
            page,
            perPage,
            userFilters
          ),
          estimateEntityKillmails(
            characterId,
            'character',
            'kills',
            userFilters
          ),
        ]);
      }
    );

    // Calculate pagination
    const totalPages = await track(
      'character:kills:calculate_pagination',
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
      'character:kills:normalize_killmails',
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
      entityId: characterId,
      entityType: 'character',
      name: characterData.name,
      type: 'character',
      stats,
      baseUrl: `/character/${characterId}/kills`,
      entityBaseUrl: `/character/${characterId}`,
      currentTab: 'kills',
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

    // Top 10 boxes - transform to match partial expectations
    const top10 = await track(
      'character:transform_top10',
      'application',
      async () => {
        return {
          ships: (topShips as any[]).map((s: any) => ({
            ...s,
            imageType: 'ship',
            imageId: s.id,
            link: `/item/${s.id}`,
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
      }
    );

    // Transform most valuable kills to template format
    const transformedMostValuable = await track(
      'character:transform_most_valuable',
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
      'pages/character-kills',
      {
        title: `${characterData.name} - Kills`,
        description: `Kills by ${characterData.name}`,
        keywords: 'eve online, character, killmail, kills, pvp',
      },
      {
        ...entityData,
        top10Stats: top10,
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
          type: 'character',
          id: characterId,
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

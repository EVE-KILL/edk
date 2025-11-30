/**
 * Character entity page - dashboard
 */
import type { H3Event } from 'h3';
import { timeAgo } from '../../../helpers/time';
import { render, normalizeKillRow } from '../../../helpers/templates';
import { renderErrorPage } from '../../../utils/error';
import { getCharacterWithCorporationAndAlliance } from '../../../models/characters';
import {
  getEntityKillmails,
  estimateEntityKillmails,
  estimateEntityKillmails,
} from '../../../models/killlist';
import {
  getEntityStatsFromCache,
  isStatsCachePopulated,
} from '../../../models/entityStatsCache';
import { getEntityStatsFromView } from '../../../models/entityStatsView';
import { getMostValuableKillsByCharacter } from '../../../models/mostValuableKills';
import { getTopVictimsByAttacker } from '../../../models/topBoxes';
import { track } from '../../../utils/performance-decorators';
import { getActiveWarsForCharacter } from '../../../models/wars';

import { handleError } from '../../../utils/error';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const characterId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!characterId) {
      return renderErrorPage(
        event,
        400,
        'Invalid Character ID',
        'The character ID provided is not valid.'
      );
    }

    // Fetch character basic info using model
    const characterData = await track(
      'character:fetch_basic_info',
      'application',
      async () => {
        return await getCharacterWithCorporationAndAlliance(characterId);
      }
    );

    if (!characterData) {
      return renderErrorPage(
        event,
        404,
        'Character Not Found',
        `Character #${characterId} not found in the database.`
      );
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
      activeWars,
    ] = await track('character:fetch_stats', 'application', async () => {
      // Use cache if available, fallback to view
      const useCache = await isStatsCachePopulated();
      const statsPromise = useCache
        ? getEntityStatsFromCache(characterId, 'character', 'all')
        : getEntityStatsFromView(characterId, 'character', 'all');

      return await Promise.all([
        statsPromise,
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
        getActiveWarsForCharacter(characterId),
      ]);
    });

    // Get pagination parameters
    const query = getQuery(event);
    const page = Math.max(1, Number.parseInt(query.page as string) || 1);
    const perPage = 30;

    // Fetch paginated killmails using model function
    const [killmails, totalKillmails] = await track(
      'character:fetch_killmails',
      'application',
      async () => {
        return await Promise.all([
          getEntityKillmails(characterId, 'character', 'all', page, perPage),
          estimateEntityKillmails(characterId, 'character', 'all'),
        ]);
      }
    );

    const totalPages = await track(
      'character:calculate_pagination',
      'application',
      async () => {
        return Math.ceil(totalKillmails / perPage);
      }
    );

    // Format killmail data for template
    const recentKillmails = await track(
      'character:normalize_killmails',
      'application',
      async () => {
        return killmails.map((km) => {
          const normalized = normalizeKillRow(km);
          return {
            ...normalized,
            isLoss: km.victimCharacterId === characterId,
            killmailTimeRelative: timeAgo(
              km.killmailTime ?? normalized.killmailTime
            ),
          };
        });
      }
    );

    // Entity header data
    const entityData = await track(
      'character:build_entity_data',
      'application',
      async () => {
        return {
          entityId: characterId,
          entityType: 'character',
          name: characterData.name,
          type: 'character',
          stats,
          baseUrl: `/character/${characterId}`,
          entityBaseUrl: `/character/${characterId}`,
          currentTab: 'dashboard',
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
      }
    );

    // Top 10 boxes - transform to match partial expectations
    const top10 = await track(
      'character:transform_top10',
      'application',
      async () => {
        return {
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
      }
    );

    // Pagination
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
    };

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

    // Get EVE time
    const eveTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Page header light data
    const breadcrumbParts = [{ label: 'Home', url: '/' }];
    if (characterData.allianceName) {
      breadcrumbParts.push({
        label: characterData.allianceName,
        url: `/alliance/${characterData.allianceId}`,
      });
    }
    if (characterData.corporationName) {
      breadcrumbParts.push({
        label: characterData.corporationName,
        url: `/corporation/${characterData.corporationId}`,
      });
    }
    breadcrumbParts.push({
      label: characterData.name,
      url: `/character/${characterId}`,
    });

    const pageHeaderLight = {
      title: characterData.name,
      breadcrumbs: breadcrumbParts,
      info: [
        { icon: '🕐', text: `EVE Time: ${eveTime}` },
        ...(characterData.corporationId
          ? [
              {
                logo: { type: 'corporation', id: characterData.corporationId },
              },
            ]
          : []),
        ...(characterData.allianceId
          ? [
              {
                logo: { type: 'alliance', id: characterData.allianceId },
              },
            ]
          : []),
      ],
    };

    // Render the template
    return render(
      'pages/character-detail',
      {
        title: `${characterData.name} - Character`,
        description: `Character statistics for ${characterData.name}`,
        keywords: 'eve online, character, killmail, pvp',
      },
      {
        pageHeaderLight,
        ...entityData,
        top10Stats: top10,
        corporationTitle: 'Most Hunted Corps',
        allianceTitle: 'Most Hunted Alliances',
        shipTitle: 'Most Hunted Ships',
        systemTitle: 'Top Hunting Grounds',
        regionTitle: 'Top Regions',
        timeRange: 'Last 7 Days',
        mostValuableKills: transformedMostValuable,
        recentKillmails,
        pagination,
        activeWars,
        wsFilter: {
          type: 'character',
          id: characterId,
          mode: 'all',
        },
      },
      event
    );
  } catch (error) {
    return handleError(event, error);
  }
});

import { generatePageNumbers } from '../../../helpers/pagination';

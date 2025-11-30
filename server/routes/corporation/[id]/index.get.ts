/**
 * Corporation entity page - dashboard
 */
import type { H3Event } from 'h3';
import { timeAgo } from '../../../helpers/time';
import { render, normalizeKillRow } from '../../../helpers/templates';
import { renderErrorPage } from '../../../utils/error';
import { getCorporationWithAlliance } from '../../../models/corporations';
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
import { getMostValuableKillsByCorporation } from '../../../models/mostValuableKills';
import { getTopVictimsByAttacker } from '../../../models/topBoxes';
import { track } from '../../../utils/performance-decorators';
import { getActiveWarsForCorporation } from '../../../models/wars';

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

    // Fetch corporation basic info using model
    const corporationData = await track(
      'corporation:fetch_basic_info',
      'application',
      async () => {
        return await getCorporationWithAlliance(corporationId);
      }
    );

    if (!corporationData) {
      return renderErrorPage(
        event,
        404,
        'Corporation Not Found',
        `Corporation #${corporationId} not found in the database.`
      );
    }

    // Fetch all entity data in parallel
    const [
      stats,
      topCharacters,
      topCorps,
      topAlliances,
      topShips,
      topSystems,
      topRegions,
      mostValuable,
      activeWars,
    ] = await track('corporation:fetch_stats', 'application', async () => {
      // Use cache if available, fallback to view
      const useCache = await isStatsCachePopulated();
      const statsPromise = useCache
        ? getEntityStatsFromCache(corporationId, 'corporation', 'all')
        : getEntityStatsFromView(corporationId, 'corporation', 'all');

      return await Promise.all([
        statsPromise,
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
        getActiveWarsForCorporation(corporationId),
      ]);
    });

    // Get pagination parameters
    const query = getQuery(event);
    const page = Math.max(1, Number.parseInt(query.page as string) || 1);
    const perPage = 30;

    // Fetch paginated killmails using model function
    const [killmails, totalKillmails] = await track(
      'corporation:fetch_killmails',
      'application',
      async () => {
        return await Promise.all([
          getEntityKillmails(
            corporationId,
            'corporation',
            'all',
            page,
            perPage
          ),
          estimateEntityKillmails(corporationId, 'corporation', 'all'),
        ]);
      }
    );

    const totalPages = await track(
      'corporation:calculate_pagination',
      'application',
      async () => {
        return Math.ceil(totalKillmails / perPage);
      }
    );

    // Format killmail data for template
    const recentKillmails = await track(
      'corporation:normalize_killmails',
      'application',
      async () => {
        return killmails.map((km) => {
          const normalized = normalizeKillRow(km);
          return {
            ...normalized,
            isLoss: km.victimCorporationId === corporationId,
            killmailTimeRelative: timeAgo(
              km.killmailTime ?? normalized.killmailTime
            ),
          };
        });
      }
    );

    // Entity header data
    const entityData = await track(
      'corporation:build_entity_data',
      'application',
      async () => {
        return {
          entityId: corporationId,
          entityType: 'corporation',
          name: corporationData.name,
          type: 'corporation',
          stats,
          baseUrl: `/corporation/${corporationId}`,
          entityBaseUrl: `/corporation/${corporationId}`,
          currentTab: 'dashboard',
          parent: corporationData.allianceId
            ? {
                id: corporationData.allianceId,
                name: corporationData.allianceName,
                ticker: corporationData.allianceTicker,
              }
            : null,
          grandparent: null,
        };
      }
    );

    // Top boxes - for corporations we show characters, corporations, alliances, ships, systems, regions
    const top10 = await track(
      'corporation:transform_top10',
      'application',
      async () => {
        return {
          characters: (Array.isArray(topCharacters) ? topCharacters : []).map(
            (c: any) => ({
              ...c,
              imageType: 'character',
              imageId: c.id,
              link: `/character/${c.id}`,
            })
          ),
          corporations: (Array.isArray(topCorps) ? topCorps : []).map(
            (c: any) => ({
              ...c,
              imageType: 'corporation',
              imageId: c.id,
              link: `/corporation/${c.id}`,
            })
          ),
          alliances: (Array.isArray(topAlliances) ? topAlliances : []).map(
            (a: any) => ({
              ...a,
              imageType: 'alliance',
              imageId: a.id,
              link: `/alliance/${a.id}`,
            })
          ),
          ships: (Array.isArray(topShips) ? topShips : []).map((s: any) => ({
            ...s,
            imageType: 'type',
            imageId: s.id,
            link: `/type/${s.id}`,
          })),
          systems: (Array.isArray(topSystems) ? topSystems : []).map(
            (s: any) => ({
              ...s,
              imageType: 'system',
              imageId: s.id,
              link: `/system/${s.id}`,
            })
          ),
          regions: (Array.isArray(topRegions) ? topRegions : []).map(
            (r: any) => ({
              ...r,
              imageType: 'region',
              imageId: r.id,
              link: `/region/${r.id}`,
            })
          ),
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
      'corporation:transform_most_valuable',
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
    if (corporationData.allianceName) {
      breadcrumbParts.push({
        label: corporationData.allianceName,
        url: `/alliance/${corporationData.allianceId}`,
      });
    }
    breadcrumbParts.push({
      label: corporationData.name,
      url: `/corporation/${corporationId}`,
    });

    const pageHeaderLight = {
      title: corporationData.name,
      breadcrumbs: breadcrumbParts,
      info: [
        { icon: '🕐', text: `EVE Time: ${eveTime}` },
        ...(corporationData.allianceId
          ? [
              {
                logo: { type: 'alliance', id: corporationData.allianceId },
              },
            ]
          : []),
      ],
    };

    // Render the template
    return render(
      'pages/corporation-detail',
      {
        title: `${corporationData.name} - Corporation`,
        description: `Corporation statistics for ${corporationData.name}`,
        keywords: 'eve online, corporation, killmail, pvp',
      },
      {
        pageHeaderLight,
        ...entityData,
        top10Stats: top10,
        characterTitle: 'Most Hunted Pilots',
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
          type: 'corporation',
          id: corporationId,
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

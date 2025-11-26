/**
 * Alliance entity page - dashboard
 */
import type { H3Event } from 'h3';
import { timeAgo } from '../../../helpers/time';
import { render, normalizeKillRow } from '../../../helpers/templates';
import { getAlliance } from '../../../models/alliances';
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
import { getMostValuableKillsByAlliance } from '../../../models/mostValuableKills';
import { getTopVictimsByAttacker } from '../../../models/topBoxes';
import { track } from '../../../utils/performance-decorators';

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
      'alliance:fetch_basic_info',
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
    ] = await track('alliance:fetch_stats', 'application', async () => {
      // Use cache if available, fallback to view
      const useCache = await isStatsCachePopulated();
      const statsPromise = useCache
        ? getEntityStatsFromCache(allianceId, 'alliance', 'all')
        : getEntityStatsFromView(allianceId, 'alliance', 'all');

      return await Promise.all([
        statsPromise,
        getTopVictimsByAttacker(
          allianceId,
          'alliance',
          'week',
          'character',
          10
        ),
        getTopVictimsByAttacker(
          allianceId,
          'alliance',
          'week',
          'corporation',
          10
        ),
        getTopVictimsByAttacker(allianceId, 'alliance', 'week', 'alliance', 10),
        getTopVictimsByAttacker(allianceId, 'alliance', 'week', 'ship', 10),
        getTopVictimsByAttacker(allianceId, 'alliance', 'week', 'system', 10),
        getTopVictimsByAttacker(allianceId, 'alliance', 'week', 'region', 10),
        getMostValuableKillsByAlliance(allianceId, 'week', 6),
      ]);
    });

    // TODO: Implement top systems/regions/corporations/alliances stats

    // Get pagination parameters
    const query = getQuery(event);
    const page = Math.max(1, Number.parseInt(query.page as string) || 1);
    const perPage = 30;

    // Fetch paginated killmails using model function
    const [killmails, totalKillmails] = await track(
      'alliance:fetch_killmails',
      'application',
      async () => {
        return await Promise.all([
          getEntityKillmails(allianceId, 'alliance', 'all', page, perPage),
          estimateEntityKillmails(allianceId, 'alliance', 'all'),
        ]);
      }
    );

    const totalPages = await track(
      'alliance:calculate_pagination',
      'application',
      async () => {
        return Math.ceil(totalKillmails / perPage);
      }
    );

    // Format killmail data for template
    const recentKillmails = await track(
      'alliance:normalize_killmails',
      'application',
      async () => {
        return killmails.map((km) => {
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
    const entityData = await track(
      'alliance:build_entity_data',
      'application',
      async () => {
        return {
          entityId: allianceId,
          entityType: 'alliance',
          name: allianceData.name,
          type: 'alliance',
          stats,
          baseUrl: `/alliance/${allianceId}`,
          entityBaseUrl: `/alliance/${allianceId}`,
          currentTab: 'dashboard',
          parent: null,
          grandparent: null,
        };
      }
    );

    // Top boxes - for alliances we show characters, corporations, alliances, ships, systems, regions
    const top10 = await track(
      'alliance:transform_top10',
      'application',
      async () => {
        return {
          characters: (Array.isArray(topCharacters) ? topCharacters : []).map(
            (c) => ({
              ...c,
              imageType: 'character',
              imageId: c.id,
              link: `/character/${c.id}`,
            })
          ),
          corporations: (Array.isArray(topCorps) ? topCorps : []).map((c) => ({
            ...c,
            imageType: 'corporation',
            imageId: c.id,
            link: `/corporation/${c.id}`,
          })),
          alliances: (Array.isArray(topAlliances) ? topAlliances : []).map(
            (a) => ({
              ...a,
              imageType: 'alliance',
              imageId: a.id,
              link: `/alliance/${a.id}`,
            })
          ),
          ships: (Array.isArray(topShips) ? topShips : []).map((s) => ({
            ...s,
            imageType: 'type',
            imageId: s.id,
            link: `/type/${s.id}`,
          })),
          systems: (Array.isArray(topSystems) ? topSystems : []).map((s) => ({
            ...s,
            imageType: 'system',
            imageId: s.id,
            link: `/system/${s.id}`,
          })),
          regions: (Array.isArray(topRegions) ? topRegions : []).map((r) => ({
            ...r,
            imageType: 'region',
            imageId: r.id,
            link: `/region/${r.id}`,
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
      'alliance:transform_most_valuable',
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
    const breadcrumbParts = [
      { label: 'Home', url: '/' },
      { label: allianceData.name, url: `/alliance/${allianceId}` },
    ];

    const pageHeaderLight = {
      title: allianceData.name,
      breadcrumbs: breadcrumbParts,
      info: [{ icon: '🕐', text: `EVE Time: ${eveTime}` }],
    };

    // Render the template
    return render(
      'pages/alliance-detail',
      {
        title: `${allianceData.name} - Alliance`,
        description: `Alliance statistics for ${allianceData.name}`,
        keywords: 'eve online, alliance, killmail, pvp',
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
        wsFilter: {
          type: 'alliance',
          id: allianceId,
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

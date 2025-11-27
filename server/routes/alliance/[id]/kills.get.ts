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
} from '../../../models/killlist';
import { getMostValuableKillsByAlliance } from '../../../models/mostValuableKills';
import { getTopVictimsByAttacker } from '../../../models/topBoxes';
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

    // Fetch all entity data in parallel
    const [
      topCharacters,
      topCorps,
      topAlliances,
      topShips,
      topSystems,
      topRegions,
      mostValuable,
    ] = await track(
      'alliance:kills:fetch_dashboard_data',
      'application',
      async () => {
        return await Promise.all([
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
          getTopVictimsByAttacker(
            allianceId,
            'alliance',
            'week',
            'alliance',
            10
          ),
          getTopVictimsByAttacker(allianceId, 'alliance', 'week', 'ship', 10),
          getTopVictimsByAttacker(allianceId, 'alliance', 'week', 'system', 10),
          getTopVictimsByAttacker(allianceId, 'alliance', 'week', 'region', 10),
          getMostValuableKillsByAlliance(allianceId, 'week', 6),
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

    // Top 10 boxes - transform to match partial expectations
    const top10 = await track(
      'alliance:kills:transform_top10',
      'application',
      async () => {
        return {
          ships: (topShips as any[]).map((s: any) => ({
            ...s,
            imageType: 'ship',
            imageId: s.id,
            link: `/item/${s.id}`,
          })),
          characters: (topCharacters as any[]).map((c: any) => ({
            ...c,
            imageType: 'character',
            imageId: c.id,
            link: `/character/${c.id}`,
          })),
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
      'alliance:kills:transform_most_valuable',
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
      'pages/alliance-kills',
      {
        title: `${allianceData.name} - Kills`,
        description: `Kills by ${allianceData.name}`,
        keywords: 'eve online, alliance, killmail, kills, pvp',
      },
      {
        pageHeaderLight,
        ...entityData,
        top10Stats: top10,
        characterTitle: 'Most Hunted Characters',
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

/**
 * Solar System entity page - dashboard
 */
import type { H3Event } from 'h3';
import { render, normalizeKillRow } from '../../../helpers/templates';
import { getSolarSystem } from '../../../models/solarSystems';
import { getRegion } from '../../../models/regions';
import { getConstellation } from '../../../models/constellations';
import {
  getFilteredKillsWithNames,
  countFilteredKills,
} from '../../../models/killlist';
import {
  parseKilllistFilters,
  CAPSULE_TYPE_IDS,
} from '../../../helpers/killlist-filters';
import { getMostValuableKillsByPeriod } from '../../../models/mostValuableKills';
import {
  getTopCharactersFiltered,
  getTopCorporationsFiltered,
  getTopAlliancesFiltered,
} from '../../../models/topBoxes';

import { handleError } from '../../../utils/error';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const solarSystemId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!solarSystemId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid system ID',
      });
    }

    // Fetch system basic info
    const system = await getSolarSystem(solarSystemId);

    if (!system) {
      throw createError({
        statusCode: 404,
        statusMessage: 'System not found',
      });
    }

    // Fetch region and constellation info
    const [region, constellation] = await Promise.all([
      getRegion(system.regionId),
      getConstellation(system.constellationId),
    ]);

    // Get pagination parameters
    const query = getQuery(event);
    const page = Math.max(1, Number.parseInt(query.page as string) || 1);
    const {
      filters: userFilters,
      filterQueryString,
      securityStatus,
      techLevel,
      shipClass,
    } = parseKilllistFilters(query);
    const perPage = 30;

    // Fetch stats and killmails in parallel
    const [
      killmailsData,
      totalKillmails,
      mostValuable,
      topCharacters,
      topCorporations,
      topAlliances,
    ] = await Promise.all([
      getFilteredKillsWithNames(
        { solarSystemId, ...userFilters },
        page,
        perPage
      ),
      countFilteredKills({ solarSystemId, ...userFilters }),
      getMostValuableKillsByPeriod('week', 6),
      getTopCharactersFiltered({ solarSystemId }, 10),
      getTopCorporationsFiltered({ solarSystemId }, 10),
      getTopAlliancesFiltered({ solarSystemId }, 10),
    ]);

    const totalPages = Math.ceil(totalKillmails / perPage);

    // Normalize killmail data
    const killmails = killmailsData.map(normalizeKillRow);

    // Simple stats from killmail count
    const stats = {
      kills: totalKillmails,
      losses: 0,
      iskDestroyed: 0,
      iskLost: 0,
      efficiency: 0,
      iskEfficiency: 0,
      killLossRatio: 0,
    };

    // Format most valuable kills
    const mostValuableKills = mostValuable.map((km) => ({
      ...normalizeKillRow(km),
      totalValue: km.totalValue || 0,
    }));

    // Prepare top 10 stats
    const topCharactersFormatted = topCharacters.map((c) => ({
      ...c,
      imageType: 'character',
      imageId: c.id,
      link: `/character/${c.id}`,
    }));

    const topCorporationsFormatted = topCorporations.map((c) => ({
      ...c,
      imageType: 'corporation',
      imageId: c.id,
      link: `/corporation/${c.id}`,
    }));

    const topAlliancesFormatted = topAlliances.map((a) => ({
      ...a,
      imageType: 'alliance',
      imageId: a.id,
      link: `/alliance/${a.id}`,
    }));

    const data = {
      entityId: solarSystemId,
      entityType: 'system',
      name: system.name,
      type: 'system',
      stats,
      system,
      region,
      constellation,
      recentKillmails: killmails,
      mostValuableKills,
      top10Stats: {
        characters: topCharactersFormatted,
        corporations: topCorporationsFormatted,
        alliances: topAlliancesFormatted,
      },
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        perPage: perPage,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
      baseUrl: `/system/${solarSystemId}`,
      filterQueryString,
      filterDefaults: {
        ...userFilters,
        securityStatus,
        shipClass,
        techLevel,
        skipCapsules:
          userFilters.excludeTypeIds?.some((id) =>
            CAPSULE_TYPE_IDS.includes(id)
          ) || false,
      },
      currentTab: 'dashboard',
      wsFilter: {
        type: 'system',
        id: solarSystemId,
        mode: 'all',
        topic: 'all',
      },
    };

    const pageContext = {
      title: `${system.name} | System`,
      description: `Killboard statistics for solar system ${system.name}`,
      keywords: `eve online, killboard, ${system.name}, system, pvp`,
    };

    return render('pages/system.hbs', pageContext, data, event);
  } catch (error) {
    return handleError(event, error);
  }
});

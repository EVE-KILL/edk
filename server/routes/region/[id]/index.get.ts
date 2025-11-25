/**
 * Region entity page - dashboard
 */
import type { H3Event } from 'h3';
import { render, normalizeKillRow } from '../../../helpers/templates';
import { getRegion } from '../../../models/regions';
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
  getTopSystemsFiltered,
} from '../../../models/topBoxes';

import { handleError } from '../../../utils/error';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const regionId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!regionId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid region ID',
      });
    }

    // Fetch region basic info
    const region = await getRegion(regionId);

    if (!region) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Region not found',
      });
    }

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
      topSystems,
    ] = await Promise.all([
      getFilteredKillsWithNames({ regionId, ...userFilters }, page, perPage),
      countFilteredKills({ regionId, ...userFilters }),
      getMostValuableKillsByPeriod('week', 6),
      getTopCharactersFiltered({ regionId }, 10),
      getTopCorporationsFiltered({ regionId }, 10),
      getTopAlliancesFiltered({ regionId }, 10),
      getTopSystemsFiltered({ regionId }, 10),
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

    const topSystemsFormatted = topSystems.map((s) => ({
      ...s,
      link: `/system/${s.id}`,
    }));

    const data = {
      entityId: regionId,
      entityType: 'region',
      name: region.name,
      type: 'region',
      stats,
      region,
      recentKillmails: killmails,
      mostValuableKills,
      top10Stats: {
        characters: topCharactersFormatted,
        corporations: topCorporationsFormatted,
        alliances: topAlliancesFormatted,
        systems: topSystemsFormatted,
      },
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        perPage: perPage,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
      baseUrl: `/region/${regionId}`,
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
        type: 'region',
        id: regionId,
        mode: 'all',
        topic: 'all',
      },
    };

    const pageContext = {
      title: `${region.name} | Region`,
      description: `Killboard statistics for region ${region.name}`,
      keywords: `eve online, killboard, ${region.name}, region, pvp`,
    };

    return render('pages/region.hbs', pageContext, data, event);
  } catch (error) {
    return handleError(event, error);
  }
});

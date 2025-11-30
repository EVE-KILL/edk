/**
 * Region entity page - dashboard
 */
import type { H3Event } from 'h3';
import { render, normalizeKillRow } from '../../../helpers/templates';
import { renderErrorPage } from '../../../utils/error';
import { getRegion } from '../../../models/regions';
import { getConstellationsByRegion } from '../../../models/constellations';
import { getSolarSystemsByRegion } from '../../../models/solarSystems';
import { FactionQueries } from '../../../models/factions';
import {
  getFilteredKillsWithNames,
  estimateFilteredKills,
  estimateFilteredKills,
} from '../../../models/killlist';
import {
  parseKilllistFilters,
  CAPSULE_TYPE_IDS,
} from '../../../helpers/killlist-filters';
import { getMostValuableKillsByRegion } from '../../../models/mostValuableKills';
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
      return renderErrorPage(
        event,
        404,
        'Region Not Found',
        `Region #${regionId} not found in the database.`
      );
    }

    // Fetch faction, constellations, and all systems in region
    const [faction, constellations, allSystemsInRegion] = await Promise.all([
      region.factionId ? FactionQueries.getFaction(region.factionId) : null,
      getConstellationsByRegion(regionId),
      getSolarSystemsByRegion(regionId),
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
      topSystems,
    ] = await Promise.all([
      getFilteredKillsWithNames({ regionId, ...userFilters }, page, perPage),
      estimateFilteredKills({ regionId, ...userFilters }),
      getMostValuableKillsByRegion(regionId, 'week', 6),
      getTopCharactersFiltered({ regionId }, 10),
      getTopCorporationsFiltered({ regionId }, 10),
      getTopAlliancesFiltered({ regionId }, 10),
      getTopSystemsFiltered({ regionId }, 10),
    ]);

    const totalPages = Math.ceil(totalKillmails / perPage);

    // Normalize killmail data
    const killmails = killmailsData.map(normalizeKillRow);

    // Build region properties for page header pills
    const regionProperties = [];
    if (region.wormholeClassId) {
      regionProperties.push({
        type: 'pill',
        text: `C${region.wormholeClassId}`,
        class: 'page-header__pill--danger',
      });
    }
    if (faction) {
      regionProperties.push({
        type: 'pill',
        text: faction.name,
        class: 'page-header__pill--info',
      });
    }

    // Format constellations for display with average and lowest security
    const constellationsFormatted = constellations
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => {
        // Get all systems in this constellation
        const systemsInConstellation = allSystemsInRegion.filter(
          (s) => s.constellationId === c.constellationId
        );

        // Calculate average security status
        const avgSecurity =
          systemsInConstellation.length > 0
            ? systemsInConstellation.reduce(
                (sum, s) => sum + s.securityStatus,
                0
              ) / systemsInConstellation.length
            : 0;

        // Find lowest security status
        const lowestSecurity =
          systemsInConstellation.length > 0
            ? Math.min(...systemsInConstellation.map((s) => s.securityStatus))
            : 0;

        return {
          constellationId: c.constellationId,
          name: c.name,
          systemCount: c.solarSystemIds?.length || 0,
          avgSecurity: avgSecurity,
          lowestSecurity: lowestSecurity,
        };
      });

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
      regionId,
      imageUrl: faction
        ? `https://images.evetech.net/corporations/${faction.corporationId || faction.factionId}/logo?size=256`
        : 'https://images.evetech.net/alliances/1/logo?size=256',
      name: region.name,
      kills: totalKillmails,
      region,
      faction,
      regionProperties,
      // Constellations data
      constellations: constellationsFormatted,
      constellationCount: constellations.length,
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

/**
 * Constellation entity page - dashboard
 */
import type { H3Event } from 'h3';
import { render, normalizeKillRow } from '../../../helpers/templates';
import { getConstellation } from '../../../models/constellations';
import { getRegion } from '../../../models/regions';
import { getSolarSystemsByConstellation } from '../../../models/solarSystems';
import { FactionQueries } from '../../../models/factions';
import {
  getFilteredKillsWithNames,
  estimateFilteredKills,
} from '../../../models/killlist';
import {
  parseKilllistFilters,
  CAPSULE_TYPE_IDS,
} from '../../../helpers/killlist-filters';
import { getMostValuableKillsByConstellation } from '../../../models/mostValuableKills';
import {
  getTopCharactersFiltered,
  getTopCorporationsFiltered,
  getTopAlliancesFiltered,
  getTopSystemsFiltered,
} from '../../../models/topBoxes';

import { handleError } from '../../../utils/error';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const constellationId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!constellationId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid constellation ID',
      });
    }

    // Fetch constellation basic info
    const constellation = await getConstellation(constellationId);

    if (!constellation) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Constellation not found',
      });
    }

    // Fetch region, faction, and systems info
    const [region, faction, systems] = await Promise.all([
      getRegion(constellation.regionId),
      constellation.factionId
        ? FactionQueries.getFaction(constellation.factionId)
        : null,
      getSolarSystemsByConstellation(constellationId),
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
      getFilteredKillsWithNames(
        { constellationId, ...userFilters },
        page,
        perPage
      ),
      estimateFilteredKills({ constellationId, ...userFilters }),
      getMostValuableKillsByConstellation(constellationId, 'week', 6),
      getTopCharactersFiltered({ constellationId }, 10),
      getTopCorporationsFiltered({ constellationId }, 10),
      getTopAlliancesFiltered({ constellationId }, 10),
      getTopSystemsFiltered({ constellationId }, 10),
    ]);

    const totalPages = Math.ceil(totalKillmails / perPage);

    // Normalize killmail data
    const killmails = killmailsData.map(normalizeKillRow);

    // Build constellation properties for page header pills
    const constellationProperties = [];
    if (constellation.wormholeClassId) {
      constellationProperties.push({
        type: 'pill',
        text: `C${constellation.wormholeClassId}`,
        class: 'page-header__pill--danger',
      });
    }
    if (faction) {
      constellationProperties.push({
        type: 'pill',
        text: faction.name,
        class: 'page-header__pill--info',
      });
    }

    // Categorize systems by security status
    const systemsBySecurityClass = {
      highsec: systems.filter((s) => s.securityStatus >= 0.45),
      lowsec: systems.filter(
        (s) => s.securityStatus > 0 && s.securityStatus < 0.45
      ),
      nullsec: systems.filter((s) => s.securityStatus <= 0),
    };

    // Format systems for display
    const systemsFormatted = systems
      .sort((a, b) => b.securityStatus - a.securityStatus)
      .map((s) => ({
        solarSystemId: s.solarSystemId,
        name: s.name,
        securityStatus: s.securityStatus,
        securityClass: s.securityClass,
        isHub: s.hub === 1,
        isBorder: s.border === 1,
        isRegional: s.regional === 1,
      }));

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
      constellationId,
      imageUrl: faction
        ? `https://images.evetech.net/corporations/${faction.corporationId || faction.factionId}/logo?size=256`
        : 'https://images.evetech.net/alliances/1/logo?size=256',
      name: constellation.name,
      kills: totalKillmails,
      constellation,
      region,
      faction,
      constellationProperties,
      // Systems data
      systems: systemsFormatted,
      systemCounts: {
        total: systems.length,
        highsec: systemsBySecurityClass.highsec.length,
        lowsec: systemsBySecurityClass.lowsec.length,
        nullsec: systemsBySecurityClass.nullsec.length,
      },
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
      baseUrl: `/constellation/${constellationId}`,
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
        type: 'constellation',
        id: constellationId,
        mode: 'all',
        topic: 'all',
      },
    };

    const pageContext = {
      title: `${constellation.name} | Constellation`,
      description: `Killboard statistics for constellation ${constellation.name}`,
      keywords: `eve online, killboard, ${constellation.name}, constellation, pvp`,
    };

    return render('pages/constellation.hbs', pageContext, data, event);
  } catch (error) {
    return handleError(event, error);
  }
});

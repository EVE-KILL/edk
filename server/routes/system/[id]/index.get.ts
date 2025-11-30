/**
 * Solar System entity page - dashboard
 */
import type { H3Event } from 'h3';
import { render, normalizeKillRow } from '../../../helpers/templates';
import { renderErrorPage } from '../../../utils/error';
import { getSolarSystem } from '../../../models/solarSystems';
import { getRegion } from '../../../models/regions';
import { getConstellation } from '../../../models/constellations';
import { getPlanetsBySystem } from '../../../models/planets';
import { getMoonsBySystem } from '../../../models/moons';
import { getStargatesBySystem } from '../../../models/stargates';
import { getStarBySystem } from '../../../models/stars';
import { getAsteroidBeltsBySystem } from '../../../models/asteroidBelts';
import {
  getFilteredKillsWithNames,
  estimateFilteredKills,
} from '../../../models/killlist';
import {
  parseKilllistFilters,
  CAPSULE_TYPE_IDS,
} from '../../../helpers/killlist-filters';
import { getMostValuableKillsBySystem } from '../../../models/mostValuableKills';
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
      return renderErrorPage(
        event,
        404,
        'Solar System Not Found',
        `Solar system #${systemId} not found in the database.`
      );
    }

    // Fetch celestial data
    const [
      region,
      constellation,
      planets,
      moons,
      stargates,
      star,
      asteroidBelts,
    ] = await Promise.all([
      getRegion(system.regionId),
      getConstellation(system.constellationId),
      getPlanetsBySystem(solarSystemId),
      getMoonsBySystem(solarSystemId),
      getStargatesBySystem(solarSystemId),
      getStarBySystem(solarSystemId),
      getAsteroidBeltsBySystem(solarSystemId),
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
      estimateFilteredKills({ solarSystemId, ...userFilters }),
      getMostValuableKillsBySystem(solarSystemId, 'week', 6),
      getTopCharactersFiltered({ solarSystemId }, 10),
      getTopCorporationsFiltered({ solarSystemId }, 10),
      getTopAlliancesFiltered({ solarSystemId }, 10),
    ]);

    const totalPages = Math.ceil(totalKillmails / perPage);

    // Normalize killmail data
    const killmails = killmailsData.map(normalizeKillRow);

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

    // Get planet type names
    const planetTypeIds = [...new Set(planets.map((p) => p.typeId))];
    const planetTypesData = await database.find<{
      typeId: number;
      name: string;
    }>(`SELECT "typeId", "name" FROM types WHERE "typeId" = ANY(:typeIds)`, {
      typeIds: planetTypeIds,
    });
    const planetTypeMap = new Map(
      planetTypesData.map((t) => [t.typeId, t.name])
    );

    // Organize moons by planet (even though planetId might be null)
    const moonsByPlanet = new Map<number, typeof moons>();
    for (const moon of moons) {
      if (moon.planetId) {
        if (!moonsByPlanet.has(moon.planetId)) {
          moonsByPlanet.set(moon.planetId, []);
        }
        moonsByPlanet.get(moon.planetId)!.push(moon);
      }
    }

    // Build celestial hierarchy for display
    const celestials = planets
      .sort((a, b) => (a.celestialIndex || 0) - (b.celestialIndex || 0))
      .map((planet) => ({
        planetId: planet.planetId,
        name: planet.name || `Planet ${planet.celestialIndex}`,
        typeId: planet.typeId,
        typeName: planetTypeMap.get(planet.typeId) || 'Unknown',
        celestialIndex: planet.celestialIndex,
        moonCount: moonsByPlanet.get(planet.planetId)?.length || 0,
      }));

    // Get stargate destinations
    const stargateConnections = await Promise.all(
      stargates.map(async (stargate) => {
        const destinationSystem = stargate.destinationSolarSystemId
          ? await getSolarSystem(stargate.destinationSolarSystemId)
          : null;

        return {
          stargateId: stargate.stargateId,
          name: stargate.name || 'Stargate',
          destinationSystem: destinationSystem
            ? {
                solarSystemId: destinationSystem.solarSystemId,
                name: destinationSystem.name,
                securityStatus: destinationSystem.securityStatus,
              }
            : null,
        };
      })
    );

    // Build system properties for page header pills
    const systemProperties = [];
    if (system.hub)
      systemProperties.push({
        type: 'pill',
        text: 'Hub',
        class: 'page-header__pill--info',
      });
    if (system.border)
      systemProperties.push({
        type: 'pill',
        text: 'Border',
        class: 'page-header__pill--warning',
      });
    if (system.regional)
      systemProperties.push({
        type: 'pill',
        text: 'Regional',
        class: 'page-header__pill--success',
      });
    if (system.corridor)
      systemProperties.push({
        type: 'pill',
        text: 'Corridor',
        class: 'page-header__pill--secondary',
      });
    if (system.fringe)
      systemProperties.push({
        type: 'pill',
        text: 'Fringe',
        class: 'page-header__pill--secondary',
      });

    const data = {
      solarSystemId,
      imageUrl: `https://images.evetech.net/types/${star?.typeId || 3802}/render?size=256`,
      name: system.name,
      kills: totalKillmails,
      system,
      region,
      constellation,
      systemProperties,
      // Celestial data
      star,
      celestials,
      stargates: stargateConnections,
      asteroidBelts,
      celestialCounts: {
        planets: planets.length,
        moons: moons.length,
        stargates: stargates.length,
        asteroidBelts: asteroidBelts.length,
      },
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

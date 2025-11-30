/**
 * API endpoint for system data
 * Returns comprehensive system information including celestials
 */
import type { H3Event } from 'h3';
import { getSolarSystem } from '../../../models/solarSystems';
import { getRegion } from '../../../models/regions';
import { getConstellation } from '../../../models/constellations';
import { getPlanetsBySystem } from '../../../models/planets';
import { getMoonsBySystem } from '../../../models/moons';
import { getStargatesBySystem } from '../../../models/stargates';
import { getStarBySystem } from '../../../models/stars';
import { getAsteroidBeltsBySystem } from '../../../models/asteroidBelts';

export default defineCachedEventHandler(
  async (event: H3Event) => {
    const id = getRouterParam(event, 'id');
    const solarSystemId = Number.parseInt(id || '0');

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

    // Fetch all related data in parallel
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

    // Get type information for planets to show planet types
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

    // Organize moons by planet
    const moonsByPlanet = new Map<number, typeof moons>();
    for (const moon of moons) {
      if (!moonsByPlanet.has(moon.planetId)) {
        moonsByPlanet.set(moon.planetId, []);
      }
      moonsByPlanet.get(moon.planetId)!.push(moon);
    }

    // Build celestial hierarchy
    const celestials = planets
      .sort((a, b) => (a.celestialIndex || 0) - (b.celestialIndex || 0))
      .map((planet) => ({
        planetId: planet.planetId,
        name: planet.name,
        typeId: planet.typeId,
        typeName: planetTypeMap.get(planet.typeId) || 'Unknown',
        celestialIndex: planet.celestialIndex,
        position: {
          x: planet.positionX,
          y: planet.positionY,
          z: planet.positionZ,
        },
        moons: (moonsByPlanet.get(planet.planetId) || [])
          .sort((a, b) => (a.celestialIndex || 0) - (b.celestialIndex || 0))
          .map((moon) => ({
            moonId: moon.moonId,
            name: moon.name,
            typeId: moon.typeId,
            celestialIndex: moon.celestialIndex,
            position: {
              x: moon.positionX,
              y: moon.positionY,
              z: moon.positionZ,
            },
          })),
      }));

    // Get stargate destinations
    const stargateConnections = await Promise.all(
      stargates.map(async (stargate) => {
        const destinationSystem = stargate.destinationSolarSystemId
          ? await getSolarSystem(stargate.destinationSolarSystemId)
          : null;

        return {
          stargateId: stargate.stargateId,
          name: stargate.name,
          position: {
            x: stargate.positionX,
            y: stargate.positionY,
            z: stargate.positionZ,
          },
          destination: destinationSystem
            ? {
                systemId: destinationSystem.solarSystemId,
                systemName: destinationSystem.name,
                securityStatus: destinationSystem.securityStatus,
                regionId: destinationSystem.regionId,
              }
            : null,
        };
      })
    );

    return {
      system: {
        solarSystemId: system.solarSystemId,
        name: system.name,
        securityStatus: system.securityStatus,
        securityClass: system.securityClass,
        constellationId: system.constellationId,
        regionId: system.regionId,
        position: {
          x: system.positionX,
          y: system.positionY,
          z: system.positionZ,
        },
        radius: system.radius,
        luminosity: system.luminosity,
        border: system.border,
        corridor: system.corridor,
        fringe: system.fringe,
        hub: system.hub,
        international: system.international,
        regional: system.regional,
        factionId: system.factionId,
        wormholeClassId: system.wormholeClassId,
        visualEffect: system.visualEffect,
      },
      region: region
        ? {
            regionId: region.regionId,
            name: region.name,
            factionId: region.factionId,
          }
        : null,
      constellation: constellation
        ? {
            constellationId: constellation.constellationId,
            name: constellation.name,
            regionId: constellation.regionId,
            factionId: constellation.factionId,
          }
        : null,
      star: star
        ? {
            starId: star.starId,
            name: star.name,
            typeId: star.typeId,
            spectralClass: star.spectralClass,
            age: star.age,
            luminosity: star.luminosity,
            radius: star.radius,
            temperature: star.temperature,
          }
        : null,
      celestials,
      stargates: stargateConnections,
      asteroidBelts: asteroidBelts
        .sort((a, b) => (a.celestialIndex || 0) - (b.celestialIndex || 0))
        .map((belt) => ({
          asteroidBeltId: belt.asteroidBeltId,
          name: belt.name,
          typeId: belt.typeId,
          celestialIndex: belt.celestialIndex,
          position: {
            x: belt.positionX,
            y: belt.positionY,
            z: belt.positionZ,
          },
        })),
      summary: {
        planetCount: planets.length,
        moonCount: moons.length,
        stargateCount: stargates.length,
        asteroidBeltCount: asteroidBelts.length,
      },
    };
  },
  {
    maxAge: 3600, // Cache for 1 hour (this is static SDE data)
    swr: true,
    base: 'redis',
    getKey: (event: H3Event) => {
      const id = getRouterParam(event, 'id');
      return `system:${id}:data`;
    },
  }
);

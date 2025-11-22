import { TableConfig } from './types';
import { extractLanguageField } from './parser';

/**
 * SDE Table Configurations
 * Defines field mappings for all SDE tables
 */

// Map Tables
export const mapStargatesConfig: TableConfig = {
  name: 'stargates',
  sourceName: 'mapStargates',
  primaryKey: 'stargateId',
  mappings: [
    { source: '_key', target: 'stargateId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'position.x', target: 'positionX', type: 'number' },
    { source: 'position.y', target: 'positionY', type: 'number' },
    { source: 'position.z', target: 'positionZ', type: 'number' },
    { source: 'solarSystemId', target: 'solarSystemId', type: 'number' },
    {
      source: 'destination.stargateId',
      target: 'destinationGateId',
      type: 'number',
    },
    {
      source: 'destination.solarSystemId',
      target: 'destinationSolarSystemId',
      type: 'number',
    },
    { source: 'typeId', target: 'typeId', type: 'number' },
  ],
};

export const mapStarsConfig: TableConfig = {
  name: 'stars',
  sourceName: 'mapStars',
  primaryKey: 'starId',
  mappings: [
    { source: '_key', target: 'starId', type: 'number', required: true },
    { source: 'age', target: 'age', type: 'number' },
    { source: 'luminosity', target: 'luminosity', type: 'number' },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'radius', target: 'radius', type: 'number' },
    { source: 'solarSystemId', target: 'solarSystemId', type: 'number' },
    { source: 'spectralClass', target: 'spectralClass', type: 'string' },
    { source: 'temperature', target: 'temperature', type: 'number' },
    { source: 'typeId', target: 'typeId', type: 'number' },
  ],
};

export const mapPlanetsConfig: TableConfig = {
  name: 'planets',
  sourceName: 'mapPlanets',
  primaryKey: 'planetId',
  mappings: [
    { source: '_key', target: 'planetId', type: 'number', required: true },
    { source: 'celestialIndex', target: 'celestialIndex', type: 'number' },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'position.x', target: 'positionX', type: 'number' },
    { source: 'position.y', target: 'positionY', type: 'number' },
    { source: 'position.z', target: 'positionZ', type: 'number' },
    { source: 'solarSystemId', target: 'solarSystemId', type: 'number' },
    { source: 'typeId', target: 'typeId', type: 'number' },
  ],
};

export const mapMoonsConfig: TableConfig = {
  name: 'moons',
  sourceName: 'mapMoons',
  primaryKey: 'moonId',
  mappings: [
    { source: '_key', target: 'moonId', type: 'number', required: true },
    { source: 'celestialIndex', target: 'celestialIndex', type: 'number' },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'planetId', target: 'planetId', type: 'number' },
    { source: 'position.x', target: 'positionX', type: 'number' },
    { source: 'position.y', target: 'positionY', type: 'number' },
    { source: 'position.z', target: 'positionZ', type: 'number' },
    { source: 'solarSystemId', target: 'solarSystemId', type: 'number' },
    { source: 'typeId', target: 'typeId', type: 'number' },
  ],
};

export const mapSolarSystemsConfig: TableConfig = {
  name: 'solarsystems',
  sourceName: 'mapSolarSystems',
  primaryKey: 'solarSystemId',
  mappings: [
    { source: '_key', target: 'solarSystemId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'constellationID', target: 'constellationId', type: 'number' },
    { source: 'regionID', target: 'regionId', type: 'number' },
    { source: 'border', target: 'border', type: 'boolean' },
    { source: 'corridor', target: 'corridor', type: 'boolean' },
    { source: 'factionId', target: 'factionId', type: 'number' },
    { source: 'fringe', target: 'fringe', type: 'boolean' },
    { source: 'hub', target: 'hub', type: 'boolean' },
    { source: 'international', target: 'international', type: 'boolean' },
    { source: 'luminosity', target: 'luminosity', type: 'number' },
    { source: 'planetIds', target: 'planetIds', type: 'array' },
    { source: 'position.x', target: 'positionX', type: 'number' },
    { source: 'position.y', target: 'positionY', type: 'number' },
    { source: 'position.z', target: 'positionZ', type: 'number' },
    { source: 'radius', target: 'radius', type: 'number' },
    { source: 'regional', target: 'regional', type: 'boolean' },
    { source: 'securityClass', target: 'securityClass', type: 'string' },
    { source: 'securityStatus', target: 'securityStatus', type: 'number' },
    { source: 'stargateIds', target: 'stargateIds', type: 'array' },
    { source: 'starId', target: 'starId', type: 'number' },
    { source: 'visualEffect', target: 'visualEffect', type: 'string' },
    { source: 'wormholeClassId', target: 'wormholeClassId', type: 'number' },
  ],
};

export const mapAsteroidBeltsConfig: TableConfig = {
  name: 'asteroidBelts',
  sourceName: 'mapAsteroidBelts',
  primaryKey: 'asteroidBeltId',
  mappings: [
    {
      source: '_key',
      target: 'asteroidBeltId',
      type: 'number',
      required: true,
    },
    { source: 'celestialIndex', target: 'celestialIndex', type: 'number' },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'position.x', target: 'positionX', type: 'number' },
    { source: 'position.y', target: 'positionY', type: 'number' },
    { source: 'position.z', target: 'positionZ', type: 'number' },
    { source: 'solarSystemId', target: 'solarSystemId', type: 'number' },
    { source: 'typeId', target: 'typeId', type: 'number' },
  ],
};

// Item/Type Tables
export const typesConfig: TableConfig = {
  name: 'types',
  primaryKey: 'typeId',
  mappings: [
    { source: '_key', target: 'typeId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    {
      source: 'description',
      target: 'description',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'capacity', target: 'capacity', type: 'number' },
    { source: 'factionID', target: 'factionId', type: 'number' },
    { source: 'graphicID', target: 'graphicId', type: 'number' },
    { source: 'groupID', target: 'groupId', type: 'number', required: true },
    { source: 'iconID', target: 'iconId', type: 'number' },
    { source: 'marketGroupID', target: 'marketGroupId', type: 'number' },
    { source: 'mass', target: 'mass', type: 'number' },
    { source: 'metaGroupID', target: 'metaGroupId', type: 'number' },
    { source: 'portionSize', target: 'portionSize', type: 'number' },
    { source: 'published', target: 'published', type: 'boolean' },
    { source: 'raceID', target: 'raceId', type: 'number' },
    { source: 'radius', target: 'radius', type: 'number' },
    { source: 'soundID', target: 'soundId', type: 'number' },
    { source: 'volume', target: 'volume', type: 'number' },
  ],
};

export const groupsConfig: TableConfig = {
  name: 'groups',
  primaryKey: 'groupId',
  mappings: [
    { source: '_key', target: 'groupId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    {
      source: 'categoryId',
      target: 'categoryId',
      type: 'number',
      required: true,
    },
    { source: 'iconId', target: 'iconId', type: 'number' },
    { source: 'published', target: 'published', type: 'boolean' },
  ],
};

export const categoriesConfig: TableConfig = {
  name: 'categories',
  primaryKey: 'categoryId',
  mappings: [
    { source: '_key', target: 'categoryId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'iconId', target: 'iconId', type: 'number' },
    { source: 'published', target: 'published', type: 'boolean' },
  ],
};

// NPC Tables
export const npcCorporationsConfig: TableConfig = {
  name: 'npcCorporations',
  primaryKey: 'corporationId',
  mappings: [
    { source: '_key', target: 'corporationId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    {
      source: 'description',
      target: 'description',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'ceoId', target: 'ceoId', type: 'number' },
    { source: 'factionId', target: 'factionId', type: 'number' },
    { source: 'solarSystemId', target: 'solarSystemId', type: 'number' },
    { source: 'stationId', target: 'stationId', type: 'number' },
    { source: 'taxRate', target: 'taxRate', type: 'number' },
    { source: 'tickerName', target: 'tickerName', type: 'string' },
    { source: 'deleted', target: 'deleted', type: 'boolean' },
  ],
};

export const npcStationsConfig: TableConfig = {
  name: 'npcStations',
  primaryKey: 'stationId',
  mappings: [
    { source: '_key', target: 'stationId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'solarSystemId', target: 'solarSystemId', type: 'number' },
    { source: 'typeId', target: 'typeId', type: 'number' },
    { source: 'ownerIds', target: 'ownerIds', type: 'array' },
    { source: 'celestialIndex', target: 'celestialIndex', type: 'number' },
    { source: 'operationId', target: 'operationId', type: 'number' },
    { source: 'orbitId', target: 'orbitId', type: 'number' },
    { source: 'orbitIndex', target: 'orbitIndex', type: 'number' },
    { source: 'position.x', target: 'positionX', type: 'number' },
    { source: 'position.y', target: 'positionY', type: 'number' },
    { source: 'position.z', target: 'positionZ', type: 'number' },
    {
      source: 'reprocessingEfficiency',
      target: 'reprocessingEfficiency',
      type: 'number',
    },
    {
      source: 'reprocessingStationsTake',
      target: 'reprocessingStationsTake',
      type: 'number',
    },
    { source: 'useOperationName', target: 'useOperationName', type: 'boolean' },
  ],
};

export const stationOperationsConfig: TableConfig = {
  name: 'stationOperations',
  primaryKey: 'operationId',
  mappings: [
    { source: '_key', target: 'operationId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    {
      source: 'description',
      target: 'description',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'activityId', target: 'activityId', type: 'number' },
    { source: 'border', target: 'border', type: 'number' },
    { source: 'corridor', target: 'corridor', type: 'number' },
    { source: 'fringe', target: 'fringe', type: 'number' },
    { source: 'hub', target: 'hub', type: 'number' },
    {
      source: 'manufacturingFactor',
      target: 'manufacturingFactor',
      type: 'number',
    },
    { source: 'ratio', target: 'ratio', type: 'number' },
    { source: 'researchFactor', target: 'researchFactor', type: 'number' },
    { source: 'stationType', target: 'stationType', type: 'string' },
  ],
};

export const npcCharactersConfig: TableConfig = {
  name: 'npcCharacters',
  primaryKey: 'characterId',
  mappings: [
    { source: '_key', target: 'characterId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'corporationId', target: 'corporationId', type: 'number' },
    { source: 'allianceId', target: 'allianceId', type: 'number' },
    { source: 'bloodlineId', target: 'bloodlineId', type: 'number' },
    { source: 'ancestryId', target: 'ancestryId', type: 'number' },
    { source: 'gender', target: 'gender', type: 'number' },
    { source: 'raceId', target: 'raceId', type: 'number' },
  ],
};

// Character Attributes
export const factionsConfig: TableConfig = {
  name: 'factions',
  primaryKey: 'factionId',
  mappings: [
    { source: '_key', target: 'factionId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    {
      source: 'description',
      target: 'description',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    {
      source: 'shortDescription',
      target: 'shortDescription',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'corporationId', target: 'corporationId', type: 'number' },
    {
      source: 'militiaCorporationId',
      target: 'militiaCorporationId',
      type: 'number',
    },
    { source: 'solarSystemId', target: 'solarSystemId', type: 'number' },
  ],
};

export const racesConfig: TableConfig = {
  name: 'races',
  primaryKey: 'raceId',
  mappings: [
    { source: '_key', target: 'raceId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    {
      source: 'description',
      target: 'description',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'iconId', target: 'iconId', type: 'number' },
  ],
};

export const bloodlinesConfig: TableConfig = {
  name: 'bloodlines',
  primaryKey: 'bloodlineId',
  mappings: [
    { source: '_key', target: 'bloodlineId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    {
      source: 'description',
      target: 'description',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'raceId', target: 'raceId', type: 'number', required: true },
    { source: 'shipTypeId', target: 'shipTypeId', type: 'number' },
    { source: 'corporationId', target: 'corporationId', type: 'number' },
    { source: 'attributes.charisma', target: 'charisma', type: 'number' },
    {
      source: 'attributes.constitution',
      target: 'constitution',
      type: 'number',
    },
    {
      source: 'attributes.intelligence',
      target: 'intelligence',
      type: 'number',
    },
    { source: 'attributes.memory', target: 'memory', type: 'number' },
    { source: 'attributes.perception', target: 'perception', type: 'number' },
    { source: 'attributes.willpower', target: 'willpower', type: 'number' },
  ],
};

export const ancestriesConfig: TableConfig = {
  name: 'ancestries',
  primaryKey: 'ancestryId',
  mappings: [
    { source: '_key', target: 'ancestryId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    {
      source: 'bloodlineId',
      target: 'bloodlineId',
      type: 'number',
      required: true,
    },
    {
      source: 'description',
      target: 'description',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'iconId', target: 'iconId', type: 'number' },
    { source: 'shortDescription', target: 'shortDescription', type: 'string' },
  ],
};

// Market/Meta Tables
export const marketGroupsConfig: TableConfig = {
  name: 'marketGroups',
  primaryKey: 'marketGroupId',
  mappings: [
    { source: '_key', target: 'marketGroupId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    {
      source: 'description',
      target: 'description',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'iconId', target: 'iconId', type: 'number' },
    { source: 'hasTypes', target: 'hasTypes', type: 'boolean' },
    { source: 'parentGroupId', target: 'parentGroupId', type: 'number' },
  ],
};

export const metaGroupsConfig: TableConfig = {
  name: 'metaGroups',
  primaryKey: 'metaGroupId',
  mappings: [
    { source: '_key', target: 'metaGroupId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    {
      source: 'description',
      target: 'description',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'iconId', target: 'iconId', type: 'number' },
  ],
};

export const skinsConfig: TableConfig = {
  name: 'skins',
  primaryKey: 'skinId',
  mappings: [
    { source: '_key', target: 'skinId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'description', target: 'description', type: 'string' },
    { source: 'iconId', target: 'iconId', type: 'number' },
    { source: 'internalName', target: 'internalName', type: 'string' },
  ],
};

// Dogma Tables
export const dogmaAttributesConfig: TableConfig = {
  name: 'dogmaAttributes',
  primaryKey: 'attributeId',
  mappings: [
    { source: '_key', target: 'attributeId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'categoryId', target: 'categoryId', type: 'number' },
    { source: 'defaultValue', target: 'defaultValue', type: 'number' },
    { source: 'description', target: 'description', type: 'string' },
    {
      source: 'displayName',
      target: 'displayName',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'iconId', target: 'iconId', type: 'number' },
    { source: 'highIsGood', target: 'highIsGood', type: 'boolean' },
    { source: 'published', target: 'published', type: 'boolean' },
    { source: 'stackable', target: 'stackable', type: 'boolean' },
    {
      source: 'tooltipDescription',
      target: 'tooltipDescription',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    {
      source: 'tooltipTitle',
      target: 'tooltipTitle',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'unitId', target: 'unitId', type: 'number' },
  ],
};

export const dogmaEffectsConfig: TableConfig = {
  name: 'dogmaEffects',
  primaryKey: 'effectId',
  mappings: [
    { source: '_key', target: 'effectId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'categoryId', target: 'categoryId', type: 'number' },
    {
      source: 'description',
      target: 'description',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    {
      source: 'disallowAutoRepeat',
      target: 'disallowAutoRepeat',
      type: 'boolean',
    },
    {
      source: 'dischargeAttributeId',
      target: 'dischargeAttributeId',
      type: 'number',
    },
    {
      source: 'displayName',
      target: 'displayName',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    {
      source: 'durationAttributeId',
      target: 'durationAttributeId',
      type: 'number',
    },
    { source: 'effectCategory', target: 'effectCategory', type: 'string' },
    {
      source: 'falloffAttributeId',
      target: 'falloffAttributeId',
      type: 'number',
    },
    {
      source: 'fittingUsageChanceAttributeId',
      target: 'fittingUsageChanceAttributeId',
      type: 'number',
    },
    { source: 'iconId', target: 'iconId', type: 'number' },
    { source: 'isAssistance', target: 'isAssistance', type: 'boolean' },
    { source: 'isOffensive', target: 'isOffensive', type: 'boolean' },
    { source: 'isWarpSafe', target: 'isWarpSafe', type: 'boolean' },
    { source: 'neurotoxinId', target: 'neurotoxinId', type: 'number' },
    {
      source: 'npcActivationChanceAttributeId',
      target: 'npcActivationChanceAttributeId',
      type: 'number',
    },
    {
      source: 'npcUsageChanceAttributeId',
      target: 'npcUsageChanceAttributeId',
      type: 'number',
    },
    { source: 'published', target: 'published', type: 'boolean' },
    { source: 'rangeAttributeId', target: 'rangeAttributeId', type: 'number' },
    {
      source: 'resistanceAttributeId',
      target: 'resistanceAttributeId',
      type: 'number',
    },
    {
      source: 'softPenetrationAttributeId',
      target: 'softPenetrationAttributeId',
      type: 'number',
    },
    {
      source: 'trackingSpeedAttributeId',
      target: 'trackingSpeedAttributeId',
      type: 'number',
    },
  ],
};

// Additional SDE Tables with language fields
export const npcCorporationDivisionsConfig: TableConfig = {
  name: 'npcCorporationDivisions',
  primaryKey: 'divisionId',
  mappings: [
    { source: '_key', target: 'divisionId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    {
      source: 'description',
      target: 'description',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    {
      source: 'leaderTypeName',
      target: 'leaderTypeName',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'displayName', target: 'displayName', type: 'string' },
    { source: 'internalName', target: 'internalName', type: 'string' },
  ],
};

export const landmarksConfig: TableConfig = {
  name: 'landmarks',
  primaryKey: 'landmarkId',
  mappings: [
    { source: '_key', target: 'landmarkId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    {
      source: 'description',
      target: 'description',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'iconId', target: 'iconId', type: 'number' },
    { source: 'position.x', target: 'positionX', type: 'number' },
    { source: 'position.y', target: 'positionY', type: 'number' },
    { source: 'position.z', target: 'positionZ', type: 'number' },
  ],
};

export const mapRegionsConfig: TableConfig = {
  name: 'regions',
  sourceName: 'mapRegions',
  primaryKey: 'regionId',
  mappings: [
    { source: '_key', target: 'regionId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'constellationIDs', target: 'constellationIds', type: 'array' },
    {
      source: 'description',
      target: 'description',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'factionID', target: 'factionId', type: 'number' },
    { source: 'nebulaID', target: 'nebulaId', type: 'number' },
    { source: 'position.x', target: 'positionX', type: 'number' },
    { source: 'position.y', target: 'positionY', type: 'number' },
    { source: 'position.z', target: 'positionZ', type: 'number' },
    { source: 'wormholeClassID', target: 'wormholeClassId', type: 'number' },
  ],
};

export const mapConstellationsConfig: TableConfig = {
  name: 'constellations',
  sourceName: 'mapConstellations',
  primaryKey: 'constellationId',
  mappings: [
    { source: '_key', target: 'constellationId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'regionID', target: 'regionId', type: 'number' },
    { source: 'factionID', target: 'factionId', type: 'number' },
    { source: 'position.x', target: 'positionX', type: 'number' },
    { source: 'position.y', target: 'positionY', type: 'number' },
    { source: 'position.z', target: 'positionZ', type: 'number' },
    { source: 'solarSystemIDs', target: 'solarSystemIds', type: 'array' },
    { source: 'wormholeClassID', target: 'wormholeClassId', type: 'number' },
  ],
};

export const certificatesConfig: TableConfig = {
  name: 'certificates',
  primaryKey: 'certificateId',
  mappings: [
    { source: '_key', target: 'certificateId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    {
      source: 'description',
      target: 'description',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'categoryId', target: 'categoryId', type: 'number' },
    { source: 'classId', target: 'classId', type: 'number' },
    { source: 'groupId', target: 'groupId', type: 'number' },
    { source: 'iconId', target: 'iconId', type: 'number' },
  ],
};

export const skinMaterialsConfig: TableConfig = {
  name: 'skinMaterials',
  primaryKey: 'skinMaterialId',
  mappings: [
    {
      source: '_key',
      target: 'skinMaterialId',
      type: 'number',
      required: true,
    },
    {
      source: 'displayName',
      target: 'displayName',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'materialSetId', target: 'materialSetId', type: 'number' },
  ],
};



export const planetSchematicsConfig: TableConfig = {
  name: 'planetSchematics',
  primaryKey: 'schematicId',
  mappings: [
    { source: '_key', target: 'schematicId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'cycleTime', target: 'cycleTime', type: 'number' },
  ],
};

export const stationServicesConfig: TableConfig = {
  name: 'stationServices',
  primaryKey: 'serviceId',
  mappings: [
    { source: '_key', target: 'serviceId', type: 'number', required: true },
    {
      source: 'serviceName',
      target: 'serviceName',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'chargePerUnit', target: 'chargePerUnit', type: 'number' },
  ],
};

export const dogmaUnitsConfig: TableConfig = {
  name: 'dogmaUnits',
  primaryKey: 'unitId',
  mappings: [
    { source: '_key', target: 'unitId', type: 'number', required: true },
    {
      source: 'displayName',
      target: 'displayName',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    {
      source: 'description',
      target: 'description',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
  ],
};

export const characterAttributesConfig: TableConfig = {
  name: 'characterAttributes',
  primaryKey: 'attributeId',
  mappings: [
    { source: '_key', target: 'attributeId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'shortDescription', target: 'shortDescription', type: 'string' },
    { source: 'description', target: 'description', type: 'string' },
    { source: 'notes', target: 'notes', type: 'string' },
    { source: 'iconId', target: 'iconId', type: 'number' },
  ],
};

export const corporationActivitiesConfig: TableConfig = {
  name: 'corporationActivities',
  primaryKey: 'activityId',
  mappings: [
    { source: '_key', target: 'activityId', type: 'number', required: true },
    {
      source: 'name',
      target: 'name',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
  ],
};

export const dbuffCollectionsConfig: TableConfig = {
  name: 'dbuffCollections',
  primaryKey: 'collectionId',
  mappings: [
    { source: '_key', target: 'collectionId', type: 'number', required: true },
    {
      source: 'displayName',
      target: 'displayName',
      type: 'string',
      transform: (v) => extractLanguageField(v, 'en'),
    },
    { source: 'aggregateMode', target: 'aggregateMode', type: 'string' },
    {
      source: 'developerDescription',
      target: 'developerDescription',
      type: 'string',
    },
    { source: 'operationName', target: 'operationName', type: 'string' },
  ],
};

/**
 * All table configurations
 */
export const ALL_TABLE_CONFIGS = [
  // Map tables
  mapRegionsConfig,
  mapConstellationsConfig,
  mapSolarSystemsConfig,
  mapStargatesConfig,
  mapStarsConfig,
  mapPlanetsConfig,
  mapMoonsConfig,
  mapAsteroidBeltsConfig,
  // Item/Type tables
  typesConfig,
  groupsConfig,
  categoriesConfig,
  // NPC tables
  npcCorporationsConfig,
  npcCorporationDivisionsConfig,
  npcStationsConfig,
  stationOperationsConfig,
  stationServicesConfig,
  npcCharactersConfig,
  // Character attributes
  factionsConfig,
  racesConfig,
  bloodlinesConfig,
  ancestriesConfig,
  characterAttributesConfig,
  // Market/Meta
  marketGroupsConfig,
  metaGroupsConfig,
  skinsConfig,
  skinMaterialsConfig,
  // Dogma tables
  dogmaAttributesConfig,
  dogmaEffectsConfig,
  dogmaUnitsConfig,
  // Other tables
  certificatesConfig,
  planetSchematicsConfig,
  landmarksConfig,
  dbuffCollectionsConfig,
  corporationActivitiesConfig,
];

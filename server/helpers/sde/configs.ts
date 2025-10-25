import { TableConfig } from './types'

/**
 * SDE Table Configurations
 * Defines field mappings for all SDE tables
 */

// Map Tables
export const mapStargatesConfig: TableConfig = {
  name: 'mapStargates',
  mappings: [
    { source: '_key', target: 'stargateId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'position.x', target: 'positionX', type: 'number' },
    { source: 'position.y', target: 'positionY', type: 'number' },
    { source: 'position.z', target: 'positionZ', type: 'number' },
    { source: 'solarSystemId', target: 'solarSystemId', type: 'number' },
    { source: 'destination.stargateId', target: 'destinationGateId', type: 'number' },
    { source: 'destination.solarSystemId', target: 'destinationSolarSystemId', type: 'number' },
    { source: 'typeId', target: 'typeId', type: 'number' }
  ]
}

export const mapStarsConfig: TableConfig = {
  name: 'mapStars',
  mappings: [
    { source: '_key', target: 'starId', type: 'number', required: true },
    { source: 'age', target: 'age', type: 'number' },
    { source: 'luminosity', target: 'luminosity', type: 'number' },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'radius', target: 'radius', type: 'number' },
    { source: 'solarSystemId', target: 'solarSystemId', type: 'number' },
    { source: 'spectralClass', target: 'spectralClass', type: 'string' },
    { source: 'temperature', target: 'temperature', type: 'number' },
    { source: 'typeId', target: 'typeId', type: 'number' }
  ]
}

export const mapPlanetsConfig: TableConfig = {
  name: 'mapPlanets',
  mappings: [
    { source: '_key', target: 'planetId', type: 'number', required: true },
    { source: 'celestialIndex', target: 'celestialIndex', type: 'number' },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'position.x', target: 'positionX', type: 'number' },
    { source: 'position.y', target: 'positionY', type: 'number' },
    { source: 'position.z', target: 'positionZ', type: 'number' },
    { source: 'solarSystemId', target: 'solarSystemId', type: 'number' },
    { source: 'typeId', target: 'typeId', type: 'number' }
  ]
}

export const mapMoonsConfig: TableConfig = {
  name: 'mapMoons',
  mappings: [
    { source: '_key', target: 'moonId', type: 'number', required: true },
    { source: 'celestialIndex', target: 'celestialIndex', type: 'number' },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'planetId', target: 'planetId', type: 'number' },
    { source: 'position.x', target: 'positionX', type: 'number' },
    { source: 'position.y', target: 'positionY', type: 'number' },
    { source: 'position.z', target: 'positionZ', type: 'number' },
    { source: 'solarSystemId', target: 'solarSystemId', type: 'number' },
    { source: 'typeId', target: 'typeId', type: 'number' }
  ]
}

export const mapAsteroidBeltsConfig: TableConfig = {
  name: 'mapAsteroidBelts',
  mappings: [
    { source: '_key', target: 'asteroidBeltId', type: 'number', required: true },
    { source: 'celestialIndex', target: 'celestialIndex', type: 'number' },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'position.x', target: 'positionX', type: 'number' },
    { source: 'position.y', target: 'positionY', type: 'number' },
    { source: 'position.z', target: 'positionZ', type: 'number' },
    { source: 'solarSystemId', target: 'solarSystemId', type: 'number' },
    { source: 'typeId', target: 'typeId', type: 'number' }
  ]
}

// Item/Type Tables
export const typesConfig: TableConfig = {
  name: 'types',
  mappings: [
    { source: '_key', target: 'typeId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'description', target: 'description', type: 'string' },
    { source: 'capacity', target: 'capacity', type: 'number' },
    { source: 'factionId', target: 'factionId', type: 'number' },
    { source: 'graphicId', target: 'graphicId', type: 'number' },
    { source: 'groupId', target: 'groupId', type: 'number', required: true },
    { source: 'iconId', target: 'iconId', type: 'number' },
    { source: 'marketGroupId', target: 'marketGroupId', type: 'number' },
    { source: 'mass', target: 'mass', type: 'number' },
    { source: 'metaGroupId', target: 'metaGroupId', type: 'number' },
    { source: 'portionSize', target: 'portionSize', type: 'number' },
    { source: 'published', target: 'published', type: 'boolean' },
    { source: 'raceId', target: 'raceId', type: 'number' },
    { source: 'radius', target: 'radius', type: 'number' },
    { source: 'soundId', target: 'soundId', type: 'number' },
    { source: 'volume', target: 'volume', type: 'number' }
  ]
}

export const groupsConfig: TableConfig = {
  name: 'groups',
  mappings: [
    { source: '_key', target: 'groupId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'categoryId', target: 'categoryId', type: 'number', required: true },
    { source: 'iconId', target: 'iconId', type: 'number' },
    { source: 'published', target: 'published', type: 'boolean' }
  ]
}

export const categoriesConfig: TableConfig = {
  name: 'categories',
  mappings: [
    { source: '_key', target: 'categoryId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'iconId', target: 'iconId', type: 'number' },
    { source: 'published', target: 'published', type: 'boolean' }
  ]
}

// NPC Tables
export const npcCorporationsConfig: TableConfig = {
  name: 'npcCorporations',
  mappings: [
    { source: '_key', target: 'corporationId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'description', target: 'description', type: 'string' },
    { source: 'ceoId', target: 'ceoId', type: 'number' },
    { source: 'factionId', target: 'factionId', type: 'number' },
    { source: 'solarSystemId', target: 'solarSystemId', type: 'number' },
    { source: 'stationId', target: 'stationId', type: 'number' },
    { source: 'taxRate', target: 'taxRate', type: 'number' },
    { source: 'tickerName', target: 'tickerName', type: 'string' },
    { source: 'deleted', target: 'deleted', type: 'boolean' }
  ]
}

export const npcStationsConfig: TableConfig = {
  name: 'npcStations',
  mappings: [
    { source: '_key', target: 'stationId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
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
    { source: 'reprocessingEfficiency', target: 'reprocessingEfficiency', type: 'number' },
    { source: 'reprocessingStationsTake', target: 'reprocessingStationsTake', type: 'number' },
    { source: 'useOperationName', target: 'useOperationName', type: 'boolean' }
  ]
}

export const stationOperationsConfig: TableConfig = {
  name: 'stationOperations',
  mappings: [
    { source: '_key', target: 'operationId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'description', target: 'description', type: 'string' },
    { source: 'activityId', target: 'activityId', type: 'number' },
    { source: 'border', target: 'border', type: 'number' },
    { source: 'corridor', target: 'corridor', type: 'number' },
    { source: 'fringe', target: 'fringe', type: 'number' },
    { source: 'hub', target: 'hub', type: 'number' },
    { source: 'manufacturingFactor', target: 'manufacturingFactor', type: 'number' },
    { source: 'ratio', target: 'ratio', type: 'number' },
    { source: 'researchFactor', target: 'researchFactor', type: 'number' },
    { source: 'stationType', target: 'stationType', type: 'string' }
  ]
}

export const npcCharactersConfig: TableConfig = {
  name: 'npcCharacters',
  mappings: [
    { source: '_key', target: 'characterId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'corporationId', target: 'corporationId', type: 'number' },
    { source: 'allianceId', target: 'allianceId', type: 'number' },
    { source: 'bloodlineId', target: 'bloodlineId', type: 'number' },
    { source: 'ancestryId', target: 'ancestryId', type: 'number' },
    { source: 'gender', target: 'gender', type: 'number' },
    { source: 'raceId', target: 'raceId', type: 'number' }
  ]
}

// Character Attributes
export const factionsConfig: TableConfig = {
  name: 'factions',
  mappings: [
    { source: '_key', target: 'factionId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'description', target: 'description', type: 'string' },
    { source: 'corporationId', target: 'corporationId', type: 'number' },
    { source: 'militiaCorporationId', target: 'militiaCorporationId', type: 'number' },
    { source: 'solarSystemId', target: 'solarSystemId', type: 'number' }
  ]
}

export const racesConfig: TableConfig = {
  name: 'races',
  mappings: [
    { source: '_key', target: 'raceId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'description', target: 'description', type: 'string' },
    { source: 'iconId', target: 'iconId', type: 'number' }
  ]
}

export const bloodlinesConfig: TableConfig = {
  name: 'bloodlines',
  mappings: [
    { source: '_key', target: 'bloodlineId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'description', target: 'description', type: 'string' },
    { source: 'raceId', target: 'raceId', type: 'number', required: true },
    { source: 'shipTypeId', target: 'shipTypeId', type: 'number' },
    { source: 'corporationId', target: 'corporationId', type: 'number' },
    { source: 'attributes.charisma', target: 'charisma', type: 'number' },
    { source: 'attributes.constitution', target: 'constitution', type: 'number' },
    { source: 'attributes.intelligence', target: 'intelligence', type: 'number' },
    { source: 'attributes.memory', target: 'memory', type: 'number' },
    { source: 'attributes.perception', target: 'perception', type: 'number' },
    { source: 'attributes.willpower', target: 'willpower', type: 'number' }
  ]
}

export const ancestriesConfig: TableConfig = {
  name: 'ancestries',
  mappings: [
    { source: '_key', target: 'ancestryId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'bloodlineId', target: 'bloodlineId', type: 'number', required: true },
    { source: 'description', target: 'description', type: 'string' },
    { source: 'iconId', target: 'iconId', type: 'number' },
    { source: 'shortDescription', target: 'shortDescription', type: 'string' }
  ]
}

// Market/Meta Tables
export const marketGroupsConfig: TableConfig = {
  name: 'marketGroups',
  mappings: [
    { source: '_key', target: 'marketGroupId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'description', target: 'description', type: 'string' },
    { source: 'iconId', target: 'iconId', type: 'number' },
    { source: 'hasTypes', target: 'hasTypes', type: 'boolean' },
    { source: 'parentGroupId', target: 'parentGroupId', type: 'number' }
  ]
}

export const metaGroupsConfig: TableConfig = {
  name: 'metaGroups',
  mappings: [
    { source: '_key', target: 'metaGroupId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'description', target: 'description', type: 'string' },
    { source: 'iconId', target: 'iconId', type: 'number' }
  ]
}

export const skinsConfig: TableConfig = {
  name: 'skins',
  mappings: [
    { source: '_key', target: 'skinId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'description', target: 'description', type: 'string' },
    { source: 'iconId', target: 'iconId', type: 'number' },
    { source: 'internalName', target: 'internalName', type: 'string' }
  ]
}

// Dogma Tables
export const dogmaAttributesConfig: TableConfig = {
  name: 'dogmaAttributes',
  mappings: [
    { source: '_key', target: 'attributeId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'categoryId', target: 'categoryId', type: 'number' },
    { source: 'defaultValue', target: 'defaultValue', type: 'number' },
    { source: 'description', target: 'description', type: 'string' },
    { source: 'displayName', target: 'displayName', type: 'string' },
    { source: 'iconId', target: 'iconId', type: 'number' },
    { source: 'highIsGood', target: 'highIsGood', type: 'boolean' },
    { source: 'published', target: 'published', type: 'boolean' },
    { source: 'stackable', target: 'stackable', type: 'boolean' },
    { source: 'unitId', target: 'unitId', type: 'number' }
  ]
}

export const dogmaEffectsConfig: TableConfig = {
  name: 'dogmaEffects',
  mappings: [
    { source: '_key', target: 'effectId', type: 'number', required: true },
    { source: 'name', target: 'name', type: 'string' },
    { source: 'categoryId', target: 'categoryId', type: 'number' },
    { source: 'description', target: 'description', type: 'string' },
    { source: 'disallowAutoRepeat', target: 'disallowAutoRepeat', type: 'boolean' },
    { source: 'dischargeAttributeId', target: 'dischargeAttributeId', type: 'number' },
    { source: 'displayName', target: 'displayName', type: 'string' },
    { source: 'durationAttributeId', target: 'durationAttributeId', type: 'number' },
    { source: 'effectCategory', target: 'effectCategory', type: 'string' },
    { source: 'falloffAttributeId', target: 'falloffAttributeId', type: 'number' },
    { source: 'fittingUsageChanceAttributeId', target: 'fittingUsageChanceAttributeId', type: 'number' },
    { source: 'iconId', target: 'iconId', type: 'number' },
    { source: 'isAssistance', target: 'isAssistance', type: 'boolean' },
    { source: 'isOffensive', target: 'isOffensive', type: 'boolean' },
    { source: 'isWarpSafe', target: 'isWarpSafe', type: 'boolean' },
    { source: 'neurotoxinId', target: 'neurotoxinId', type: 'number' },
    { source: 'npcActivationChanceAttributeId', target: 'npcActivationChanceAttributeId', type: 'number' },
    { source: 'npcUsageChanceAttributeId', target: 'npcUsageChanceAttributeId', type: 'number' },
    { source: 'published', target: 'published', type: 'boolean' },
    { source: 'rangeAttributeId', target: 'rangeAttributeId', type: 'number' },
    { source: 'resistanceAttributeId', target: 'resistanceAttributeId', type: 'number' },
    { source: 'softPenetrationAttributeId', target: 'softPenetrationAttributeId', type: 'number' },
    { source: 'trackingSpeedAttributeId', target: 'trackingSpeedAttributeId', type: 'number' }
  ]
}

/**
 * All table configurations
 */
export const ALL_TABLE_CONFIGS = [
  // Map tables
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
  npcStationsConfig,
  stationOperationsConfig,
  npcCharactersConfig,
  // Character attributes
  factionsConfig,
  racesConfig,
  bloodlinesConfig,
  ancestriesConfig,
  // Market/Meta
  marketGroupsConfig,
  metaGroupsConfig,
  skinsConfig,
  // Dogma tables
  dogmaAttributesConfig,
  dogmaEffectsConfig
]

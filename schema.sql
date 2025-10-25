-- EVE Kill Database Schema (ClickHouse) - Simplified
-- This file contains the minimal database schema for the EVE Kill application
-- Optimized for ClickHouse with denormalized tables and materialized views

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS edk;
USE edk;

-- ============================================================================
-- MIGRATION TRACKING TABLE
-- ============================================================================

-- Migrations table - Track schema migrations
CREATE TABLE IF NOT EXISTS migrations (
  id UInt32,
  filename String NOT NULL,
  checksum String NOT NULL,
  applied_at DateTime DEFAULT now(),
  success UInt8 DEFAULT 1
) ENGINE = MergeTree()
ORDER BY (applied_at, id);

-- ============================================================================
-- CORE KILLMAIL TABLES
-- ============================================================================

-- Killmails table - Core killmail records with victim information
CREATE TABLE IF NOT EXISTS killmails (
  killmailId UInt32 NOT NULL,
  killmailTime DateTime NOT NULL,
  solarSystemId UInt32 NOT NULL,

  -- Victim information
  victimAllianceId Nullable(UInt32),
  victimCharacterId Nullable(UInt32),
  victimCorporationId UInt32,
  victimDamageTaken UInt32,
  victimShipTypeId UInt32,

  -- Victim position
  positionX Nullable(Float64),
  positionY Nullable(Float64),
  positionZ Nullable(Float64),

  createdAt DateTime DEFAULT now(),

  INDEX idx_solar_system (solarSystemId) TYPE minmax GRANULARITY 3,
  INDEX idx_victim_character (victimCharacterId) TYPE minmax GRANULARITY 3,
  INDEX idx_victim_corporation (victimCorporationId) TYPE minmax GRANULARITY 3,
  INDEX idx_victim_alliance (victimAllianceId) TYPE minmax GRANULARITY 3,
  INDEX idx_victim_ship_type (victimShipTypeId) TYPE minmax GRANULARITY 3,
  INDEX idx_victim_damage_taken (victimDamageTaken) TYPE minmax GRANULARITY 3,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY (killmailTime, killmailId)
PARTITION BY toYYYYMM(killmailTime);

-- Attackers table - Attacker information (one row per attacker per killmail)
CREATE TABLE IF NOT EXISTS attackers (
  killmailId UInt32 NOT NULL,
  allianceId Nullable(UInt32),
  corporationId Nullable(UInt32),
  characterId Nullable(UInt32),
  damageDone UInt32,
  finalBlow UInt8,
  securityStatus Nullable(Float32),
  shipTypeId Nullable(UInt32),
  weaponTypeId Nullable(UInt32),
  createdAt DateTime DEFAULT now(),

  INDEX idx_character (characterId) TYPE minmax GRANULARITY 3,
  INDEX idx_corporation (corporationId) TYPE minmax GRANULARITY 3,
  INDEX idx_alliance (allianceId) TYPE minmax GRANULARITY 3,
  INDEX idx_ship_type (shipTypeId) TYPE minmax GRANULARITY 3,
  INDEX idx_weapon_type (weaponTypeId) TYPE minmax GRANULARITY 3,
  INDEX idx_final_blow (finalBlow) TYPE minmax GRANULARITY 3,
  INDEX idx_damage_done (damageDone) TYPE minmax GRANULARITY 3,
  INDEX ids_security_status (securityStatus) TYPE minmax GRANULARITY 3,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY (killmailId, finalBlow)
PARTITION BY toYYYYMM(createdAt);

-- Items table - Items from killmails (one row per item per killmail)
CREATE TABLE IF NOT EXISTS items (
  killmailId UInt32 NOT NULL,
  flag UInt8,
  itemTypeId UInt32,
  quantityDropped UInt32,
  quantityDestroyed UInt32,
  singleton UInt8,
  createdAt DateTime DEFAULT now(),

  INDEX idx_item_type (itemTypeId) TYPE minmax GRANULARITY 3,
  INDEX idx_flag (flag) TYPE minmax GRANULARITY 3,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY (killmailId, itemTypeId)
PARTITION BY toYYYYMM(createdAt);

-- ============================================================================
-- SDE (STATIC DATA EXPORT) TABLES
-- ============================================================================

-- mapSolarSystems - Solar system information
-- Source: developers.eveonline.com/static-data/tranquility/mapSolarSystems.jsonl
CREATE TABLE IF NOT EXISTS mapSolarSystems (
  solarSystemId UInt32 NOT NULL,
  border UInt8,
  constellationId UInt32,
  corridor UInt8,
  factionId Nullable(UInt32),
  fringe UInt8,
  hub UInt8,
  international UInt8,
  luminosity Float32,
  name String,
  planetIds Array(UInt32),
  positionX Float64,
  positionY Float64,
  positionZ Float64,
  radius Float64,
  regional UInt8,
  regionId UInt32,
  securityClass String,
  securityStatus Float32,
  stargateIds Array(UInt32),
  starId UInt32,
  visualEffect String,
  wormholeClassId Nullable(UInt32),
  updatedAt DateTime DEFAULT now(),
  version UInt64,

  INDEX idx_constellation (constellationId) TYPE minmax GRANULARITY 3,
  INDEX idx_region (regionId) TYPE minmax GRANULARITY 3,
  INDEX idx_security_status (securityStatus) TYPE minmax GRANULARITY 3,
  INDEX idx_faction (factionId) TYPE minmax GRANULARITY 3
) ENGINE = ReplacingMergeTree(version)
ORDER BY solarSystemId;

-- mapRegions - Region information
-- Source: developers.eveonline.com/static-data/tranquility/mapRegions.jsonl
CREATE TABLE IF NOT EXISTS mapRegions (
  regionId UInt32 NOT NULL,
  constellationIds Array(UInt32),
  description String,
  factionId Nullable(UInt32),
  name String,
  nebulaId Nullable(UInt32),
  positionX Float64,
  positionY Float64,
  positionZ Float64,
  wormholeClassId Nullable(UInt32),
  updatedAt DateTime DEFAULT now(),

  INDEX idx_faction (factionId) TYPE minmax GRANULARITY 3,
  INDEX idx_nebula (nebulaId) TYPE minmax GRANULARITY 3,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY regionId;

-- mapConstellations - Constellation information
-- Source: developers.eveonline.com/static-data/tranquility/mapConstellations.jsonl
CREATE TABLE IF NOT EXISTS mapConstellations (
  constellationId UInt32 NOT NULL,
  factionId Nullable(UInt32),
  name String,
  positionX Float64,
  positionY Float64,
  positionZ Float64,
  regionId UInt32,
  solarSystemIds Array(UInt32),
  wormholeClassId Nullable(UInt32),
  updatedAt DateTime DEFAULT now(),

  INDEX idx_region (regionId) TYPE minmax GRANULARITY 3,
  INDEX idx_faction (factionId) TYPE minmax GRANULARITY 3,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY constellationId;

-- ============================================================================
-- MATERIALIZED VIEWS & HELPER TABLES
-- ============================================================================

-- killmails_esi - View reconstructing killmails in ESI API format
-- This view combines killmails, attackers, and items into ESI-compatible format
-- Uses a regular VIEW (not materialized) to always query live data
DROP VIEW IF EXISTS killmails_esi;
CREATE VIEW killmails_esi AS
SELECT
  k.killmailId as killmail_id,
  formatDateTime(k.killmailTime, '%Y-%m-%dT%H:%i:%SZ') as killmail_time,
  k.solarSystemId as solar_system_id,
  k.victimAllianceId as victim_alliance_id,
  k.victimCharacterId as victim_character_id,
  k.victimCorporationId as victim_corporation_id,
  k.victimDamageTaken as victim_damage_taken,
  k.victimShipTypeId as victim_ship_type_id,
  k.positionX as victim_position_x,
  k.positionY as victim_position_y,
  k.positionZ as victim_position_z,
  any(a_data.attackers_array) as attackers_array,
  any(i_data.items_array) as items_array
FROM edk.killmails k
LEFT JOIN (
  SELECT
    killmailId,
    groupArray(
      tuple(
        allianceId,
        characterId,
        corporationId,
        damageDone,
        finalBlow,
        securityStatus,
        shipTypeId,
        weaponTypeId
      )
    ) as attackers_array
  FROM edk.attackers
  GROUP BY killmailId
) a_data ON k.killmailId = a_data.killmailId
LEFT JOIN (
  SELECT
    killmailId,
    groupArray(
      tuple(
        flag,
        itemTypeId,
        quantityDropped,
        quantityDestroyed,
        singleton
      )
    ) as items_array
  FROM edk.items
  GROUP BY killmailId
) i_data ON k.killmailId = i_data.killmailId
GROUP BY k.killmailId, k.killmailTime, k.solarSystemId, k.victimAllianceId, k.victimCharacterId, k.victimCorporationId, k.victimDamageTaken, k.victimShipTypeId, k.positionX, k.positionY, k.positionZ;

-- ============================================================================
-- ADDITIONAL SDE MAP TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS mapStargates (
  stargateId UInt32 NOT NULL PRIMARY KEY,
  name String,
  positionX Float64,
  positionY Float64,
  positionZ Float64,
  solarSystemId UInt32,
  destinationGateId Nullable(UInt32),
  destinationSolarSystemId Nullable(UInt32),
  typeId UInt32,
  updatedAt DateTime DEFAULT now(),

  INDEX idx_system (solarSystemId) TYPE minmax GRANULARITY 3,
  INDEX idx_dest_system (destinationSolarSystemId) TYPE minmax GRANULARITY 3,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY stargateId;

CREATE TABLE IF NOT EXISTS mapStars (
  starId UInt32 NOT NULL PRIMARY KEY,
  age Float64,
  luminosity Float32,
  name String,
  radius Float64,
  solarSystemId UInt32,
  spectralClass String,
  temperature UInt32,
  typeId UInt32,
  updatedAt DateTime DEFAULT now(),

  INDEX idx_system (solarSystemId) TYPE minmax GRANULARITY 3,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY starId;

CREATE TABLE IF NOT EXISTS mapPlanets (
  planetId UInt32 NOT NULL PRIMARY KEY,
  celestialIndex UInt32,
  name String,
  positionX Float64,
  positionY Float64,
  positionZ Float64,
  solarSystemId UInt32,
  typeId UInt32,
  updatedAt DateTime DEFAULT now(),

  INDEX idx_system (solarSystemId) TYPE minmax GRANULARITY 3,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY planetId;

CREATE TABLE IF NOT EXISTS mapMoons (
  moonId UInt32 NOT NULL PRIMARY KEY,
  celestialIndex UInt32,
  name String,
  planetId UInt32,
  positionX Float64,
  positionY Float64,
  positionZ Float64,
  solarSystemId UInt32,
  typeId UInt32,
  updatedAt DateTime DEFAULT now(),

  INDEX idx_system (solarSystemId) TYPE minmax GRANULARITY 3,
  INDEX idx_planet (planetId) TYPE minmax GRANULARITY 3,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY moonId;

CREATE TABLE IF NOT EXISTS mapAsteroidBelts (
  asteroidBeltId UInt32 NOT NULL PRIMARY KEY,
  celestialIndex UInt32,
  name String,
  positionX Float64,
  positionY Float64,
  positionZ Float64,
  solarSystemId UInt32,
  typeId UInt32,
  updatedAt DateTime DEFAULT now(),

  INDEX idx_system (solarSystemId) TYPE minmax GRANULARITY 3,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY asteroidBeltId;

-- ============================================================================
-- ITEM/TYPE SDE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS types (
  typeId UInt32 NOT NULL PRIMARY KEY,
  name String,
  description String,
  capacity Float64,
  factionId Nullable(UInt32),
  graphicId Nullable(UInt32),
  groupId UInt32,
  iconId Nullable(UInt32),
  marketGroupId Nullable(UInt32),
  mass Float64,
  metaGroupId Nullable(UInt32),
  portionSize UInt32,
  published UInt8,
  raceId Nullable(UInt32),
  radius Float64,
  soundId Nullable(UInt32),
  volume Float64,
  updatedAt DateTime DEFAULT now(),

  INDEX idx_group (groupId) TYPE minmax GRANULARITY 3,
  INDEX idx_faction (factionId) TYPE minmax GRANULARITY 3,
  INDEX idx_market_group (marketGroupId) TYPE minmax GRANULARITY 3,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY typeId;

CREATE TABLE IF NOT EXISTS groups (
  groupId UInt32 NOT NULL PRIMARY KEY,
  name String,
  categoryId UInt32,
  iconId Nullable(UInt32),
  published UInt8,
  updatedAt DateTime DEFAULT now(),

  INDEX idx_category (categoryId) TYPE minmax GRANULARITY 3,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY groupId;

CREATE TABLE IF NOT EXISTS categories (
  categoryId UInt32 NOT NULL PRIMARY KEY,
  name String,
  iconId Nullable(UInt32),
  published UInt8,
  updatedAt DateTime DEFAULT now(),
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY categoryId;

-- ============================================================================
-- NPC/FACTION SDE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS npcCorporations (
  corporationId UInt32 NOT NULL PRIMARY KEY,
  name String,
  description String,
  ceoId UInt32,
  factionId Nullable(UInt32),
  solarSystemId UInt32,
  stationId UInt32,
  taxRate Float32,
  tickerName String,
  deleted UInt8,
  updatedAt DateTime DEFAULT now(),

  INDEX idx_faction (factionId) TYPE minmax GRANULARITY 3,
  INDEX idx_system (solarSystemId) TYPE minmax GRANULARITY 3,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY corporationId;

CREATE TABLE IF NOT EXISTS npcStations (
  stationId UInt32 NOT NULL PRIMARY KEY,
  name String,
  solarSystemId UInt32,
  typeId UInt32,
  ownerIds Array(UInt32),
  celestialIndex UInt32,
  operationId UInt32,
  orbitId UInt32,
  orbitIndex UInt32,
  positionX Float64,
  positionY Float64,
  positionZ Float64,
  reprocessingEfficiency Float32,
  reprocessingStationsTake Float32,
  useOperationName UInt8,
  updatedAt DateTime DEFAULT now(),

  INDEX idx_system (solarSystemId) TYPE minmax GRANULARITY 3,
  INDEX idx_type (typeId) TYPE minmax GRANULARITY 3,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY stationId;

CREATE TABLE IF NOT EXISTS stationOperations (
  operationId UInt32 NOT NULL PRIMARY KEY,
  name String,
  description String,
  activityId UInt32,
  border Float32,
  corridor Float32,
  fringe Float32,
  hub Float32,
  manufacturingFactor Float32,
  ratio Float32,
  researchFactor Float32,
  stationType String,
  updatedAt DateTime DEFAULT now(),
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY operationId;

CREATE TABLE IF NOT EXISTS npcCharacters (
  characterId UInt32 NOT NULL PRIMARY KEY,
  name String,
  corporationId UInt32,
  allianceId Nullable(UInt32),
  bloodlineId UInt32,
  ancestryId UInt32,
  gender UInt8,
  raceId UInt32,
  updatedAt DateTime DEFAULT now(),

  INDEX idx_corporation (corporationId) TYPE minmax GRANULARITY 3,
  INDEX idx_alliance (allianceId) TYPE minmax GRANULARITY 3,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY characterId;

-- ============================================================================
-- CHARACTER ATTRIBUTES SDE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS factions (
  factionId UInt32 NOT NULL PRIMARY KEY,
  name String,
  description String,
  corporationId UInt32,
  militiaCorporationId UInt32,
  solarSystemId UInt32,
  updatedAt DateTime DEFAULT now(),
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY factionId;

CREATE TABLE IF NOT EXISTS races (
  raceId UInt32 NOT NULL PRIMARY KEY,
  name String,
  description String,
  iconId Nullable(UInt32),
  updatedAt DateTime DEFAULT now(),
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY raceId;

CREATE TABLE IF NOT EXISTS bloodlines (
  bloodlineId UInt32 NOT NULL PRIMARY KEY,
  name String,
  description String,
  raceId UInt32,
  shipTypeId UInt32,
  corporationId UInt32,
  charisma UInt32,
  constitution UInt32,
  intelligence UInt32,
  memory UInt32,
  perception UInt32,
  willpower UInt32,
  updatedAt DateTime DEFAULT now(),

  INDEX idx_race (raceId) TYPE minmax GRANULARITY 3,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY bloodlineId;

CREATE TABLE IF NOT EXISTS ancestries (
  ancestryId UInt32 NOT NULL PRIMARY KEY,
  name String,
  bloodlineId UInt32,
  description String,
  iconId Nullable(UInt32),
  shortDescription String,
  updatedAt DateTime DEFAULT now(),

  INDEX idx_bloodline (bloodlineId) TYPE minmax GRANULARITY 3,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY ancestryId;

-- ============================================================================
-- MARKET/META SDE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketGroups (
  marketGroupId UInt32 NOT NULL PRIMARY KEY,
  name String,
  description String,
  iconId Nullable(UInt32),
  hasTypes UInt8,
  parentGroupId Nullable(UInt32),
  updatedAt DateTime DEFAULT now(),

  INDEX idx_parent (parentGroupId) TYPE minmax GRANULARITY 3,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY marketGroupId;

CREATE TABLE IF NOT EXISTS metaGroups (
  metaGroupId UInt32 NOT NULL PRIMARY KEY,
  name String,
  description String,
  iconId Nullable(UInt32),
  updatedAt DateTime DEFAULT now(),
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY metaGroupId;

CREATE TABLE IF NOT EXISTS skins (
  skinId UInt32 NOT NULL PRIMARY KEY,
  name String,
  description String,
  iconId Nullable(UInt32),
  internalName String,
  updatedAt DateTime DEFAULT now(),
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY skinId;

-- ============================================================================
-- DOGMA SDE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS dogmaAttributes (
  attributeId UInt32 NOT NULL PRIMARY KEY,
  name String,
  categoryId Nullable(UInt32),
  defaultValue Float32,
  description String,
  displayName String,
  iconId Nullable(UInt32),
  highIsGood UInt8,
  published UInt8,
  stackable UInt8,
  unitId Nullable(UInt32),
  updatedAt DateTime DEFAULT now(),
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY attributeId;

CREATE TABLE IF NOT EXISTS dogmaEffects (
  effectId UInt32 NOT NULL PRIMARY KEY,
  name String,
  categoryId Nullable(UInt32),
  description String,
  disallowAutoRepeat UInt8,
  dischargeAttributeId Nullable(UInt32),
  displayName String,
  durationAttributeId Nullable(UInt32),
  effectCategory Nullable(String),
  falloffAttributeId Nullable(UInt32),
  fittingUsageChanceAttributeId Nullable(UInt32),
  iconId Nullable(UInt32),
  isAssistance UInt8,
  isOffensive UInt8,
  isWarpSafe UInt8,
  neurotoxinId Nullable(UInt32),
  npcActivationChanceAttributeId Nullable(UInt32),
  npcUsageChanceAttributeId Nullable(UInt32),
  published UInt8,
  rangeAttributeId Nullable(UInt32),
  resistanceAttributeId Nullable(UInt32),
  softPenetrationAttributeId Nullable(UInt32),
  trackingSpeedAttributeId Nullable(UInt32),
  updatedAt DateTime DEFAULT now(),
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY effectId;

-- ============================================================================
-- CONFIGURATION & METADATA TABLES (WITH VERSIONING)
-- ============================================================================

-- Configuration table - Tracks import state, build numbers, and metadata
-- Uses ReplacingMergeTree for version history
CREATE TABLE IF NOT EXISTS config (
  configKey String NOT NULL,
  configValue String,
  buildNumber Nullable(UInt32),
  tableName Nullable(String),
  rowCount Nullable(UInt32),
  updatedAt DateTime,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY (configKey, version);

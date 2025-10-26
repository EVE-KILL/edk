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

  -- ESI hash for API access
  hash String DEFAULT '',

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
-- PLAYER CHARACTER/CORPORATION/ALLIANCE TABLES (ESI DATA)
-- ============================================================================

-- Player Characters - Stores ESI character data
CREATE TABLE IF NOT EXISTS characters (
  character_id UInt32 NOT NULL,
  alliance_id Nullable(UInt32),
  birthday String,
  bloodline_id UInt32,
  corporation_id UInt32,
  description String,
  gender String,
  name String,
  race_id UInt32,
  security_status Float32,
  updated_at DateTime DEFAULT now(),
  version UInt64,

  INDEX idx_alliance (alliance_id) TYPE minmax GRANULARITY 3,
  INDEX idx_corporation (corporation_id) TYPE minmax GRANULARITY 3,
  INDEX idx_bloodline (bloodline_id) TYPE minmax GRANULARITY 3,
  INDEX idx_race (race_id) TYPE minmax GRANULARITY 3
) ENGINE = ReplacingMergeTree(version)
ORDER BY character_id;

-- Player Corporations - Stores ESI corporation data
CREATE TABLE IF NOT EXISTS corporations (
  corporation_id UInt32 NOT NULL,
  alliance_id Nullable(UInt32),
  ceo_id UInt32,
  creator_id UInt32,
  date_founded String,
  description String,
  home_station_id Nullable(UInt32),
  member_count UInt32,
  name String,
  shares UInt64,
  tax_rate Float32,
  ticker String,
  url String,
  updated_at DateTime DEFAULT now(),
  version UInt64,

  INDEX idx_alliance (alliance_id) TYPE minmax GRANULARITY 3,
  INDEX idx_ceo (ceo_id) TYPE minmax GRANULARITY 3,
  INDEX idx_creator (creator_id) TYPE minmax GRANULARITY 3
) ENGINE = ReplacingMergeTree(version)
ORDER BY corporation_id;

-- Player Alliances - Stores ESI alliance data
CREATE TABLE IF NOT EXISTS alliances (
  alliance_id UInt32 NOT NULL,
  creator_corporation_id UInt32,
  creator_id UInt32,
  date_founded String,
  executor_corporation_id UInt32,
  name String,
  ticker String,
  updated_at DateTime DEFAULT now(),
  version UInt64,

  INDEX idx_creator_corp (creator_corporation_id) TYPE minmax GRANULARITY 3,
  INDEX idx_creator (creator_id) TYPE minmax GRANULARITY 3,
  INDEX idx_executor_corp (executor_corporation_id) TYPE minmax GRANULARITY 3
) ENGINE = ReplacingMergeTree(version)
ORDER BY alliance_id;

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
-- PLAYER CHARACTER/CORPORATION/ALLIANCE TABLES (ESI DATA)
-- ============================================================================

-- Player Characters - Stores ESI character data
CREATE TABLE IF NOT EXISTS characters (
  character_id UInt32 NOT NULL,
  alliance_id Nullable(UInt32),
  birthday String,
  bloodline_id UInt32,
  corporation_id UInt32,
  description String,
  gender String,
  name String,
  race_id UInt32,
  security_status Float32,
  updated_at DateTime DEFAULT now(),
  version UInt64,

  INDEX idx_alliance (alliance_id) TYPE minmax GRANULARITY 3,
  INDEX idx_corporation (corporation_id) TYPE minmax GRANULARITY 3,
  INDEX idx_bloodline (bloodline_id) TYPE minmax GRANULARITY 3,
  INDEX idx_race (race_id) TYPE minmax GRANULARITY 3
) ENGINE = ReplacingMergeTree(version)
ORDER BY character_id;

-- Player Corporations - Stores ESI corporation data
CREATE TABLE IF NOT EXISTS corporations (
  corporation_id UInt32 NOT NULL,
  alliance_id Nullable(UInt32),
  ceo_id UInt32,
  creator_id UInt32,
  date_founded String,
  description String,
  home_station_id Nullable(UInt32),
  member_count UInt32,
  name String,
  shares UInt64,
  tax_rate Float32,
  ticker String,
  url String,
  updated_at DateTime DEFAULT now(),
  version UInt64,

  INDEX idx_alliance (alliance_id) TYPE minmax GRANULARITY 3,
  INDEX idx_ceo (ceo_id) TYPE minmax GRANULARITY 3,
  INDEX idx_creator (creator_id) TYPE minmax GRANULARITY 3
) ENGINE = ReplacingMergeTree(version)
ORDER BY corporation_id;

-- Player Alliances - Stores ESI alliance data
CREATE TABLE IF NOT EXISTS alliances (
  alliance_id UInt32 NOT NULL,
  creator_corporation_id UInt32,
  creator_id UInt32,
  date_founded String,
  executor_corporation_id UInt32,
  name String,
  ticker String,
  updated_at DateTime DEFAULT now(),
  version UInt64,

  INDEX idx_creator_corp (creator_corporation_id) TYPE minmax GRANULARITY 3,
  INDEX idx_creator (creator_id) TYPE minmax GRANULARITY 3,
  INDEX idx_executor_corp (executor_corporation_id) TYPE minmax GRANULARITY 3
) ENGINE = ReplacingMergeTree(version)
ORDER BY alliance_id;

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
-- PRICES TABLE
-- ============================================================================

-- Prices table - Stores historical price data from eve-kill.com API
-- Tracks average, highest, and lowest prices per type per region per date
CREATE TABLE IF NOT EXISTS prices (
  type_id UInt32 NOT NULL,
  region_id UInt32 NOT NULL,
  price_date Date NOT NULL,
  average_price Float64,
  highest_price Float64,
  lowest_price Float64,
  order_count UInt32,
  volume UInt32,
  updated_at DateTime DEFAULT now(),
  version UInt64,

  INDEX idx_type (type_id) TYPE minmax GRANULARITY 3,
  INDEX idx_region (region_id) TYPE minmax GRANULARITY 3,
  INDEX idx_date (price_date) TYPE minmax GRANULARITY 3
) ENGINE = ReplacingMergeTree(version)
ORDER BY (type_id, region_id, price_date)
PARTITION BY toYYYYMM(price_date);

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

-- ============================================================================
-- VIEWS AND MATERIALIZED VIEWS
-- ============================================================================
-- NOTE: Views are defined LAST to ensure all referenced tables exist

-- killmails_esi - View reconstructing killmails in ESI API format
-- This view combines killmails, attackers, and items into ESI-compatible format
-- Uses a regular VIEW (not materialized) to always query live data
CREATE VIEW IF NOT EXISTS killmails_esi AS
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
-- KILLLIST FRONTPAGE MATERIALIZED VIEW
-- ============================================================================

-- killlist_frontpage - Fully materialized view for home page killmail list
-- With the new queue-first architecture, all entity and price data exists
-- BEFORE the killmail is stored, so we can materialize everything including names
DROP TABLE IF EXISTS killlist_frontpage_mv;
DROP TABLE IF EXISTS killlist_frontpage;
DROP VIEW IF EXISTS killlist_frontpage;

CREATE MATERIALIZED VIEW IF NOT EXISTS killlist_frontpage
ENGINE = ReplacingMergeTree(version)
ORDER BY (killmail_time, killmail_id)
PARTITION BY toYYYYMM(killmail_time)
POPULATE
AS
SELECT
  -- Killmail basics
  k.killmailId as killmail_id,
  k.killmailTime as killmail_time,
  k.version as version,

  -- Victim ship info with names (SDE data - always available)
  k.victimShipTypeId as victim_ship_type_id,
  coalesce(t_victim.name, 'Unknown') as victim_ship_name,
  coalesce(g_victim.name, 'Unknown') as victim_ship_group,

  -- Victim character with name (fetched before killmail stored)
  k.victimCharacterId as victim_character_id,
  coalesce(c_victim.name, nc_victim.name, 'Unknown') as victim_character_name,

  -- Victim corporation with name (fetched before killmail stored)
  k.victimCorporationId as victim_corporation_id,
  coalesce(corp_victim.name, npc_corp_victim.name, 'Unknown') as victim_corporation_name,
  coalesce(corp_victim.ticker, npc_corp_victim.tickerName, '???') as victim_corporation_ticker,

  -- Victim alliance with name (fetched before killmail stored)
  k.victimAllianceId as victim_alliance_id,
  a_victim.name as victim_alliance_name,
  a_victim.ticker as victim_alliance_ticker,

  -- Final blow attacker character with name (fetched before killmail stored)
  fb.characterId as attacker_character_id,
  coalesce(c_attacker.name, nc_attacker.name, 'Unknown') as attacker_character_name,

  -- Final blow attacker corporation with name (fetched before killmail stored)
  fb.corporationId as attacker_corporation_id,
  coalesce(corp_attacker.name, npc_corp_attacker.name, 'Unknown') as attacker_corporation_name,
  coalesce(corp_attacker.ticker, npc_corp_attacker.tickerName, '???') as attacker_corporation_ticker,

  -- Final blow attacker alliance with name (fetched before killmail stored)
  fb.allianceId as attacker_alliance_id,
  a_attacker.name as attacker_alliance_name,
  a_attacker.ticker as attacker_alliance_ticker,

  -- Solar system with name (SDE data - always available)
  k.solarSystemId as solar_system_id,
  coalesce(sys.name, 'Unknown') as solar_system_name,
  coalesce(sys.securityStatus, 0.0) as solar_system_security,
  coalesce(sys.regionId, 0) as region_id,
  coalesce(reg.name, 'Unknown') as region_name,

  -- Values (prices fetched before killmail stored)
  coalesce(p_ship.average_price, 0.0) as ship_value,
  coalesce(items_agg.dropped_value, 0.0) as qty_dropped_value,
  coalesce(items_agg.destroyed_value, 0.0) as qty_destroyed_value,
  coalesce(p_ship.average_price, 0.0) + coalesce(items_agg.dropped_value, 0.0) + coalesce(items_agg.destroyed_value, 0.0) as total_value,

  -- Stats (calculated from subqueries)
  attacker_stats.attacker_count as attacker_count,
  (attacker_stats.attacker_count = 1 AND fb.characterId IS NOT NULL) as is_solo,
  attacker_stats.is_npc as is_npc

FROM edk.killmails k

-- Get final blow attacker
LEFT JOIN edk.attackers fb ON k.killmailId = fb.killmailId AND fb.finalBlow = 1

-- Calculate attacker stats
LEFT JOIN (
  SELECT
    killmailId,
    count() as attacker_count,
    countIf(characterId IS NULL) = count() as is_npc
  FROM edk.attackers
  GROUP BY killmailId
) attacker_stats ON k.killmailId = attacker_stats.killmailId

-- Join victim ship type and group (SDE - always available)
LEFT JOIN edk.types t_victim ON k.victimShipTypeId = t_victim.typeId
LEFT JOIN edk.groups g_victim ON t_victim.groupId = g_victim.groupId

-- Join victim character (player or NPC - fetched before killmail stored)
LEFT JOIN edk.characters c_victim ON k.victimCharacterId = c_victim.character_id
LEFT JOIN edk.npcCharacters nc_victim ON k.victimCharacterId = nc_victim.characterId

-- Join victim corporation (player or NPC - fetched before killmail stored)
LEFT JOIN edk.corporations corp_victim ON k.victimCorporationId = corp_victim.corporation_id
LEFT JOIN edk.npcCorporations npc_corp_victim ON k.victimCorporationId = npc_corp_victim.corporationId

-- Join victim alliance (fetched before killmail stored)
LEFT JOIN edk.alliances a_victim ON k.victimAllianceId = a_victim.alliance_id

-- Join final blow attacker character (player or NPC - fetched before killmail stored)
LEFT JOIN edk.characters c_attacker ON fb.characterId = c_attacker.character_id
LEFT JOIN edk.npcCharacters nc_attacker ON fb.characterId = nc_attacker.characterId

-- Join final blow attacker corporation (player or NPC - fetched before killmail stored)
LEFT JOIN edk.corporations corp_attacker ON fb.corporationId = corp_attacker.corporation_id
LEFT JOIN edk.npcCorporations npc_corp_attacker ON fb.corporationId = npc_corp_attacker.corporationId

-- Join final blow attacker alliance (fetched before killmail stored)
LEFT JOIN edk.alliances a_attacker ON fb.allianceId = a_attacker.alliance_id

-- Join solar system and region (SDE - always available)
LEFT JOIN edk.mapSolarSystems sys ON k.solarSystemId = sys.solarSystemId
LEFT JOIN edk.mapRegions reg ON sys.regionId = reg.regionId

-- Join ship price (fetched before killmail stored)
LEFT JOIN (
  SELECT
    type_id,
    argMax(average_price, version) as average_price
  FROM edk.prices
  WHERE region_id = 10000002
  AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
  GROUP BY type_id
) p_ship ON k.victimShipTypeId = p_ship.type_id

-- Aggregate items values (prices fetched before killmail stored)
LEFT JOIN (
  SELECT
    i.killmailId,
    sum(coalesce(p.average_price, 0.0) * i.quantityDropped) as dropped_value,
    sum(coalesce(p.average_price, 0.0) * i.quantityDestroyed) as destroyed_value
  FROM edk.items i
  LEFT JOIN (
    SELECT
      type_id,
      argMax(average_price, version) as average_price
    FROM edk.prices
    WHERE region_id = 10000002
    AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
    GROUP BY type_id
  ) p ON i.itemTypeId = p.type_id
  GROUP BY i.killmailId
) items_agg ON k.killmailId = items_agg.killmailId;

-- ============================================================================
-- TOP BOX FRONTPAGE MATERIALIZED VIEW
-- ============================================================================

-- Single unified view for all top entity statistics
-- Aggregates kills for characters, corporations, alliances, systems, and regions
-- This powers the top 10 boxes on the home page

-- First create the target table
DROP TABLE IF EXISTS top_box_frontpage;
CREATE TABLE IF NOT EXISTS top_box_frontpage
(
  entity_type String,
  entity_id UInt32,
  killmail_date Date,
  kills UInt64
)
ENGINE = SummingMergeTree(kills)
ORDER BY (entity_type, entity_id, killmail_date)
PARTITION BY toYYYYMM(killmail_date);

-- Then create the materialized view that feeds the table
DROP TABLE IF EXISTS top_box_frontpage_mv;
CREATE MATERIALIZED VIEW IF NOT EXISTS top_box_frontpage_mv
TO top_box_frontpage
AS
-- Top Characters (attackers who got kills)
SELECT
  'character' as entity_type,
  assumeNotNull(a.characterId) as entity_id,
  toDate(k.killmailTime) as killmail_date,
  count() as kills
FROM edk.killmails k
JOIN edk.attackers a ON k.killmailId = a.killmailId
WHERE a.characterId IS NOT NULL
GROUP BY a.characterId, toDate(k.killmailTime)

UNION ALL

-- Top Corporations (attackers who got kills)
SELECT
  'corporation' as entity_type,
  assumeNotNull(a.corporationId) as entity_id,
  toDate(k.killmailTime) as killmail_date,
  count() as kills
FROM edk.killmails k
JOIN edk.attackers a ON k.killmailId = a.killmailId
WHERE a.corporationId IS NOT NULL
GROUP BY a.corporationId, toDate(k.killmailTime)

UNION ALL

-- Top Alliances (attackers who got kills)
SELECT
  'alliance' as entity_type,
  assumeNotNull(a.allianceId) as entity_id,
  toDate(k.killmailTime) as killmail_date,
  count() as kills
FROM edk.killmails k
JOIN edk.attackers a ON k.killmailId = a.killmailId
WHERE a.allianceId IS NOT NULL
GROUP BY a.allianceId, toDate(k.killmailTime)

UNION ALL

-- Top Systems (where kills happened)
SELECT
  'system' as entity_type,
  k.solarSystemId as entity_id,
  toDate(k.killmailTime) as killmail_date,
  count() as kills
FROM edk.killmails k
GROUP BY k.solarSystemId, toDate(k.killmailTime)

UNION ALL

-- Top Regions (where kills happened)
SELECT
  'region' as entity_type,
  assumeNotNull(sys.regionId) as entity_id,
  toDate(k.killmailTime) as killmail_date,
  count() as kills
FROM edk.killmails k
JOIN edk.mapSolarSystems sys ON k.solarSystemId = sys.solarSystemId
WHERE sys.regionId IS NOT NULL
GROUP BY sys.regionId, toDate(k.killmailTime);

-- Populate the table with existing data (one-time operation)
-- This INSERT will only run once per schema version since it's tracked in migrations
INSERT INTO top_box_frontpage
SELECT
  'character' as entity_type,
  assumeNotNull(a.characterId) as entity_id,
  toDate(k.killmailTime) as killmail_date,
  count() as kills
FROM edk.killmails k
JOIN edk.attackers a ON k.killmailId = a.killmailId
WHERE a.characterId IS NOT NULL
GROUP BY a.characterId, toDate(k.killmailTime)

UNION ALL

SELECT
  'corporation' as entity_type,
  assumeNotNull(a.corporationId) as entity_id,
  toDate(k.killmailTime) as killmail_date,
  count() as kills
FROM edk.killmails k
JOIN edk.attackers a ON k.killmailId = a.killmailId
WHERE a.corporationId IS NOT NULL
GROUP BY a.corporationId, toDate(k.killmailTime)

UNION ALL

SELECT
  'alliance' as entity_type,
  assumeNotNull(a.allianceId) as entity_id,
  toDate(k.killmailTime) as killmail_date,
  count() as kills
FROM edk.killmails k
JOIN edk.attackers a ON k.killmailId = a.killmailId
WHERE a.allianceId IS NOT NULL
GROUP BY a.allianceId, toDate(k.killmailTime)

UNION ALL

SELECT
  'system' as entity_type,
  k.solarSystemId as entity_id,
  toDate(k.killmailTime) as killmail_date,
  count() as kills
FROM edk.killmails k
GROUP BY k.solarSystemId, toDate(k.killmailTime)

UNION ALL

SELECT
  'region' as entity_type,
  assumeNotNull(sys.regionId) as entity_id,
  toDate(k.killmailTime) as killmail_date,
  count() as kills
FROM edk.killmails k
JOIN edk.mapSolarSystems sys ON k.solarSystemId = sys.solarSystemId
WHERE sys.regionId IS NOT NULL
GROUP BY sys.regionId, toDate(k.killmailTime);

-- ============================================================================
-- MOST VALUABLE KILLS FRONTPAGE MATERIALIZED VIEW
-- ============================================================================

-- Most Valuable Kills - Top killmails by total value (last 7 days)
-- Pre-joins all entity names for fast display on frontpage

-- First create the target table
DROP TABLE IF EXISTS most_valuable_kills_frontpage;
CREATE TABLE IF NOT EXISTS most_valuable_kills_frontpage
(
  killmail_id UInt32,
  killmail_time DateTime,
  total_value Float64,

  -- Victim ship
  victim_ship_type_id UInt32,
  victim_ship_name String,

  -- Victim character
  victim_character_id Nullable(UInt32),
  victim_character_name String,

  -- Victim corporation
  victim_corporation_id UInt32,
  victim_corporation_ticker String,

  version UInt64
)
ENGINE = ReplacingMergeTree(version)
ORDER BY (total_value, killmail_time, killmail_id)
PARTITION BY toYYYYMM(killmail_time);

-- Then create the materialized view that feeds the table
DROP TABLE IF EXISTS most_valuable_kills_frontpage_mv;
CREATE MATERIALIZED VIEW IF NOT EXISTS most_valuable_kills_frontpage_mv
TO most_valuable_kills_frontpage
AS
SELECT
  k.killmailId as killmail_id,
  k.killmailTime as killmail_time,

  -- Calculate total value (ship + items)
  coalesce(p_ship.average_price, 0.0) +
  coalesce(items_agg.dropped_value, 0.0) +
  coalesce(items_agg.destroyed_value, 0.0) as total_value,

  -- Victim ship info
  k.victimShipTypeId as victim_ship_type_id,
  coalesce(t_victim.name, 'Unknown') as victim_ship_name,

  -- Victim character
  k.victimCharacterId as victim_character_id,
  coalesce(c_victim.name, nc_victim.name, 'Unknown') as victim_character_name,

  -- Victim corporation
  k.victimCorporationId as victim_corporation_id,
  coalesce(corp_victim.ticker, npc_corp_victim.tickerName, '???') as victim_corporation_ticker,

  k.version as version

FROM edk.killmails k

-- Join victim ship type
LEFT JOIN edk.types t_victim ON k.victimShipTypeId = t_victim.typeId

-- Join victim character (player or NPC)
LEFT JOIN edk.characters c_victim ON k.victimCharacterId = c_victim.character_id
LEFT JOIN edk.npcCharacters nc_victim ON k.victimCharacterId = nc_victim.characterId

-- Join victim corporation (player or NPC)
LEFT JOIN edk.corporations corp_victim ON k.victimCorporationId = corp_victim.corporation_id
LEFT JOIN edk.npcCorporations npc_corp_victim ON k.victimCorporationId = npc_corp_victim.corporationId

-- Join ship price
LEFT JOIN (
  SELECT
    type_id,
    argMax(average_price, version) as average_price
  FROM edk.prices
  WHERE region_id = 10000002
  AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
  GROUP BY type_id
) p_ship ON k.victimShipTypeId = p_ship.type_id

-- Aggregate items values
LEFT JOIN (
  SELECT
    i.killmailId,
    sum(coalesce(p.average_price, 0.0) * i.quantityDropped) as dropped_value,
    sum(coalesce(p.average_price, 0.0) * i.quantityDestroyed) as destroyed_value
  FROM edk.items i
  LEFT JOIN (
    SELECT
      type_id,
      argMax(average_price, version) as average_price
    FROM edk.prices
    WHERE region_id = 10000002
    AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
    GROUP BY type_id
  ) p ON i.itemTypeId = p.type_id
  GROUP BY i.killmailId
) items_agg ON k.killmailId = items_agg.killmailId;

-- Populate the table with existing data (one-time operation)
INSERT INTO most_valuable_kills_frontpage
SELECT
  k.killmailId as killmail_id,
  k.killmailTime as killmail_time,

  coalesce(p_ship.average_price, 0.0) +
  coalesce(items_agg.dropped_value, 0.0) +
  coalesce(items_agg.destroyed_value, 0.0) as total_value,

  k.victimShipTypeId as victim_ship_type_id,
  coalesce(t_victim.name, 'Unknown') as victim_ship_name,

  k.victimCharacterId as victim_character_id,
  coalesce(c_victim.name, nc_victim.name, 'Unknown') as victim_character_name,

  k.victimCorporationId as victim_corporation_id,
  coalesce(corp_victim.ticker, npc_corp_victim.tickerName, '???') as victim_corporation_ticker,

  k.version as version

FROM edk.killmails k
LEFT JOIN edk.types t_victim ON k.victimShipTypeId = t_victim.typeId
LEFT JOIN edk.characters c_victim ON k.victimCharacterId = c_victim.character_id
LEFT JOIN edk.npcCharacters nc_victim ON k.victimCharacterId = nc_victim.characterId
LEFT JOIN edk.corporations corp_victim ON k.victimCorporationId = corp_victim.corporation_id
LEFT JOIN edk.npcCorporations npc_corp_victim ON k.victimCorporationId = npc_corp_victim.corporationId
LEFT JOIN (
  SELECT
    type_id,
    argMax(average_price, version) as average_price
  FROM edk.prices
  WHERE region_id = 10000002
  AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
  GROUP BY type_id
) p_ship ON k.victimShipTypeId = p_ship.type_id
LEFT JOIN (
  SELECT
    i.killmailId,
    sum(coalesce(p.average_price, 0.0) * i.quantityDropped) as dropped_value,
    sum(coalesce(p.average_price, 0.0) * i.quantityDestroyed) as destroyed_value
  FROM edk.items i
  LEFT JOIN (
    SELECT
      type_id,
      argMax(average_price, version) as average_price
    FROM edk.prices
    WHERE region_id = 10000002
    AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
    GROUP BY type_id
  ) p ON i.itemTypeId = p.type_id
  GROUP BY i.killmailId
) items_agg ON k.killmailId = items_agg.killmailId;

-- ============================================================================
-- ENTITY KILLLIST MATERIALIZED VIEW
-- ============================================================================
-- This view denormalizes killmail data specifically for entity pages
-- (character, corporation, alliance)
--
-- It includes ALL killmail information with full names and values
-- for both the entity as victim AND for top statistics queries
--
-- Key design decisions:
-- - Includes both victim and attacker information for flexibility
-- - Denormalized ship groups for quick top X queries
-- - All price data and names pre-computed
-- - Partitioned by time for optimal query performance

DROP TABLE IF EXISTS entity_killlist_mv;
DROP TABLE IF EXISTS entity_killlist;
DROP VIEW IF EXISTS entity_killlist;

CREATE MATERIALIZED VIEW IF NOT EXISTS entity_killlist
ENGINE = ReplacingMergeTree(version)
ORDER BY (killmail_time, killmail_id)
PARTITION BY toYYYYMM(killmail_time)
POPULATE
AS
SELECT
  k.killmailId as killmail_id,
  k.killmailTime as killmail_time,
  k.version as version,
  1 as is_kill,

  -- VICTIM DATA
  k.victimCharacterId as victim_character_id,
  coalesce(c_victim.name, nc_victim.name, 'Unknown') as victim_character_name,

  k.victimCorporationId as victim_corporation_id,
  coalesce(corp_victim.name, npc_corp_victim.name, 'Unknown') as victim_corporation_name,
  coalesce(corp_victim.ticker, npc_corp_victim.tickerName, '???') as victim_corporation_ticker,

  k.victimAllianceId as victim_alliance_id,
  coalesce(a_victim.name, 'Unknown') as victim_alliance_name,
  coalesce(a_victim.ticker, '???') as victim_alliance_ticker,

  k.victimShipTypeId as victim_ship_type_id,
  coalesce(t_victim.name, 'Unknown') as victim_ship_name,
  coalesce(g_victim.name, 'Unknown') as victim_ship_group,
  coalesce(g_victim.groupId, 0) as victim_ship_group_id,

  -- ATTACKER DATA
  fb.characterId as attacker_character_id,
  coalesce(c_attacker.name, nc_attacker.name, 'Unknown') as attacker_character_name,

  fb.corporationId as attacker_corporation_id,
  coalesce(corp_attacker.name, npc_corp_attacker.name, 'Unknown') as attacker_corporation_name,
  coalesce(corp_attacker.ticker, npc_corp_attacker.tickerName, '???') as attacker_corporation_ticker,

  fb.allianceId as attacker_alliance_id,
  coalesce(a_attacker.name, 'Unknown') as attacker_alliance_name,
  coalesce(a_attacker.ticker, '???') as attacker_alliance_ticker,

  fb.shipTypeId as attacker_ship_type_id,
  coalesce(t_attacker.name, 'Unknown') as attacker_ship_name,
  coalesce(g_attacker.name, 'Unknown') as attacker_ship_group,
  coalesce(g_attacker.groupId, 0) as attacker_ship_group_id,

  -- LOCATION DATA
  k.solarSystemId as solar_system_id,
  coalesce(sys.name, 'Unknown') as solar_system_name,
  coalesce(sys.securityStatus, 0.0) as solar_system_security,
  coalesce(sys.regionId, 0) as region_id,
  coalesce(reg.name, 'Unknown') as region_name,

  -- VALUE DATA
  coalesce(p_victim_ship.average_price, 0.0) as victim_ship_value,
  coalesce(p_attacker_ship.average_price, 0.0) as attacker_ship_value,
  coalesce(items_agg.dropped_value, 0.0) as items_dropped_value,
  coalesce(items_agg.destroyed_value, 0.0) as items_destroyed_value,
  coalesce(p_victim_ship.average_price, 0.0) +
  coalesce(items_agg.dropped_value, 0.0) +
  coalesce(items_agg.destroyed_value, 0.0) as total_value,

  -- STATS DATA
  attacker_stats.attacker_count as attacker_count,
  (attacker_stats.attacker_count = 1 AND fb.characterId IS NOT NULL) as is_solo,
  attacker_stats.is_npc as is_npc_kill,

  -- FILTER FLAGS (for optimized killlist queries)
  -- Space type classification (highsec/lowsec/nullsec/w-space/abyssal/pochven)
  CASE
    WHEN coalesce(sys.regionId, 0) >= 11000001 AND coalesce(sys.regionId, 0) <= 11000033 THEN 'w-space'
    WHEN coalesce(sys.regionId, 0) >= 12000000 AND coalesce(sys.regionId, 0) < 13000000 THEN 'abyssal'
    WHEN coalesce(sys.regionId, 0) = 10000070 THEN 'pochven'
    WHEN coalesce(sys.securityStatus, 0.0) >= 0.45 THEN 'highsec'
    WHEN coalesce(sys.securityStatus, 0.0) > 0.0 THEN 'lowsec'
    ELSE 'nullsec'
  END as space_type,
  -- Big kills flag (victim in major capital groups)
  (coalesce(g_victim.groupId, 0) IN (547, 485, 513, 902, 941, 30, 659)) as is_big_kill

FROM edk.killmails k

LEFT JOIN edk.attackers fb ON k.killmailId = fb.killmailId AND fb.finalBlow = 1

LEFT JOIN (
  SELECT
    killmailId,
    count() as attacker_count,
    countIf(characterId IS NULL) = count() as is_npc
  FROM edk.attackers
  GROUP BY killmailId
) attacker_stats ON k.killmailId = attacker_stats.killmailId

LEFT JOIN edk.types t_victim ON k.victimShipTypeId = t_victim.typeId
LEFT JOIN edk.groups g_victim ON t_victim.groupId = g_victim.groupId

LEFT JOIN edk.characters c_victim ON k.victimCharacterId = c_victim.character_id
LEFT JOIN edk.npcCharacters nc_victim ON k.victimCharacterId = nc_victim.characterId

LEFT JOIN edk.corporations corp_victim ON k.victimCorporationId = corp_victim.corporation_id
LEFT JOIN edk.npcCorporations npc_corp_victim ON k.victimCorporationId = npc_corp_victim.corporationId

LEFT JOIN edk.alliances a_victim ON k.victimAllianceId = a_victim.alliance_id

LEFT JOIN (
  SELECT
    type_id,
    argMax(average_price, version) as average_price
  FROM edk.prices
  WHERE region_id = 10000002
  AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
  GROUP BY type_id
) p_victim_ship ON k.victimShipTypeId = p_victim_ship.type_id

LEFT JOIN edk.types t_attacker ON fb.shipTypeId = t_attacker.typeId
LEFT JOIN edk.groups g_attacker ON t_attacker.groupId = g_attacker.groupId

LEFT JOIN edk.characters c_attacker ON fb.characterId = c_attacker.character_id
LEFT JOIN edk.npcCharacters nc_attacker ON fb.characterId = nc_attacker.characterId

LEFT JOIN edk.corporations corp_attacker ON fb.corporationId = corp_attacker.corporation_id
LEFT JOIN edk.npcCorporations npc_corp_attacker ON fb.corporationId = npc_corp_attacker.corporationId

LEFT JOIN edk.alliances a_attacker ON fb.allianceId = a_attacker.alliance_id

LEFT JOIN (
  SELECT
    type_id,
    argMax(average_price, version) as average_price
  FROM edk.prices
  WHERE region_id = 10000002
  AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
  GROUP BY type_id
) p_attacker_ship ON fb.shipTypeId = p_attacker_ship.type_id

LEFT JOIN edk.mapSolarSystems sys ON k.solarSystemId = sys.solarSystemId
LEFT JOIN edk.mapRegions reg ON sys.regionId = reg.regionId

LEFT JOIN (
  SELECT
    i.killmailId,
    sum(coalesce(p.average_price, 0.0) * i.quantityDropped) as dropped_value,
    sum(coalesce(p.average_price, 0.0) * i.quantityDestroyed) as destroyed_value
  FROM edk.items i
  LEFT JOIN (
    SELECT
      type_id,
      argMax(average_price, version) as average_price
    FROM edk.prices
    WHERE region_id = 10000002
    AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
    GROUP BY type_id
  ) p ON i.itemTypeId = p.type_id
  GROUP BY i.killmailId
) items_agg ON k.killmailId = items_agg.killmailId;

-- ============================================================================
-- ENTITY STATS MATERIALIZED VIEWS
-- Pre-calculated statistics for characters, corporations, and alliances
-- Automatically updated via materialized views when new killmails are stored
-- ============================================================================

-- Character stats - automatically creates and updates entity_stats_character table
DROP TABLE IF EXISTS entity_stats_character;
CREATE MATERIALIZED VIEW IF NOT EXISTS entity_stats_character
ENGINE = ReplacingMergeTree(version)
ORDER BY character_id
AS
-- Get kills (where character was final blow attacker)
SELECT
  assumeNotNull(a.characterId) as character_id,
  toUInt32(now()) as version,
  count() as kills,
  0 as losses,
  sum(coalesce(p_ship.average_price, 0.0) +
      coalesce(items_agg.dropped_value, 0.0) +
      coalesce(items_agg.destroyed_value, 0.0)) as isk_destroyed,
  0 as isk_lost,
  0 as efficiency,
  0 as kill_loss_ratio
FROM edk.killmails k
JOIN edk.attackers a ON k.killmailId = a.killmailId AND a.finalBlow = 1
LEFT JOIN edk.types t ON k.victimShipTypeId = t.typeId
LEFT JOIN (
  SELECT
    type_id,
    argMax(average_price, version) as average_price
  FROM edk.prices
  WHERE region_id = 10000002
  AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
  GROUP BY type_id
) p_ship ON k.victimShipTypeId = p_ship.type_id
LEFT JOIN (
  SELECT
    killmailId,
    sum(coalesce(p.average_price, 0.0) * quantityDropped) as dropped_value,
    sum(coalesce(p.average_price, 0.0) * quantityDestroyed) as destroyed_value
  FROM edk.items i
  LEFT JOIN (
    SELECT
      type_id,
      argMax(average_price, version) as average_price
    FROM edk.prices
    WHERE region_id = 10000002
    AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
    GROUP BY type_id
  ) p ON i.itemTypeId = p.type_id
  GROUP BY killmailId
) items_agg ON k.killmailId = items_agg.killmailId
WHERE a.characterId IS NOT NULL
GROUP BY character_id
UNION ALL
-- Get losses (where character was victim)
SELECT
  assumeNotNull(k.victimCharacterId) as character_id,
  toUInt32(now()) as version,
  0 as kills,
  count() as losses,
  0 as isk_destroyed,
  sum(coalesce(p_ship.average_price, 0.0) +
      coalesce(items_agg.dropped_value, 0.0) +
      coalesce(items_agg.destroyed_value, 0.0)) as isk_lost,
  0 as efficiency,
  0 as kill_loss_ratio
FROM edk.killmails k
LEFT JOIN edk.types t ON k.victimShipTypeId = t.typeId
LEFT JOIN (
  SELECT
    type_id,
    argMax(average_price, version) as average_price
  FROM edk.prices
  WHERE region_id = 10000002
  AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
  GROUP BY type_id
) p_ship ON k.victimShipTypeId = p_ship.type_id
LEFT JOIN (
  SELECT
    killmailId,
    sum(coalesce(p.average_price, 0.0) * quantityDropped) as dropped_value,
    sum(coalesce(p.average_price, 0.0) * quantityDestroyed) as destroyed_value
  FROM edk.items i
  LEFT JOIN (
    SELECT
      type_id,
      argMax(average_price, version) as average_price
    FROM edk.prices
    WHERE region_id = 10000002
    AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
    GROUP BY type_id
  ) p ON i.itemTypeId = p.type_id
  GROUP BY killmailId
) items_agg ON k.killmailId = items_agg.killmailId
WHERE k.victimCharacterId IS NOT NULL
GROUP BY character_id;

-- Corporation stats - automatically creates and updates entity_stats_corporation table
DROP TABLE IF EXISTS entity_stats_corporation;
CREATE MATERIALIZED VIEW IF NOT EXISTS entity_stats_corporation
ENGINE = ReplacingMergeTree(version)
ORDER BY corporation_id
AS
-- Get kills (where corporation was final blow attacker)
SELECT
  assumeNotNull(a.corporationId) as corporation_id,
  toUInt32(now()) as version,
  count() as kills,
  0 as losses,
  sum(coalesce(p_ship.average_price, 0.0) +
      coalesce(items_agg.dropped_value, 0.0) +
      coalesce(items_agg.destroyed_value, 0.0)) as isk_destroyed,
  0 as isk_lost,
  0 as efficiency,
  0 as kill_loss_ratio
FROM edk.killmails k
JOIN edk.attackers a ON k.killmailId = a.killmailId AND a.finalBlow = 1
LEFT JOIN edk.types t ON k.victimShipTypeId = t.typeId
LEFT JOIN (
  SELECT
    type_id,
    argMax(average_price, version) as average_price
  FROM edk.prices
  WHERE region_id = 10000002
  AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
  GROUP BY type_id
) p_ship ON k.victimShipTypeId = p_ship.type_id
LEFT JOIN (
  SELECT
    killmailId,
    sum(coalesce(p.average_price, 0.0) * quantityDropped) as dropped_value,
    sum(coalesce(p.average_price, 0.0) * quantityDestroyed) as destroyed_value
  FROM edk.items i
  LEFT JOIN (
    SELECT
      type_id,
      argMax(average_price, version) as average_price
    FROM edk.prices
    WHERE region_id = 10000002
    AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
    GROUP BY type_id
  ) p ON i.itemTypeId = p.type_id
  GROUP BY killmailId
) items_agg ON k.killmailId = items_agg.killmailId
WHERE a.corporationId IS NOT NULL
GROUP BY corporation_id
UNION ALL
-- Get losses (where corporation was victim)
SELECT
  assumeNotNull(k.victimCorporationId) as corporation_id,
  toUInt32(now()) as version,
  0 as kills,
  count() as losses,
  0 as isk_destroyed,
  sum(coalesce(p_ship.average_price, 0.0) +
      coalesce(items_agg.dropped_value, 0.0) +
      coalesce(items_agg.destroyed_value, 0.0)) as isk_lost,
  0 as efficiency,
  0 as kill_loss_ratio
FROM edk.killmails k
LEFT JOIN edk.types t ON k.victimShipTypeId = t.typeId
LEFT JOIN (
  SELECT
    type_id,
    argMax(average_price, version) as average_price
  FROM edk.prices
  WHERE region_id = 10000002
  AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
  GROUP BY type_id
) p_ship ON k.victimShipTypeId = p_ship.type_id
LEFT JOIN (
  SELECT
    killmailId,
    sum(coalesce(p.average_price, 0.0) * quantityDropped) as dropped_value,
    sum(coalesce(p.average_price, 0.0) * quantityDestroyed) as destroyed_value
  FROM edk.items i
  LEFT JOIN (
    SELECT
      type_id,
      argMax(average_price, version) as average_price
    FROM edk.prices
    WHERE region_id = 10000002
    AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
    GROUP BY type_id
  ) p ON i.itemTypeId = p.type_id
  GROUP BY killmailId
) items_agg ON k.killmailId = items_agg.killmailId
WHERE k.victimCorporationId IS NOT NULL
GROUP BY corporation_id;

-- Alliance stats - automatically creates and updates entity_stats_alliance table
DROP TABLE IF EXISTS entity_stats_alliance;
CREATE MATERIALIZED VIEW IF NOT EXISTS entity_stats_alliance
ENGINE = ReplacingMergeTree(version)
ORDER BY alliance_id
AS
-- Get kills (where alliance was final blow attacker)
SELECT
  assumeNotNull(a.allianceId) as alliance_id,
  toUInt32(now()) as version,
  count() as kills,
  0 as losses,
  sum(coalesce(p_ship.average_price, 0.0) +
      coalesce(items_agg.dropped_value, 0.0) +
      coalesce(items_agg.destroyed_value, 0.0)) as isk_destroyed,
  0 as isk_lost,
  0 as efficiency,
  0 as kill_loss_ratio
FROM edk.killmails k
JOIN edk.attackers a ON k.killmailId = a.killmailId AND a.finalBlow = 1
LEFT JOIN edk.types t ON k.victimShipTypeId = t.typeId
LEFT JOIN (
  SELECT
    type_id,
    argMax(average_price, version) as average_price
  FROM edk.prices
  WHERE region_id = 10000002
  AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
  GROUP BY type_id
) p_ship ON k.victimShipTypeId = p_ship.type_id
LEFT JOIN (
  SELECT
    killmailId,
    sum(coalesce(p.average_price, 0.0) * quantityDropped) as dropped_value,
    sum(coalesce(p.average_price, 0.0) * quantityDestroyed) as destroyed_value
  FROM edk.items i
  LEFT JOIN (
    SELECT
      type_id,
      argMax(average_price, version) as average_price
    FROM edk.prices
    WHERE region_id = 10000002
    AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
    GROUP BY type_id
  ) p ON i.itemTypeId = p.type_id
  GROUP BY killmailId
) items_agg ON k.killmailId = items_agg.killmailId
WHERE a.allianceId IS NOT NULL
GROUP BY alliance_id
UNION ALL
-- Get losses (where alliance was victim)
SELECT
  assumeNotNull(k.victimAllianceId) as alliance_id,
  toUInt32(now()) as version,
  0 as kills,
  count() as losses,
  0 as isk_destroyed,
  sum(coalesce(p_ship.average_price, 0.0) +
      coalesce(items_agg.dropped_value, 0.0) +
      coalesce(items_agg.destroyed_value, 0.0)) as isk_lost,
  0 as efficiency,
  0 as kill_loss_ratio
FROM edk.killmails k
LEFT JOIN edk.types t ON k.victimShipTypeId = t.typeId
LEFT JOIN (
  SELECT
    type_id,
    argMax(average_price, version) as average_price
  FROM edk.prices
  WHERE region_id = 10000002
  AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
  GROUP BY type_id
) p_ship ON k.victimShipTypeId = p_ship.type_id
LEFT JOIN (
  SELECT
    killmailId,
    sum(coalesce(p.average_price, 0.0) * quantityDropped) as dropped_value,
    sum(coalesce(p.average_price, 0.0) * quantityDestroyed) as destroyed_value
  FROM edk.items i
  LEFT JOIN (
    SELECT
      type_id,
      argMax(average_price, version) as average_price
    FROM edk.prices
    WHERE region_id = 10000002
    AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
    GROUP BY type_id
  ) p ON i.itemTypeId = p.type_id
  GROUP BY killmailId
) items_agg ON k.killmailId = items_agg.killmailId
WHERE k.victimAllianceId IS NOT NULL
GROUP BY alliance_id;

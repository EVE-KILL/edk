USE edk;

-- ============================================================================
-- CORE KILLMAIL TABLES (OPTIMIZED)
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

  -- Denormalized attacker info (top/final blow attacker)
  topAttackerCharacterId Nullable(UInt32),
  topAttackerCorporationId Nullable(UInt32),
  topAttackerAllianceId Nullable(UInt32),
  topAttackerShipTypeId Nullable(UInt32),

  -- Aggregate stats
  totalValue Float64 DEFAULT 0,
  attackerCount UInt16 DEFAULT 0,

  -- Flags
  npc Boolean DEFAULT false,
  solo Boolean DEFAULT false,
  awox Boolean DEFAULT false,

  createdAt DateTime DEFAULT now(),

  INDEX idx_solar_system (solarSystemId) TYPE minmax GRANULARITY 3,
  INDEX idx_victim_character (victimCharacterId) TYPE minmax GRANULARITY 3,
  INDEX idx_victim_corporation (victimCorporationId) TYPE minmax GRANULARITY 3,
  INDEX idx_victim_alliance (victimAllianceId) TYPE minmax GRANULARITY 3,
  INDEX idx_victim_ship_type (victimShipTypeId) TYPE minmax GRANULARITY 3,
  INDEX idx_victim_damage_taken (victimDamageTaken) TYPE minmax GRANULARITY 3,
  INDEX idx_total_value (totalValue) TYPE minmax GRANULARITY 3,
  version UInt64
) ENGINE = ReplacingMergeTree(version)
ORDER BY (killmailTime, killmailId)
PARTITION BY toYYYYMM(killmailTime);

-- Attackers table - OPTIMIZED: Added killmail_time field, partitioned by killmail_time
CREATE TABLE IF NOT EXISTS attackers (
  killmailId UInt32 NOT NULL,
  killmailTime DateTime NOT NULL, -- NEW: Added for consistent partitioning
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
PARTITION BY toYYYYMM(killmailTime); -- CHANGED: from createdAt to killmailTime

-- Items table - OPTIMIZED: Added killmail_time field, partitioned by killmail_time
CREATE TABLE IF NOT EXISTS items (
  killmailId UInt32 NOT NULL,
  killmailTime DateTime NOT NULL, -- NEW: Added for consistent partitioning
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
PARTITION BY toYYYYMM(killmailTime); -- CHANGED: from createdAt to killmailTime

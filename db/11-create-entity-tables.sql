USE edk;

-- ============================================================================
-- ENTITY TABLES (Player Characters, Corporations, Alliances)
-- ============================================================================

-- Player Characters - Stores ESI character data
CREATE TABLE IF NOT EXISTS characters (
  characterId UInt32 NOT NULL,
  allianceId Nullable(UInt32),
  birthday String,
  bloodlineId UInt32,
  corporationId UInt32,
  description String,
  gender String,
  name String,
  raceId UInt32,
  securityStatus Float32,
  updatedAt DateTime DEFAULT now(),
  version UInt64,

  INDEX idx_alliance (allianceId) TYPE minmax GRANULARITY 3,
  INDEX idx_corporation (corporationId) TYPE minmax GRANULARITY 3,
  INDEX idx_bloodline (bloodlineId) TYPE minmax GRANULARITY 3,
  INDEX idx_race (raceId) TYPE minmax GRANULARITY 3
) ENGINE = ReplacingMergeTree(version)
ORDER BY characterId;

-- Player Corporations - Stores ESI corporation data
CREATE TABLE IF NOT EXISTS corporations (
  corporationId UInt32 NOT NULL,
  allianceId Nullable(UInt32),
  ceoId UInt32,
  creatorId UInt32,
  dateFounded String,
  description String,
  homeStationId Nullable(UInt32),
  memberCount UInt32,
  name String,
  shares UInt64,
  taxRate Float32,
  ticker String,
  url String,
  updatedAt DateTime DEFAULT now(),
  version UInt64,

  INDEX idx_alliance (allianceId) TYPE minmax GRANULARITY 3,
  INDEX idx_ceo (ceoId) TYPE minmax GRANULARITY 3,
  INDEX idx_creator (creatorId) TYPE minmax GRANULARITY 3
) ENGINE = ReplacingMergeTree(version)
ORDER BY corporationId;

-- Player Alliances - Stores ESI alliance data
CREATE TABLE IF NOT EXISTS alliances (
  allianceId UInt32 NOT NULL,
  creatorCorporationId UInt32,
  creatorId UInt32,
  dateFounded String,
  executorCorporationId UInt32,
  name String,
  ticker String,
  updatedAt DateTime DEFAULT now(),
  version UInt64,

  INDEX idx_creator_corp (creatorCorporationId) TYPE minmax GRANULARITY 3,
  INDEX idx_creator (creatorId) TYPE minmax GRANULARITY 3,
  INDEX idx_executor_corp (executorCorporationId) TYPE minmax GRANULARITY 3
) ENGINE = ReplacingMergeTree(version)
ORDER BY allianceId;

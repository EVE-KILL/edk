-- SDE NPC Tables
-- NPC corporations, stations, characters

-- NPC Corporations table
CREATE TABLE IF NOT EXISTS npcCorporations (
    corporationId UInt32,
    name String,
    description Nullable(String),
    ceoId Nullable(UInt32),
    factionId Nullable(UInt32),
    solarSystemId Nullable(UInt32),
    stationId Nullable(UInt32),
    taxRate Nullable(Float32),
    tickerName Nullable(String),
    deleted UInt8,
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY corporationId
SETTINGS index_granularity = 16;

-- NPC Stations table
CREATE TABLE IF NOT EXISTS npcStations (
    stationId UInt32,
    name String,
    solarSystemId UInt32,
    typeId UInt32,
    ownerIds Array(UInt32),
    celestialIndex Nullable(UInt16),
    operationId Nullable(UInt32),
    orbitId Nullable(UInt32),
    orbitIndex Nullable(UInt16),
    positionX Nullable(Float64),
    positionY Nullable(Float64),
    positionZ Nullable(Float64),
    reprocessingEfficiency Nullable(Float32),
    reprocessingStationsTake Nullable(Float32),
    useOperationName UInt8,
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY stationId
SETTINGS index_granularity = 16;

-- NPC Characters table (for generated kill reports)
CREATE TABLE IF NOT EXISTS npcCharacters (
    characterId UInt32,
    name String,
    corporationId Nullable(UInt32),
    allianceId Nullable(UInt32),
    bloodlineId Nullable(UInt32),
    ancestryId Nullable(UInt32),
    gender Nullable(UInt8),
    raceId Nullable(UInt32),
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY characterId
SETTINGS index_granularity = 16;


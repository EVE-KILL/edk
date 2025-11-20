-- SDE Character/Faction Tables
-- Factions, races, bloodlines, ancestries

-- Factions table
CREATE TABLE IF NOT EXISTS factions (
    factionId UInt32,
    name String,
    description Nullable(String),
    shortDescription Nullable(String),
    corporationId Nullable(UInt32),
    militiaCorporationId Nullable(UInt32),
    solarSystemId Nullable(UInt32),
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY factionId
SETTINGS index_granularity = 16;

-- Races table
CREATE TABLE IF NOT EXISTS races (
    raceId UInt32,
    name String,
    description Nullable(String),
    iconId Nullable(UInt32),
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY raceId
SETTINGS index_granularity = 16;

-- Bloodlines table
CREATE TABLE IF NOT EXISTS bloodlines (
    bloodlineId UInt32,
    name String,
    description Nullable(String),
    raceId UInt32,
    shipTypeId Nullable(UInt32),
    corporationId Nullable(UInt32),
    charisma Nullable(UInt8),
    constitution Nullable(UInt8),
    intelligence Nullable(UInt8),
    memory Nullable(UInt8),
    perception Nullable(UInt8),
    willpower Nullable(UInt8),
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY bloodlineId
SETTINGS index_granularity = 16;

-- Ancestries table
CREATE TABLE IF NOT EXISTS ancestries (
    ancestryId UInt32,
    name String,
    bloodlineId UInt32,
    description Nullable(String),
    iconId Nullable(UInt32),
    shortDescription Nullable(String),
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY ancestryId
SETTINGS index_granularity = 16;


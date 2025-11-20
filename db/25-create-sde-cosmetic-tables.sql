-- SDE Cosmetic Tables
-- Skins and other cosmetic items

-- Skins table
CREATE TABLE IF NOT EXISTS skins (
    skinId UInt32,
    name String,
    description Nullable(String),
    iconId Nullable(UInt32),
    internalName Nullable(String),
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY skinId
SETTINGS index_granularity = 16;

-- Station Operations table (for station services)
CREATE TABLE IF NOT EXISTS stationOperations (
    operationId UInt32,
    name String,
    description Nullable(String),
    activityId Nullable(UInt32),
    border Nullable(Float32),
    corridor Nullable(Float32),
    fringe Nullable(Float32),
    hub Nullable(Float32),
    manufacturingFactor Nullable(Float32),
    ratio Nullable(Float32),
    researchFactor Nullable(Float32),
    stationType Nullable(String),
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY operationId
SETTINGS index_granularity = 16;


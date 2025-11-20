-- SDE Type System Tables
-- Types, groups, categories, market groups, meta groups

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    categoryId UInt32,
    name String,
    iconId Nullable(UInt32),
    published UInt8,
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY categoryId
SETTINGS index_granularity = 16;

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
    groupId UInt32,
    name String,
    categoryId UInt32,
    iconId Nullable(UInt32),
    published UInt8,
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY groupId
SETTINGS index_granularity = 16;

-- Types table
CREATE TABLE IF NOT EXISTS types (
    typeId UInt32,
    name String,
    description String,
    groupId UInt32,
    capacity Nullable(Float64),
    factionId Nullable(UInt32),
    graphicId Nullable(UInt32),
    iconId Nullable(UInt32),
    marketGroupId Nullable(UInt32),
    mass Nullable(Float64),
    metaGroupId Nullable(UInt32),
    portionSize Nullable(UInt32),
    published UInt8,
    raceId Nullable(UInt32),
    radius Nullable(Float64),
    soundId Nullable(UInt32),
    volume Nullable(Float64),
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY typeId
SETTINGS index_granularity = 16;

-- Market Groups table
CREATE TABLE IF NOT EXISTS marketGroups (
    marketGroupId UInt32,
    name String,
    description Nullable(String),
    iconId Nullable(UInt32),
    hasTypes UInt8,
    parentGroupId Nullable(UInt32),
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY marketGroupId
SETTINGS index_granularity = 16;

-- Meta Groups table
CREATE TABLE IF NOT EXISTS metaGroups (
    metaGroupId UInt32,
    name String,
    description Nullable(String),
    iconId Nullable(UInt32),
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY metaGroupId
SETTINGS index_granularity = 16;


-- SDE Dogma Tables
-- Dogma attributes and effects for item stats

-- Dogma Attributes table
CREATE TABLE IF NOT EXISTS dogmaAttributes (
    attributeId UInt32,
    name String,
    categoryId Nullable(UInt32),
    defaultValue Nullable(Float64),
    description Nullable(String),
    displayName Nullable(String),
    iconId Nullable(UInt32),
    highIsGood UInt8,
    published UInt8,
    stackable UInt8,
    unitId Nullable(UInt32),
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY attributeId
SETTINGS index_granularity = 16;

-- Dogma Effects table
CREATE TABLE IF NOT EXISTS dogmaEffects (
    effectId UInt32,
    name String,
    categoryId Nullable(UInt32),
    description Nullable(String),
    disallowAutoRepeat UInt8,
    dischargeAttributeId Nullable(UInt32),
    displayName Nullable(String),
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
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY effectId
SETTINGS index_granularity = 16;


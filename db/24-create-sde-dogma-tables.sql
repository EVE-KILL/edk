-- SDE Dogma Tables
-- Dogma attributes and effects for item stats

-- Dogma Attributes table
CREATE TABLE IF NOT EXISTS dogmaAttributes (
    attributeId INTEGER PRIMARY KEY,
    name TEXT,
    categoryId INTEGER,
    defaultValue DOUBLE PRECISION,
    description TEXT,
    displayName TEXT,
    iconId INTEGER,
    highIsGood BOOLEAN,
    published BOOLEAN,
    stackable BOOLEAN,
    unitId INTEGER,
    version INTEGER
);

-- Dogma Effects table
CREATE TABLE IF NOT EXISTS dogmaEffects (
    effectId INTEGER PRIMARY KEY,
    name TEXT,
    categoryId INTEGER,
    description TEXT,
    disallowAutoRepeat BOOLEAN,
    dischargeAttributeId INTEGER,
    displayName TEXT,
    durationAttributeId INTEGER,
    effectCategory TEXT,
    falloffAttributeId INTEGER,
    fittingUsageChanceAttributeId INTEGER,
    iconId INTEGER,
    isAssistance BOOLEAN,
    isOffensive BOOLEAN,
    isWarpSafe BOOLEAN,
    neurotoxinId INTEGER,
    npcActivationChanceAttributeId INTEGER,
    npcUsageChanceAttributeId INTEGER,
    published BOOLEAN,
    rangeAttributeId INTEGER,
    resistanceAttributeId INTEGER,
    softPenetrationAttributeId INTEGER,
    trackingSpeedAttributeId INTEGER,
    version INTEGER
);

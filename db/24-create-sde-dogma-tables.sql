-- SDE Dogma Tables
-- Dogma attributes and effects for item stats

-- Dogma Attributes table
CREATE TABLE IF NOT EXISTS dogmaAttributes (
    "attributeId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "categoryId" INTEGER,
    "defaultValue" REAL,
    "description" TEXT,
    "displayName" VARCHAR(255),
    "iconId" INTEGER,
    "highIsGood" BOOLEAN,
    "published" BOOLEAN,
    "stackable" BOOLEAN,
    "tooltipDescription" TEXT,
    "tooltipTitle" VARCHAR(255),
    "unitId" INTEGER,
    "version" INTEGER
);

-- Dogma Effects table
CREATE TABLE IF NOT EXISTS dogmaEffects (
    "effectId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "categoryId" INTEGER,
    "description" TEXT,
    "disallowAutoRepeat" BOOLEAN,
    "dischargeAttributeId" INTEGER,
    "displayName" VARCHAR(255),
    "durationAttributeId" INTEGER,
    "effectCategory" VARCHAR(255),
    "falloffAttributeId" INTEGER,
    "fittingUsageChanceAttributeId" INTEGER,
    "iconId" INTEGER,
    "isAssistance" BOOLEAN,
    "isOffensive" BOOLEAN,
    "isWarpSafe" BOOLEAN,
    "neurotoxinId" INTEGER,
    "npcActivationChanceAttributeId" INTEGER,
    "npcUsageChanceAttributeId" INTEGER,
    "published" BOOLEAN,
    "rangeAttributeId" INTEGER,
    "resistanceAttributeId" INTEGER,
    "softPenetrationAttributeId" INTEGER,
    "trackingSpeedAttributeId" INTEGER,
    "version" INTEGER
);

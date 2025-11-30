-- SDE Dogma Tables
-- Dogma attributes and effects for item stats

-- Dogma Attributes table
CREATE TABLE IF NOT EXISTS dogmaAttributes (
    "attributeId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "categoryId" INTEGER,
    "defaultValue" DOUBLE PRECISION,
    "description" TEXT,
    "displayName" VARCHAR(255),
    "iconId" INTEGER,
    "highIsGood" BOOLEAN,
    "published" BOOLEAN,
    "stackable" BOOLEAN,
    "tooltipDescription" TEXT,
    "tooltipTitle" VARCHAR(255),
    "unitId" INTEGER
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
    "trackingSpeedAttributeId" INTEGER
);

-- Type Dogma table (attributes per type)
CREATE TABLE IF NOT EXISTS typeDogma (
    "typeId" INTEGER NOT NULL,
    "attributeId" INTEGER NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    PRIMARY KEY ("typeId", "attributeId")
);

CREATE INDEX IF NOT EXISTS idx_typedogma_typeid ON typeDogma("typeId");
CREATE INDEX IF NOT EXISTS idx_typedogma_attributeid ON typeDogma("attributeId");

-- Dogma Units table (attribute units like m, %, etc.)
CREATE TABLE IF NOT EXISTS dogmaunits (
    "unitId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "description" TEXT,
    "displayName" VARCHAR(255)
);

-- Dogma Attribute Categories table
CREATE TABLE IF NOT EXISTS dogmaattributecategories (
    "categoryId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "description" TEXT
);

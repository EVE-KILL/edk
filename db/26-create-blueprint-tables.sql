-- SDE Blueprint & Industry Tables

-- Base type materials (used for reprocessing/build costs)
CREATE TABLE IF NOT EXISTS typeMaterials (
  "typeId" INTEGER NOT NULL,
  "materialTypeId" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  PRIMARY KEY ("typeId", "materialTypeId")
);

CREATE INDEX IF NOT EXISTS "idx_typeMaterials_material" ON typeMaterials ("materialTypeId");

-- Blueprint definitions
CREATE TABLE IF NOT EXISTS blueprints (
  "blueprintTypeId" INTEGER PRIMARY KEY,
  "maxProductionLimit" INTEGER
);

-- Per-activity timing (manufacturing, copying, invention, etc)
CREATE TABLE IF NOT EXISTS blueprintActivities (
  "blueprintTypeId" INTEGER NOT NULL,
  "activity" VARCHAR(64) NOT NULL,
  "time" INTEGER,
  PRIMARY KEY ("blueprintTypeId", "activity")
);

-- Materials required per activity
CREATE TABLE IF NOT EXISTS blueprintMaterials (
  "blueprintTypeId" INTEGER NOT NULL,
  "activity" VARCHAR(64) NOT NULL,
  "materialTypeId" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  PRIMARY KEY ("blueprintTypeId", "activity", "materialTypeId")
);

CREATE INDEX IF NOT EXISTS "idx_blueprintMaterials_material" ON blueprintMaterials ("materialTypeId");

-- Products per activity
CREATE TABLE IF NOT EXISTS blueprintProducts (
  "blueprintTypeId" INTEGER NOT NULL,
  "activity" VARCHAR(64) NOT NULL,
  "productTypeId" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "probability" REAL,
  PRIMARY KEY ("blueprintTypeId", "activity", "productTypeId")
);

CREATE INDEX IF NOT EXISTS "idx_blueprintProducts_product_activity"
  ON blueprintProducts ("productTypeId", "activity");

CREATE INDEX IF NOT EXISTS "idx_blueprintProducts_blueprint"
  ON blueprintProducts ("blueprintTypeId");

-- Skills per activity (invention/manufacturing)
CREATE TABLE IF NOT EXISTS blueprintSkills (
  "blueprintTypeId" INTEGER NOT NULL,
  "activity" VARCHAR(64) NOT NULL,
  "skillTypeId" INTEGER NOT NULL,
  "level" INTEGER NOT NULL,
  PRIMARY KEY ("blueprintTypeId", "activity", "skillTypeId")
);

CREATE INDEX IF NOT EXISTS "idx_blueprintSkills_skill" ON blueprintSkills ("skillTypeId");

-- Miscellaneous game mechanics tables

-- Contraband Types table
CREATE TABLE IF NOT EXISTS contrabandtypes (
    "typeId" INTEGER PRIMARY KEY,
    "factions" JSONB
);

CREATE INDEX IF NOT EXISTS idx_contrabandtypes_factions ON contrabandtypes USING GIN ("factions");

-- Control Tower Resources table (legacy POS)
CREATE TABLE IF NOT EXISTS controltowerresources (
    "controlTowerTypeId" INTEGER PRIMARY KEY,
    "resources" JSONB
);

CREATE INDEX IF NOT EXISTS idx_controltowerresources_resources ON controltowerresources USING GIN ("resources");

-- Dynamic Item Attributes table
CREATE TABLE IF NOT EXISTS dynamicitemattributes (
    "typeId" INTEGER PRIMARY KEY,
    "attributeIds" JSONB,
    "inputOutputMapping" JSONB
);

CREATE INDEX IF NOT EXISTS idx_dynamicitemattributes_attributeids ON dynamicitemattributes USING GIN ("attributeIds");

-- Sovereignty Upgrades table
CREATE TABLE IF NOT EXISTS sovereigntyupgrades (
    "upgradeId" INTEGER PRIMARY KEY,
    "fuel" JSONB,
    "mutuallyExclusiveGroup" INTEGER,
    "powerAllocation" DOUBLE PRECISION,
    "workforceAllocation" DOUBLE PRECISION
);

-- Translation Languages table
CREATE TABLE IF NOT EXISTS translationlanguages (
    "languageId" VARCHAR(10) PRIMARY KEY,
    "name" VARCHAR(255)
);

-- Freelance Job Schemas table
CREATE TABLE IF NOT EXISTS freelancejobschemas (
    "schemaId" INTEGER PRIMARY KEY,
    "schemaData" JSONB
);

CREATE INDEX IF NOT EXISTS idx_freelancejobschemas_schemadata ON freelancejobschemas USING GIN ("schemaData");

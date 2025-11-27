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

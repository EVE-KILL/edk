-- SDE Cosmetic Tables
-- Skins and other cosmetic items

-- Graphics table
CREATE TABLE IF NOT EXISTS graphics (
    "graphicId" INTEGER PRIMARY KEY,
    "graphicFile" TEXT,
    "description" TEXT
);

-- Icons table
CREATE TABLE IF NOT EXISTS icons (
    "iconId" INTEGER PRIMARY KEY,
    "iconFile" TEXT,
    "description" TEXT
);

-- Skins table
CREATE TABLE IF NOT EXISTS skins (
    "skinId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "description" TEXT,
    "iconId" INTEGER,
    "internalName" VARCHAR(255)
);

-- Skin Licenses table (which types can use which skins)
CREATE TABLE IF NOT EXISTS skinlicenses (
    "licenseId" INTEGER PRIMARY KEY,
    "duration" INTEGER,
    "skinId" INTEGER
);

CREATE INDEX IF NOT EXISTS idx_skinlicenses_skinid ON skinlicenses ("skinId");

-- Skin Materials table (visual material definitions)
CREATE TABLE IF NOT EXISTS skinmaterials (
    "skinMaterialId" INTEGER PRIMARY KEY,
    "displayName" TEXT,
    "materialSetId" INTEGER
);

CREATE INDEX IF NOT EXISTS idx_skinmaterials_materialsetid ON skinmaterials ("materialSetId");

-- Station Operations table (for station services)
CREATE TABLE IF NOT EXISTS stationOperations (
    "operationId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "description" TEXT,
    "activityId" INTEGER,
    "border" REAL,
    "corridor" REAL,
    "fringe" REAL,
    "hub" REAL,
    "manufacturingFactor" REAL,
    "ratio" REAL,
    "researchFactor" REAL,
    "stationType" VARCHAR(255)
);

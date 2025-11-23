-- SDE Cosmetic Tables
-- Skins and other cosmetic items

-- Skins table
CREATE TABLE IF NOT EXISTS skins (
    "skinId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "description" TEXT,
    "iconId" INTEGER,
    "internalName" VARCHAR(255)
);

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

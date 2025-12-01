-- Migration: Create missing SDE tables
-- This creates the remaining SDE tables that were not in earlier migrations

-- Buff Collections table (agent boosts)
CREATE TABLE IF NOT EXISTS dbuffcollections (
    "collectionId" INTEGER PRIMARY KEY,
    "displayName" TEXT,
    "aggregateMode" VARCHAR(255),
    "developerDescription" TEXT,
    "operationName" VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_dbuffcollections_displayname ON dbuffcollections ("displayName");

-- Character Attributes table (character customization attributes)
CREATE TABLE IF NOT EXISTS characterattributes (
    "attributeId" INTEGER PRIMARY KEY,
    "name" TEXT,
    "shortDescription" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "iconId" INTEGER
);

CREATE INDEX IF NOT EXISTS idx_characterattributes_name ON characterattributes ("name");
CREATE INDEX IF NOT EXISTS idx_characterattributes_iconid ON characterattributes ("iconId");

-- Corporation Activities table (corporation roles/activities)
CREATE TABLE IF NOT EXISTS corporationactivities (
    "activityId" INTEGER PRIMARY KEY,
    "name" TEXT
);

CREATE INDEX IF NOT EXISTS idx_corporationactivities_name ON corporationactivities ("name");

-- Landmarks table (world locations of interest)
CREATE TABLE IF NOT EXISTS landmarks (
    "landmarkId" INTEGER PRIMARY KEY,
    "name" TEXT,
    "description" TEXT,
    "iconId" INTEGER,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "positionZ" DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_landmarks_name ON landmarks ("name");
CREATE INDEX IF NOT EXISTS idx_landmarks_iconid ON landmarks ("iconId");

-- NPC Corporation Divisions table
CREATE TABLE IF NOT EXISTS npccorporationdivisions (
    "divisionId" INTEGER PRIMARY KEY,
    "name" TEXT,
    "description" TEXT,
    "leaderTypeName" VARCHAR(255),
    "displayName" VARCHAR(255),
    "internalName" VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_npccorporationdivisions_name ON npccorporationdivisions ("name");
CREATE INDEX IF NOT EXISTS idx_npccorporationdivisions_internalname ON npccorporationdivisions ("internalName");

-- Planet Schematics table (PI production schematics)
CREATE TABLE IF NOT EXISTS planetschematics (
    "schematicId" INTEGER PRIMARY KEY,
    "name" TEXT,
    "cycleTime" INTEGER
);

CREATE INDEX IF NOT EXISTS idx_planetschematics_name ON planetschematics ("name");
CREATE INDEX IF NOT EXISTS idx_planetschematics_cycletime ON planetschematics ("cycleTime");

-- Station Services table (note: skinlicenses already exists in migration 25)
CREATE TABLE IF NOT EXISTS stationservices (
    "serviceId" INTEGER PRIMARY KEY,
    "serviceName" TEXT,
    "chargePerUnit" DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_stationservices_servicename ON stationservices ("serviceName");

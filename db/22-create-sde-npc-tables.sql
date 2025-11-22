-- SDE NPC Tables
-- NPC corporations, stations, characters

-- NPC Corporations table
CREATE TABLE IF NOT EXISTS npcCorporations (
    "corporationId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "description" TEXT,
    "ceoId" INTEGER,
    "factionId" INTEGER,
    "solarSystemId" INTEGER,
    "stationId" INTEGER,
    "taxRate" REAL,
    "tickerName" VARCHAR(255),
    "deleted" BOOLEAN
);

-- NPC Stations table
CREATE TABLE IF NOT EXISTS npcStations (
    "stationId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "solarSystemId" INTEGER,
    "typeId" INTEGER,
    "ownerIds" INTEGER[],
    "celestialIndex" INTEGER,
    "operationId" INTEGER,
    "orbitId" INTEGER,
    "orbitIndex" INTEGER,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "positionZ" DOUBLE PRECISION,
    "reprocessingEfficiency" REAL,
    "reprocessingStationsTake" REAL,
    "useOperationName" BOOLEAN
);

-- NPC Characters table (for generated kill reports)
CREATE TABLE IF NOT EXISTS npcCharacters (
    "characterId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "corporationId" INTEGER,
    "allianceId" INTEGER,
    "bloodlineId" INTEGER,
    "ancestryId" INTEGER,
    "gender" INTEGER,
    "raceId" INTEGER
);

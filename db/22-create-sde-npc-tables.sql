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
    "factionId" INTEGER,
    "corporationId" INTEGER,
    "allianceId" INTEGER,
    "bloodlineId" INTEGER,
    "ancestryId" INTEGER,
    "gender" INTEGER,
    "raceId" INTEGER,
    "solarSystemId" INTEGER
);

-- Agent Types table
CREATE TABLE IF NOT EXISTS agenttypes (
    "agentTypeId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255)
);

-- Agents In Space table
CREATE TABLE IF NOT EXISTS agentsinspace (
    "agentId" INTEGER PRIMARY KEY,
    "dungeonId" INTEGER,
    "solarSystemId" INTEGER,
    "spawnPointId" INTEGER,
    "typeId" INTEGER
);

CREATE INDEX IF NOT EXISTS idx_agentsinspace_solarsystemid ON agentsinspace ("solarSystemId");
CREATE INDEX IF NOT EXISTS idx_agentsinspace_typeid ON agentsinspace ("typeId");

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_npccharacters_characterid" ON npcCharacters ("characterId");
CREATE INDEX IF NOT EXISTS "idx_npccorporations_corporationid" ON npcCorporations ("corporationId");

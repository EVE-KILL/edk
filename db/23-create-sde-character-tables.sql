-- SDE Character/Faction Tables
-- Factions, races, bloodlines, ancestries

-- Factions table
CREATE TABLE IF NOT EXISTS factions (
    "factionId" INTEGER PRIMARY KEY,
    "name" TEXT,
    "description" TEXT,
    "shortDescription" TEXT,
    "corporationId" INTEGER,
    "militiaCorporationId" INTEGER,
    "solarSystemId" INTEGER,
    "version" INTEGER
);

-- Races table
CREATE TABLE IF NOT EXISTS races (
    "raceId" INTEGER PRIMARY KEY,
    "name" TEXT,
    "description" TEXT,
    "iconId" INTEGER,
    "version" INTEGER
);

-- Bloodlines table
CREATE TABLE IF NOT EXISTS bloodlines (
    "bloodlineId" INTEGER PRIMARY KEY,
    "name" TEXT,
    "description" TEXT,
    "raceId" INTEGER,
    "shipTypeId" INTEGER,
    "corporationId" INTEGER,
    "charisma" INTEGER,
    "constitution" INTEGER,
    "intelligence" INTEGER,
    "memory" INTEGER,
    "perception" INTEGER,
    "willpower" INTEGER,
    "version" INTEGER
);

-- Ancestries table
CREATE TABLE IF NOT EXISTS ancestries (
    "ancestryId" INTEGER PRIMARY KEY,
    "name" TEXT,
    "bloodlineId" INTEGER,
    "description" TEXT,
    "iconId" INTEGER,
    "shortDescription" TEXT,
    "version" INTEGER
);

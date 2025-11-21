-- SDE Map Data Tables
-- Solar systems, regions, constellations, stargates, stars, planets, moons, asteroid belts

-- Regions table
CREATE TABLE IF NOT EXISTS regions (
    "regionId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "constellationIds" INTEGER[],
    "description" TEXT,
    "factionId" INTEGER,
    "nebulaId" INTEGER,
    "positionX" REAL,
    "positionY" REAL,
    "positionZ" REAL,
    "wormholeClassId" INTEGER,
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    "version" INTEGER
);

-- Constellations table
CREATE TABLE IF NOT EXISTS constellations (
    "constellationId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "regionId" INTEGER,
    "factionId" INTEGER,
    "positionX" REAL,
    "positionY" REAL,
    "positionZ" REAL,
    "solarSystemIds" INTEGER[],
    "wormholeClassId" INTEGER,
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    "version" INTEGER
);

-- Solar Systems table
CREATE TABLE IF NOT EXISTS solarSystems (
    "solarSystemId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "constellationId" INTEGER,
    "regionId" INTEGER,
    "border" BOOLEAN,
    "corridor" BOOLEAN,
    "factionId" INTEGER,
    "fringe" BOOLEAN,
    "hub" BOOLEAN,
    "international" BOOLEAN,
    "luminosity" REAL,
    "planetIds" INTEGER[],
    "positionX" REAL,
    "positionY" REAL,
    "positionZ" REAL,
    "radius" DOUBLE PRECISION,
    "regional" BOOLEAN,
    "securityClass" VARCHAR(255),
    "securityStatus" REAL,
    "stargateIds" INTEGER[],
    "starId" INTEGER,
    "visualEffect" VARCHAR(255),
    "wormholeClassId" INTEGER,
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    "version" INTEGER
);

-- Stargates table
CREATE TABLE IF NOT EXISTS stargates (
    "stargateId" BIGINT PRIMARY KEY,
    "name" VARCHAR(255),
    "solarSystemId" INTEGER,
    "destinationGateId" BIGINT,
    "destinationSolarSystemId" INTEGER,
    "positionX" REAL,
    "positionY" REAL,
    "positionZ" REAL,
    "typeId" INTEGER,
    "version" INTEGER
);

-- Stars table
CREATE TABLE IF NOT EXISTS stars (
    "starId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "solarSystemId" INTEGER,
    "typeId" INTEGER,
    "age" BIGINT,
    "luminosity" REAL,
    "radius" BIGINT,
    "spectralClass" VARCHAR(255),
    "temperature" INTEGER,
    "version" INTEGER
);

-- Planets table
CREATE TABLE IF NOT EXISTS planets (
    "planetId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "solarSystemId" INTEGER,
    "typeId" INTEGER,
    "celestialIndex" INTEGER,
    "positionX" REAL,
    "positionY" REAL,
    "positionZ" REAL,
    "version" INTEGER
);

-- Moons table
CREATE TABLE IF NOT EXISTS moons (
    "moonId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "solarSystemId" INTEGER,
    "planetId" INTEGER,
    "typeId" INTEGER,
    "celestialIndex" INTEGER,
    "positionX" REAL,
    "positionY" REAL,
    "positionZ" REAL,
    "version" INTEGER
);

-- Asteroid Belts table
CREATE TABLE IF NOT EXISTS asteroidBelts (
    "asteroidBeltId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "solarSystemId" INTEGER,
    "typeId" INTEGER,
    "celestialIndex" INTEGER,
    "positionX" REAL,
    "positionY" REAL,
    "positionZ" REAL,
    "version" INTEGER
);

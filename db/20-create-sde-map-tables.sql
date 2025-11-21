-- SDE Map Data Tables
-- Solar systems, regions, constellations, stargates, stars, planets, moons, asteroid belts

-- Regions table
CREATE TABLE IF NOT EXISTS regions (
    "regionId" INTEGER PRIMARY KEY,
    "name" TEXT,
    "constellationIds" INTEGER[],
    "description" TEXT,
    "factionId" INTEGER,
    "nebulaId" INTEGER,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "positionZ" DOUBLE PRECISION,
    "wormholeClassId" INTEGER,
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    "version" INTEGER
);

-- Constellations table
CREATE TABLE IF NOT EXISTS constellations (
    "constellationId" INTEGER PRIMARY KEY,
    "name" TEXT,
    "regionId" INTEGER,
    "factionId" INTEGER,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "positionZ" DOUBLE PRECISION,
    "solarSystemIds" INTEGER[],
    "wormholeClassId" INTEGER,
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    "version" INTEGER
);

-- Solar Systems table
CREATE TABLE IF NOT EXISTS solarSystems (
    "solarSystemId" INTEGER PRIMARY KEY,
    "name" TEXT,
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
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "positionZ" DOUBLE PRECISION,
    "radius" DOUBLE PRECISION,
    "regional" BOOLEAN,
    "securityClass" TEXT,
    "securityStatus" REAL,
    "stargateIds" INTEGER[],
    "starId" INTEGER,
    "visualEffect" TEXT,
    "wormholeClassId" INTEGER,
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    "version" INTEGER
);

-- Stargates table
CREATE TABLE IF NOT EXISTS stargates (
    "stargateId" BIGINT PRIMARY KEY,
    "name" TEXT,
    "solarSystemId" INTEGER,
    "destinationGateId" BIGINT,
    "destinationSolarSystemId" INTEGER,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "positionZ" DOUBLE PRECISION,
    "typeId" INTEGER,
    "version" INTEGER
);

-- Stars table
CREATE TABLE IF NOT EXISTS stars (
    "starId" INTEGER PRIMARY KEY,
    "name" TEXT,
    "solarSystemId" INTEGER,
    "typeId" INTEGER,
    "age" BIGINT,
    "luminosity" REAL,
    "radius" BIGINT,
    "spectralClass" TEXT,
    "temperature" INTEGER,
    "version" INTEGER
);

-- Planets table
CREATE TABLE IF NOT EXISTS planets (
    "planetId" INTEGER PRIMARY KEY,
    "name" TEXT,
    "solarSystemId" INTEGER,
    "typeId" INTEGER,
    "celestialIndex" INTEGER,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "positionZ" DOUBLE PRECISION,
    "version" INTEGER
);

-- Moons table
CREATE TABLE IF NOT EXISTS moons (
    "moonId" INTEGER PRIMARY KEY,
    "name" TEXT,
    "solarSystemId" INTEGER,
    "planetId" INTEGER,
    "typeId" INTEGER,
    "celestialIndex" INTEGER,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "positionZ" DOUBLE PRECISION,
    "version" INTEGER
);

-- Asteroid Belts table
CREATE TABLE IF NOT EXISTS asteroidBelts (
    "asteroidBeltId" INTEGER PRIMARY KEY,
    "name" TEXT,
    "solarSystemId" INTEGER,
    "typeId" INTEGER,
    "celestialIndex" INTEGER,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "positionZ" DOUBLE PRECISION,
    "version" INTEGER
);

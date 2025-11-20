-- SDE Map Data Tables
-- Solar systems, regions, constellations, stargates, stars, planets, moons, asteroid belts

-- Regions table
CREATE TABLE IF NOT EXISTS regions (
    regionId UInt32,
    name String,
    constellationIds Array(UInt32),
    description String,
    factionId Nullable(UInt32),
    nebulaId Nullable(UInt32),
    positionX Float64,
    positionY Float64,
    positionZ Float64,
    wormholeClassId Nullable(UInt32),
    updatedAt DateTime DEFAULT now(),
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY regionId
SETTINGS index_granularity = 16;

-- Constellations table
CREATE TABLE IF NOT EXISTS constellations (
    constellationId UInt32,
    name String,
    regionId UInt32,
    factionId Nullable(UInt32),
    positionX Float64,
    positionY Float64,
    positionZ Float64,
    solarSystemIds Array(UInt32),
    wormholeClassId Nullable(UInt32),
    updatedAt DateTime DEFAULT now(),
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY constellationId
SETTINGS index_granularity = 16;

-- Solar Systems table
CREATE TABLE IF NOT EXISTS solarSystems (
    solarSystemId UInt32,
    name String,
    constellationId UInt32,
    regionId UInt32,
    border UInt8,
    corridor UInt8,
    factionId Nullable(UInt32),
    fringe UInt8,
    hub UInt8,
    international UInt8,
    luminosity Float32,
    planetIds Array(UInt32),
    positionX Float64,
    positionY Float64,
    positionZ Float64,
    radius Float64,
    regional UInt8,
    securityClass String,
    securityStatus Float32,
    stargateIds Array(UInt32),
    starId UInt32,
    visualEffect String,
    wormholeClassId Nullable(UInt32),
    updatedAt DateTime DEFAULT now(),
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY solarSystemId
SETTINGS index_granularity = 16;

-- Stargates table
CREATE TABLE IF NOT EXISTS stargates (
    stargateId UInt64,
    name String,
    solarSystemId UInt32,
    destinationGateId UInt64,
    destinationSolarSystemId UInt32,
    positionX Float64,
    positionY Float64,
    positionZ Float64,
    typeId UInt32,
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY stargateId
SETTINGS index_granularity = 16;

-- Stars table
CREATE TABLE IF NOT EXISTS stars (
    starId UInt32,
    name String,
    solarSystemId UInt32,
    typeId UInt32,
    age UInt64,
    luminosity Float32,
    radius UInt64,
    spectralClass String,
    temperature UInt32,
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY starId
SETTINGS index_granularity = 16;

-- Planets table
CREATE TABLE IF NOT EXISTS planets (
    planetId UInt32,
    name String,
    solarSystemId UInt32,
    typeId UInt32,
    celestialIndex UInt16,
    positionX Float64,
    positionY Float64,
    positionZ Float64,
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY planetId
SETTINGS index_granularity = 16;

-- Moons table
CREATE TABLE IF NOT EXISTS moons (
    moonId UInt32,
    name String,
    solarSystemId UInt32,
    planetId UInt32,
    typeId UInt32,
    celestialIndex UInt16,
    positionX Float64,
    positionY Float64,
    positionZ Float64,
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY moonId
SETTINGS index_granularity = 16;

-- Asteroid Belts table
CREATE TABLE IF NOT EXISTS asteroidBelts (
    asteroidBeltId UInt32,
    name String,
    solarSystemId UInt32,
    typeId UInt32,
    celestialIndex UInt16,
    positionX Float64,
    positionY Float64,
    positionZ Float64,
    version UInt32
) ENGINE = ReplacingMergeTree(version)
ORDER BY asteroidBeltId
SETTINGS index_granularity = 16;


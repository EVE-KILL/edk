-- SDE Cosmetic Tables
-- Skins and other cosmetic items

-- Skins table
CREATE TABLE IF NOT EXISTS skins (
    skinId INTEGER PRIMARY KEY,
    name TEXT,
    description TEXT,
    iconId INTEGER,
    internalName TEXT,
    version INTEGER
);

-- Station Operations table (for station services)
CREATE TABLE IF NOT EXISTS stationOperations (
    operationId INTEGER PRIMARY KEY,
    name TEXT,
    description TEXT,
    activityId INTEGER,
    border REAL,
    corridor REAL,
    fringe REAL,
    hub REAL,
    manufacturingFactor REAL,
    ratio REAL,
    researchFactor REAL,
    stationType TEXT,
    version INTEGER
);

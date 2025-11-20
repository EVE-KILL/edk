-- SDE Type System Tables
-- Types, groups, categories, market groups, meta groups

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    categoryId INTEGER PRIMARY KEY,
    name TEXT,
    iconId INTEGER,
    published BOOLEAN,
    version INTEGER
);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
    groupId INTEGER PRIMARY KEY,
    name TEXT,
    categoryId INTEGER,
    iconId INTEGER,
    published BOOLEAN,
    version INTEGER
);

-- Types table
CREATE TABLE IF NOT EXISTS types (
    typeId INTEGER PRIMARY KEY,
    name TEXT,
    description TEXT,
    groupId INTEGER,
    capacity DOUBLE PRECISION,
    factionId INTEGER,
    graphicId INTEGER,
    iconId INTEGER,
    marketGroupId INTEGER,
    mass DOUBLE PRECISION,
    metaGroupId INTEGER,
    portionSize INTEGER,
    published BOOLEAN,
    raceId INTEGER,
    radius DOUBLE PRECISION,
    soundId INTEGER,
    volume DOUBLE PRECISION,
    version INTEGER
);

-- Market Groups table
CREATE TABLE IF NOT EXISTS marketGroups (
    marketGroupId INTEGER PRIMARY KEY,
    name TEXT,
    description TEXT,
    iconId INTEGER,
    hasTypes BOOLEAN,
    parentGroupId INTEGER,
    version INTEGER
);

-- Meta Groups table
CREATE TABLE IF NOT EXISTS metaGroups (
    metaGroupId INTEGER PRIMARY KEY,
    name TEXT,
    description TEXT,
    iconId INTEGER,
    version INTEGER
);

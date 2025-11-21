-- SDE Type System Tables
-- Types, groups, categories, market groups, meta groups

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    "categoryId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "iconId" INTEGER,
    "published" BOOLEAN,
    "version" INTEGER
);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
    "groupId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "categoryId" INTEGER,
    "iconId" INTEGER,
    "published" BOOLEAN,
    "version" INTEGER
);

-- Types table
CREATE TABLE IF NOT EXISTS types (
    "typeId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "description" TEXT,
    "groupId" INTEGER,
    "capacity" REAL,
    "factionId" INTEGER,
    "graphicId" INTEGER,
    "iconId" INTEGER,
    "marketGroupId" INTEGER,
    "mass" REAL,
    "metaGroupId" INTEGER,
    "portionSize" INTEGER,
    "published" BOOLEAN,
    "raceId" INTEGER,
    "radius" REAL,
    "soundId" INTEGER,
    "volume" REAL,
    "version" INTEGER
);

-- Market Groups table
CREATE TABLE IF NOT EXISTS marketGroups (
    "marketGroupId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "description" TEXT,
    "iconId" INTEGER,
    "hasTypes" BOOLEAN,
    "parentGroupId" INTEGER,
    "version" INTEGER
);

-- Meta Groups table
CREATE TABLE IF NOT EXISTS metaGroups (
    "metaGroupId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "description" TEXT,
    "iconId" INTEGER,
    "version" INTEGER
);

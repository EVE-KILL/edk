-- SDE Type System Tables
-- Types, groups, categories, market groups, meta groups

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    "categoryId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "iconId" INTEGER,
    "published" BOOLEAN
);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
    "groupId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "categoryId" INTEGER,
    "iconId" INTEGER,
    "published" BOOLEAN
);

-- Types table
CREATE TABLE IF NOT EXISTS types (
    "typeId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "description" TEXT,
    "groupId" INTEGER,
    "capacity" DOUBLE PRECISION,
    "factionId" INTEGER,
    "graphicId" INTEGER,
    "iconId" INTEGER,
    "marketGroupId" INTEGER,
    "mass" DOUBLE PRECISION,
    "metaGroupId" INTEGER,
    "portionSize" INTEGER,
    "published" BOOLEAN,
    "raceId" INTEGER,
    "radius" DOUBLE PRECISION,
    "soundId" INTEGER,
    "volume" DOUBLE PRECISION
);

-- Market Groups table
CREATE TABLE IF NOT EXISTS marketGroups (
    "marketGroupId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "description" TEXT,
    "iconId" INTEGER,
    "hasTypes" BOOLEAN,
    "parentGroupId" INTEGER
);

-- Meta Groups table
CREATE TABLE IF NOT EXISTS metaGroups (
    "metaGroupId" INTEGER PRIMARY KEY,
    "name" VARCHAR(255),
    "description" TEXT,
    "iconId" INTEGER
);

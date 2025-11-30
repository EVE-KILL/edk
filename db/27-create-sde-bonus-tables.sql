-- Migration: Create bonus, certificate and mastery tables
-- This stores ship/module bonuses, skill certificates, and mastery levels

-- Type Bonuses table (ship and module bonuses)
CREATE TABLE IF NOT EXISTS typebonuses (
    "typeId" INTEGER PRIMARY KEY,
    "roleBonuses" JSONB,
    "types" JSONB,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_typebonuses_rolebonuses ON typebonuses USING GIN ("roleBonuses");
CREATE INDEX IF NOT EXISTS idx_typebonuses_types ON typebonuses USING GIN ("types");
CREATE INDEX IF NOT EXISTS idx_typebonuses_updatedat ON typebonuses ("updatedAt");

-- Certificates table (skill certification system)
CREATE TABLE IF NOT EXISTS certificates (
    "certificateId" INTEGER PRIMARY KEY,
    "name" TEXT,
    "description" TEXT,
    "groupId" INTEGER,
    "recommendedFor" JSONB,
    "skillTypes" JSONB,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificates_groupid ON certificates ("groupId");
CREATE INDEX IF NOT EXISTS idx_certificates_recommendedfor ON certificates USING GIN ("recommendedFor");
CREATE INDEX IF NOT EXISTS idx_certificates_updatedat ON certificates ("updatedAt");

-- Masteries table (ship mastery levels)
CREATE TABLE IF NOT EXISTS masteries (
    "typeId" INTEGER PRIMARY KEY,
    "masteryLevels" JSONB,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_masteries_masterylevels ON masteries USING GIN ("masteryLevels");
CREATE INDEX IF NOT EXISTS idx_masteries_updatedat ON masteries ("updatedAt");

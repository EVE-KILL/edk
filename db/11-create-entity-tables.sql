-- ============================================================================
-- ENTITY TABLES (Player Characters, Corporations, Alliances)
-- ============================================================================

-- Player Characters - Stores ESI character data
CREATE TABLE IF NOT EXISTS characters (
  "characterId" INTEGER PRIMARY KEY,
  "allianceId" INTEGER,
  "birthday" TIMESTAMP,
  "bloodlineId" INTEGER,
  "corporationId" INTEGER,
  "description" TEXT,
  "gender" VARCHAR(30),
  "name" VARCHAR(255),
  "raceId" INTEGER,
  "securityStatus" REAL,
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  "version" BIGINT
);

CREATE INDEX IF NOT EXISTS "idx_characters_alliance" ON characters ("allianceId");
CREATE INDEX IF NOT EXISTS "idx_characters_corporation" ON characters ("corporationId");
CREATE INDEX IF NOT EXISTS "idx_characters_bloodline" ON characters ("bloodlineId");
CREATE INDEX IF NOT EXISTS "idx_characters_race" ON characters ("raceId");


-- Player Corporations - Stores ESI corporation data
CREATE TABLE IF NOT EXISTS corporations (
  "corporationId" INTEGER PRIMARY KEY,
  "allianceId" INTEGER,
  "ceoId" INTEGER,
  "creatorId" INTEGER,
  "dateFounded" DATE,
  "description" TEXT,
  "homeStationId" INTEGER,
  "memberCount" INTEGER,
  "name" VARCHAR(255),
  "shares" BIGINT,
  "taxRate" REAL,
  "ticker" VARCHAR(50),
  "url" TEXT,
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  "version" BIGINT
);

CREATE INDEX IF NOT EXISTS "idx_corporations_alliance" ON corporations ("allianceId");
CREATE INDEX IF NOT EXISTS "idx_corporations_ceo" ON corporations ("ceoId");
CREATE INDEX IF NOT EXISTS "idx_corporations_creator" ON corporations ("creatorId");


-- Player Alliances - Stores ESI alliance data
CREATE TABLE IF NOT EXISTS alliances (
  "allianceId" INTEGER PRIMARY KEY,
  "creatorCorporationId" INTEGER,
  "creatorId" INTEGER,
  "dateFounded" TIMESTAMP,
  "executorCorporationId" INTEGER,
  "name" VARCHAR(255),
  "ticker" VARCHAR(10),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  "version" BIGINT
);

CREATE INDEX IF NOT EXISTS "idx_alliances_creator_corp" ON alliances ("creatorCorporationId");
CREATE INDEX IF NOT EXISTS "idx_alliances_creator" ON alliances ("creatorId");
CREATE INDEX IF NOT EXISTS "idx_alliances_executor_corp" ON alliances ("executorCorporationId");

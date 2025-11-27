-- ============================================================================
-- ENTITY TABLES (Player Characters, Corporations, Alliances)
-- ============================================================================

-- Player Characters - Stores ESI character data
CREATE TABLE IF NOT EXISTS characters (
  "characterId" INTEGER PRIMARY KEY,
  "allianceId" INTEGER,
  "birthday" DATE,
  "bloodlineId" SMALLINT,
  "corporationId" INTEGER,
  "description" TEXT COMPRESSION lz4,
  "factionId" INTEGER,
  "gender" VARCHAR(7),
  "name" VARCHAR(50),
  "raceId" SMALLINT,
  "securityStatus" REAL,
  "title" TEXT,
  "lastActive" TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_characters_alliance" ON characters ("allianceId");
CREATE INDEX IF NOT EXISTS "idx_characters_corporation" ON characters ("corporationId");
CREATE INDEX IF NOT EXISTS "idx_characters_bloodline" ON characters ("bloodlineId");
CREATE INDEX IF NOT EXISTS "idx_characters_race" ON characters ("raceId");
CREATE INDEX IF NOT EXISTS "idx_characters_faction" ON characters ("factionId");
CREATE INDEX IF NOT EXISTS "idx_characters_last_active" ON characters ("lastActive");
CREATE INDEX IF NOT EXISTS "idx_characters_updated_at" ON characters ("updatedAt");
CREATE INDEX IF NOT EXISTS "idx_characters_lastactive_updatedat" ON characters ("lastActive", "updatedAt") WHERE "lastActive" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_characters_null_lastactive" ON characters ("updatedAt") WHERE "lastActive" IS NULL;


-- Player Corporations - Stores ESI corporation data
CREATE TABLE IF NOT EXISTS corporations (
  "corporationId" INTEGER PRIMARY KEY,
  "allianceId" INTEGER,
  "ceoId" INTEGER,
  "creatorId" INTEGER,
  "dateFounded" DATE,
  "description" TEXT COMPRESSION lz4,
  "factionId" INTEGER,
  "homeStationId" INTEGER,
  "memberCount" INTEGER,
  "name" VARCHAR(60),
  "shares" BIGINT,
  "taxRate" REAL,
  "ticker" VARCHAR(10),
  "url" TEXT,
  "warEligible" BOOLEAN,
  "lastActive" TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_corporations_alliance" ON corporations ("allianceId");
CREATE INDEX IF NOT EXISTS "idx_corporations_ceo" ON corporations ("ceoId");
CREATE INDEX IF NOT EXISTS "idx_corporations_creator" ON corporations ("creatorId");
CREATE INDEX IF NOT EXISTS "idx_corporations_faction" ON corporations ("factionId");
CREATE INDEX IF NOT EXISTS "idx_corporations_last_active" ON corporations ("lastActive");
CREATE INDEX IF NOT EXISTS "idx_corporations_updated_at" ON corporations ("updatedAt");
CREATE INDEX IF NOT EXISTS "idx_corporations_lastactive_updatedat" ON corporations ("lastActive", "updatedAt") WHERE "lastActive" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_corporations_null_lastactive" ON corporations ("updatedAt") WHERE "lastActive" IS NULL;


-- Player Alliances - Stores ESI alliance data
CREATE TABLE IF NOT EXISTS alliances (
  "allianceId" INTEGER PRIMARY KEY,
  "creatorCorporationId" INTEGER,
  "creatorId" INTEGER,
  "dateFounded" DATE,
  "executorCorporationId" INTEGER,
  "factionId" INTEGER,
  "name" VARCHAR(60),
  "ticker" VARCHAR(5),
  "lastActive" TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_alliances_last_active" ON alliances ("lastActive");
CREATE INDEX IF NOT EXISTS "idx_alliances_updated_at" ON alliances ("updatedAt");
CREATE INDEX IF NOT EXISTS "idx_alliances_lastactive_updatedat" ON alliances ("lastActive", "updatedAt") WHERE "lastActive" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_alliances_null_lastactive" ON alliances ("updatedAt") WHERE "lastActive" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_alliances_creator_corp" ON alliances ("creatorCorporationId");
CREATE INDEX IF NOT EXISTS "idx_alliances_creator" ON alliances ("creatorId");
CREATE INDEX IF NOT EXISTS "idx_alliances_executor_corp" ON alliances ("executorCorporationId");
CREATE INDEX IF NOT EXISTS "idx_alliances_faction" ON alliances ("factionId");

-- Characters can be biomassed/deleted in EVE Online
ALTER TABLE characters ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS "idx_characters_deleted" ON characters (deleted) WHERE deleted = FALSE;

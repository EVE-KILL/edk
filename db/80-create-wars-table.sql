-- ============================================================================
-- WARS TABLES
-- Stores public war metadata and allies from ESI
-- ============================================================================

SET client_min_messages TO WARNING;

CREATE TABLE IF NOT EXISTS wars (
  "warId" BIGINT PRIMARY KEY,
  "aggressorAllianceId" BIGINT,
  "aggressorCorporationId" BIGINT,
  "aggressorIskDestroyed" DOUBLE PRECISION DEFAULT 0,
  "aggressorShipsKilled" INTEGER DEFAULT 0,
  "defenderAllianceId" BIGINT,
  "defenderCorporationId" BIGINT,
  "defenderIskDestroyed" DOUBLE PRECISION DEFAULT 0,
  "defenderShipsKilled" INTEGER DEFAULT 0,
  declared TIMESTAMP WITH TIME ZONE,
  started TIMESTAMP WITH TIME ZONE,
  retracted TIMESTAMP WITH TIME ZONE,
  finished TIMESTAMP WITH TIME ZONE,
  mutual BOOLEAN DEFAULT false,
  "openForAllies" BOOLEAN DEFAULT false,
  "lastUpdated" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "warAllies" (
  "id" BIGSERIAL PRIMARY KEY,
  "warId" BIGINT NOT NULL,
  "allianceId" BIGINT,
  "corporationId" BIGINT
);

CREATE INDEX IF NOT EXISTS idx_war_allies_war_id ON "warAllies" ("warId");
CREATE UNIQUE INDEX IF NOT EXISTS idx_war_allies_unique_alliance
  ON "warAllies" ("warId", "allianceId")
  WHERE "allianceId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_war_allies_unique_corporation
  ON "warAllies" ("warId", "corporationId")
  WHERE "corporationId" IS NOT NULL;

ALTER TABLE killmails ADD COLUMN IF NOT EXISTS "warId" BIGINT;
CREATE INDEX IF NOT EXISTS idx_killmails_war ON killmails ("warId", "killmailTime" DESC);

SET client_min_messages TO NOTICE;

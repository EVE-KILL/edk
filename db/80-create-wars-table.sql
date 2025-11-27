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

-- Indexes to optimize war list filtering and sorting
CREATE INDEX IF NOT EXISTS idx_wars_declared_started
  ON wars (COALESCE(declared, started) DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_wars_finished
  ON wars (finished);

CREATE INDEX IF NOT EXISTS idx_wars_mutual
  ON wars (mutual);

CREATE INDEX IF NOT EXISTS idx_wars_open_for_allies
  ON wars ("openForAllies");

-- Partial indexes for faction war filtering
CREATE INDEX IF NOT EXISTS idx_wars_aggressor_alliance
  ON wars ("aggressorAllianceId")
  WHERE "aggressorAllianceId" IN (500001, 500002, 500003, 500004);

CREATE INDEX IF NOT EXISTS idx_wars_defender_alliance
  ON wars ("defenderAllianceId")
  WHERE "defenderAllianceId" IN (500001, 500002, 500003, 500004);

-- Indexes for joining with alliances/corporations
CREATE INDEX IF NOT EXISTS idx_wars_aggressor_alliance_full
  ON wars ("aggressorAllianceId");

CREATE INDEX IF NOT EXISTS idx_wars_aggressor_corporation
  ON wars ("aggressorCorporationId");

CREATE INDEX IF NOT EXISTS idx_wars_defender_alliance_full
  ON wars ("defenderAllianceId");

CREATE INDEX IF NOT EXISTS idx_wars_defender_corporation
  ON wars ("defenderCorporationId");

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_wars_active_mutual
  ON wars (mutual, finished, COALESCE(declared, started) DESC);

-- Index for killmail aggregation queries
CREATE INDEX IF NOT EXISTS idx_killmails_war_value
  ON killmails ("warId", "totalValue")
  WHERE "warId" IS NOT NULL;

-- Insert legendary faction wars
INSERT INTO wars (
  "warId",
  "aggressorAllianceId",
  "defenderAllianceId",
  declared,
  started,
  mutual,
  "openForAllies",
  "lastUpdated"
) VALUES (
  999999999999999,
  500001, -- Caldari State
  500004, -- Gallente Federation
  '2003-05-06 00:00:00+00',
  '2003-05-06 00:00:00+00',
  true,
  false,
  NOW()
), (
  999999999999998,
  500003, -- Amarr Empire
  500002, -- Minmatar Republic
  '2003-05-06 00:00:00+00',
  '2003-05-06 00:00:00+00',
  true,
  false,
  NOW()
) ON CONFLICT ("warId") DO NOTHING;

SET client_min_messages TO NOTICE;

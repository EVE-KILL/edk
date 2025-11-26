-- ============================================================================
-- WARS FILTER INDEXES
-- Indexes to optimize war list filtering and sorting
-- ============================================================================

SET client_min_messages TO WARNING;

-- Index for sorting by declaration/start time (most common sort)
CREATE INDEX IF NOT EXISTS idx_wars_declared_started 
  ON wars (COALESCE(declared, started) DESC NULLS LAST);

-- Index for filtering by finished status (active/finished wars)
CREATE INDEX IF NOT EXISTS idx_wars_finished 
  ON wars (finished);

-- Index for filtering by mutual status
CREATE INDEX IF NOT EXISTS idx_wars_mutual 
  ON wars (mutual);

-- Index for filtering by openForAllies status
CREATE INDEX IF NOT EXISTS idx_wars_open_for_allies 
  ON wars ("openForAllies");

-- Composite index for faction war filtering (aggressor side)
CREATE INDEX IF NOT EXISTS idx_wars_aggressor_alliance 
  ON wars ("aggressorAllianceId") 
  WHERE "aggressorAllianceId" IN (500001, 500002, 500003, 500004);

-- Composite index for faction war filtering (defender side)
CREATE INDEX IF NOT EXISTS idx_wars_defender_alliance 
  ON wars ("defenderAllianceId") 
  WHERE "defenderAllianceId" IN (500001, 500002, 500003, 500004);

-- Index for joining with alliances (aggressor)
CREATE INDEX IF NOT EXISTS idx_wars_aggressor_alliance_full 
  ON wars ("aggressorAllianceId");

-- Index for joining with corporations (aggressor)
CREATE INDEX IF NOT EXISTS idx_wars_aggressor_corporation 
  ON wars ("aggressorCorporationId");

-- Index for joining with alliances (defender)
CREATE INDEX IF NOT EXISTS idx_wars_defender_alliance_full 
  ON wars ("defenderAllianceId");

-- Index for joining with corporations (defender)
CREATE INDEX IF NOT EXISTS idx_wars_defender_corporation 
  ON wars ("defenderCorporationId");

-- Composite index for common filter combinations
-- Note: Can't use NOW() in partial index, so we index all and filter in query
CREATE INDEX IF NOT EXISTS idx_wars_active_mutual 
  ON wars (mutual, finished, COALESCE(declared, started) DESC);

-- Index for killmail aggregation queries (already exists in 80-create-wars-table.sql but ensuring it's optimal)
-- This helps with counting kills and totaling values per war
CREATE INDEX IF NOT EXISTS idx_killmails_war_value 
  ON killmails ("warId", "totalValue") 
  WHERE "warId" IS NOT NULL;

SET client_min_messages TO NOTICE;

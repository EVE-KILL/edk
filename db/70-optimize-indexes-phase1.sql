-- ============================================================================
-- PHASE 1: INDEX OPTIMIZATIONS (BRIN + Partial Indexes)
-- ============================================================================
-- This migration implements low-risk, high-reward index optimizations:
--  1. BRIN indexes for time-series data (99% smaller)
--  2. Partial indexes for filtered queries (50-90% smaller)
--  3. Index-only scan optimization with INCLUDE
--  4. Remove redundant indexes
--
-- IMPORTANT: Run this during low-traffic period
-- Estimated time: 5-30 minutes depending on data size
-- Rollback plan: Drop new indexes, recreate old ones
-- ============================================================================

SET client_min_messages TO WARNING;

-- ============================================================================
-- SECTION 1: BRIN INDEXES FOR TIME-SERIES DATA
-- ============================================================================
-- BRIN indexes are perfect for chronologically-inserted data
-- Size reduction: 99% (1GB B-tree → 1MB BRIN)
-- Performance: Near-identical for range queries, slightly slower for exact lookups

-- attackers.killmailTime: Perfect candidate (sequential inserts)
CREATE INDEX IF NOT EXISTS idx_attackers_time_brin ON attackers
  USING BRIN ("killmailTime")
  WITH (pages_per_range = 128);

-- items.killmailTime: Perfect candidate (sequential inserts)
CREATE INDEX IF NOT EXISTS idx_items_time_brin ON items
  USING BRIN ("killmailTime")
  WITH (pages_per_range = 128);

-- attackers.killmailId: Highly correlated with time
CREATE INDEX IF NOT EXISTS idx_attackers_killmail_brin ON attackers
  USING BRIN ("killmailId")
  WITH (pages_per_range = 128);

-- items.killmailId: Highly correlated with time
CREATE INDEX IF NOT EXISTS idx_items_killmail_brin ON items
  USING BRIN ("killmailId")
  WITH (pages_per_range = 128);

-- ============================================================================
-- SECTION 2: PARTIAL INDEXES FOR FILTERED QUERIES
-- ============================================================================
-- Most queries filter on specific conditions
-- Only index the rows that matter → 50-90% smaller

-- attackers: Only index non-NULL alliances (most NPCs have NULL alliance)
-- Estimated reduction: 70-80% smaller than full index
DROP INDEX IF EXISTS idx_attackers_alliance;
CREATE INDEX IF NOT EXISTS idx_attackers_alliance_nonnull ON attackers ("allianceId", "killmailTime" DESC)
  WHERE "allianceId" IS NOT NULL;

-- attackers: Only index non-NULL characters (some NPCs have NULL)
DROP INDEX IF EXISTS idx_attackers_character;
CREATE INDEX IF NOT EXISTS idx_attackers_character_nonnull ON attackers ("characterId", "killmailTime" DESC)
  WHERE "characterId" IS NOT NULL;

-- attackers: Only index final blows (typically 1 per killmail)
-- Reduction: 95%+ smaller (1 final blow per ~10-50 attackers)
DROP INDEX IF EXISTS idx_attackers_final_blow;
CREATE INDEX IF NOT EXISTS idx_attackers_final_blow_only ON attackers ("killmailId")
  WHERE "finalBlow" = true;

-- killmails: Only index PVP kills (if NPC filtering is common)
CREATE INDEX IF NOT EXISTS idx_killmails_pvp_time ON killmails ("killmailTime" DESC)
  WHERE "npc" = false;

-- killmails: Only index solo kills (if solo filtering is common)
CREATE INDEX IF NOT EXISTS idx_killmails_solo_nonnull ON killmails ("killmailTime" DESC, "solo")
  WHERE "solo" = true;

-- killmails: Only index high-value kills (>100M ISK)
-- Useful for "top kills" queries
CREATE INDEX IF NOT EXISTS idx_killmails_highvalue ON killmails ("totalValue" DESC, "killmailTime" DESC)
  WHERE "totalValue" > 100000000;

-- killmails: Only index non-NULL victim alliances
DROP INDEX IF EXISTS idx_killmails_victim_ally_time;
CREATE INDEX IF NOT EXISTS idx_killmails_victim_ally_nonnull ON killmails ("victimAllianceId", "killmailTime" DESC)
  WHERE "victimAllianceId" IS NOT NULL;

-- killmails: Only index non-NULL top attacker alliances
DROP INDEX IF EXISTS idx_killmails_top_attacker_ally;
CREATE INDEX IF NOT EXISTS idx_killmails_top_attacker_ally_nonnull ON killmails ("topAttackerAllianceId", "killmailTime" DESC)
  WHERE "topAttackerAllianceId" IS NOT NULL;

-- items: Only index non-NULL item types
DROP INDEX IF EXISTS idx_items_item_type;
CREATE INDEX IF NOT EXISTS idx_items_item_type_nonnull ON items ("itemTypeId", "killmailTime" DESC)
  WHERE "itemTypeId" IS NOT NULL;

-- ============================================================================
-- SECTION 3: INDEX-ONLY SCANS WITH INCLUDE
-- ============================================================================
-- Add commonly-queried columns to indexes to avoid heap lookups
-- Result: 2-10x faster queries via index-only scans

-- attackers: Character queries often need killmail context
CREATE INDEX IF NOT EXISTS idx_attackers_char_incl ON attackers ("characterId", "killmailTime" DESC)
  INCLUDE ("killmailId", "shipTypeId", "damageDone", "finalBlow")
  WHERE "characterId" IS NOT NULL;

-- attackers: Corporation queries often need killmail context
CREATE INDEX IF NOT EXISTS idx_attackers_corp_incl ON attackers ("corporationId", "killmailTime" DESC)
  INCLUDE ("killmailId", "characterId", "shipTypeId")
  WHERE "corporationId" IS NOT NULL;

-- killmails: Time-based queries often need basic kill info
CREATE INDEX IF NOT EXISTS idx_killmails_time_incl ON killmails ("killmailTime" DESC)
  INCLUDE ("killmailId", "victimShipTypeId", "totalValue", "regionId", "solarSystemId", "attackerCount");

-- killmails: Region queries often need victim/value info
CREATE INDEX IF NOT EXISTS idx_killmails_region_incl ON killmails ("regionId", "killmailTime" DESC)
  INCLUDE ("killmailId", "victimCharacterId", "victimCorporationId", "victimShipTypeId", "totalValue");

-- ============================================================================
-- SECTION 4: REMOVE REDUNDANT B-TREE INDEXES
-- ============================================================================
-- After BRIN indexes are created and tested, old B-tree indexes can be dropped
-- DO THIS ONLY AFTER MONITORING QUERY PERFORMANCE

-- CAUTION: Uncomment these ONLY after verifying BRIN indexes perform well
-- Monitor with: SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';

-- DROP INDEX IF EXISTS idx_attackers_time;  -- Replaced by BRIN
-- DROP INDEX IF EXISTS idx_items_time;       -- Replaced by BRIN
-- DROP INDEX IF EXISTS idx_attackers_killmail_id;  -- Replaced by BRIN

-- ============================================================================
-- SECTION 5: STATISTICS TARGETS FOR BETTER QUERY PLANNING
-- ============================================================================
-- Increase statistics sampling for high-cardinality columns
-- Improves query planner accuracy

ALTER TABLE killmails ALTER COLUMN "killmailId" SET STATISTICS 1000;
ALTER TABLE killmails ALTER COLUMN "solarSystemId" SET STATISTICS 500;
ALTER TABLE killmails ALTER COLUMN "victimCharacterId" SET STATISTICS 1000;
ALTER TABLE killmails ALTER COLUMN "topAttackerCharacterId" SET STATISTICS 1000;

ALTER TABLE attackers ALTER COLUMN "characterId" SET STATISTICS 1000;
ALTER TABLE attackers ALTER COLUMN "corporationId" SET STATISTICS 500;
ALTER TABLE attackers ALTER COLUMN "killmailId" SET STATISTICS 500;

ALTER TABLE items ALTER COLUMN "itemTypeId" SET STATISTICS 500;
ALTER TABLE items ALTER COLUMN "killmailId" SET STATISTICS 500;

-- ============================================================================
-- SECTION 6: FILLFACTOR OPTIMIZATION
-- ============================================================================
-- Set fillfactor to 100 for append-only tables (no HOT updates needed)
-- NOTE: Cannot set on partitioned tables, must be set on partitions themselves
-- This can be set when creating new partitions via partition management script

-- ALTER TABLE killmails SET (fillfactor = 100);  -- Partitioned table, skip
-- ALTER TABLE attackers SET (fillfactor = 100);  -- Partitioned table, skip
-- ALTER TABLE items SET (fillfactor = 100);      -- Partitioned table, skip

-- ============================================================================
-- SECTION 7: ANALYZE TABLES
-- ============================================================================
-- Update statistics with new targets

SET client_min_messages TO NOTICE;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after migration to verify improvements:

-- 1. Check index sizes
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
--   idx_scan
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
--   AND tablename IN ('killmails', 'attackers', 'items')
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- 2. Check BRIN index correlation (should be close to 1.0)
-- SELECT
--   tablename,
--   attname,
--   correlation
-- FROM pg_stats
-- WHERE tablename IN ('attackers', 'items')
--   AND attname IN ('killmailTime', 'killmailId');

-- 3. Test query performance with EXPLAIN ANALYZE
-- EXPLAIN ANALYZE
-- SELECT * FROM attackers
-- WHERE "killmailTime" > NOW() - INTERVAL '7 days';

-- 4. Check for index-only scans
-- EXPLAIN ANALYZE
-- SELECT "characterId", "killmailTime", "killmailId", "shipTypeId"
-- FROM attackers
-- WHERE "characterId" = 123456789;

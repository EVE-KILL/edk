-- ============================================================================
-- PHASE 2: REMOVE REDUNDANT INDEXES
-- ============================================================================
-- This migration removes indexes that are redundant due to Phase 1 optimizations
--
-- Categories of removals:
--  1. B-tree indexes replaced by BRIN (after verification)
--  2. Single/composite indexes made redundant by INCLUDE indexes
--  3. Full indexes replaced by partial indexes
--
-- IMPORTANT: Run this AFTER monitoring BRIN performance for 1+ week
-- ============================================================================

SET client_min_messages TO WARNING;

-- ============================================================================
-- SECTION 1: REMOVE B-TREE INDEXES REPLACED BY BRIN
-- ============================================================================
-- These are safe to drop once BRIN indexes prove performant
-- BRIN indexes are 99% smaller and work great for sequential data

-- attackers table
DROP INDEX IF EXISTS idx_attackers_time;           -- Replaced by idx_attackers_time_brin
DROP INDEX IF EXISTS idx_attackers_killmail_id;    -- Replaced by idx_attackers_killmail_brin

-- items table
DROP INDEX IF EXISTS idx_items_time;               -- Replaced by idx_items_time_brin
DROP INDEX IF EXISTS idx_items_killmail_id;        -- Replaced by idx_items_killmail_brin

-- ============================================================================
-- SECTION 2: REMOVE INDEXES REDUNDANT WITH INCLUDE INDEXES
-- ============================================================================
-- INCLUDE indexes can serve the same queries as their base versions
-- Plus they enable index-only scans

-- attackers table
DROP INDEX IF EXISTS idx_attackers_character_nonnull;  -- Redundant with idx_attackers_char_incl
DROP INDEX IF EXISTS idx_attackers_corporation;        -- Redundant with idx_attackers_corp_incl

-- killmails table
DROP INDEX IF EXISTS idx_killmails_region_time;        -- Redundant with idx_killmails_region_incl

-- ============================================================================
-- SECTION 3: REMOVE FULL INDEXES REPLACED BY PARTIAL INDEXES
-- ============================================================================
-- Partial indexes are smaller and sufficient for most queries

-- killmails table
DROP INDEX IF EXISTS idx_killmails_solo_time;          -- Replaced by idx_killmails_solo_nonnull (partial)

-- ============================================================================
-- SECTION 4: ANALYZE TABLES
-- ============================================================================
-- Update statistics after index changes

SET client_min_messages TO NOTICE;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after migration to verify:

-- 1. Confirm indexes were dropped
-- SELECT indexname
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename IN ('killmails', 'attackers', 'items')
--   AND indexname IN (
--     'idx_attackers_time', 'idx_attackers_killmail_id',
--     'idx_items_time', 'idx_items_killmail_id',
--     'idx_attackers_character_nonnull', 'idx_attackers_corporation',
--     'idx_killmails_region_time', 'idx_killmails_solo_time'
--   );
-- Should return 0 rows

-- 2. Check remaining indexes
-- SELECT tablename, COUNT(*) as index_count
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename IN ('killmails', 'attackers', 'items')
-- GROUP BY tablename
-- ORDER BY tablename;

-- 3. Test queries still work efficiently
-- EXPLAIN ANALYZE
-- SELECT * FROM attackers WHERE "killmailTime" > NOW() - INTERVAL '7 days';
-- Should use idx_attackers_time_brin

-- EXPLAIN ANALYZE
-- SELECT "characterId", "killmailTime", "killmailId", "shipTypeId"
-- FROM attackers WHERE "characterId" = 123456789;
-- Should use idx_attackers_char_incl with Index Only Scan

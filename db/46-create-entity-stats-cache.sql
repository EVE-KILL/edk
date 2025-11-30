-- Entity Stats Cache Table
-- High-performance cache of pre-calculated entity statistics
-- Updated in real-time via triggers on killmails table
-- Supports all-time, 90d, 30d, and 14d time buckets

SET client_min_messages TO WARNING;

-- Note: This migration is idempotent and safe to run multiple times
-- It uses CREATE OR REPLACE for functions and CREATE TABLE IF NOT EXISTS

SET client_min_messages TO NOTICE;

-- ============================================================================
-- STATS CACHE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_stats_cache (
  "entityId" BIGINT NOT NULL,
  "entityType" TEXT NOT NULL, -- 'character', 'corporation', 'alliance', 'faction', 'group', 'type'

  -- All-time stats
  "killsAll" BIGINT DEFAULT 0,
  "lossesAll" BIGINT DEFAULT 0,
  "iskDestroyedAll" NUMERIC DEFAULT 0,
  "iskLostAll" NUMERIC DEFAULT 0,
  "soloKillsAll" BIGINT DEFAULT 0,
  "soloLossesAll" BIGINT DEFAULT 0,
  "npcKillsAll" BIGINT DEFAULT 0,
  "npcLossesAll" BIGINT DEFAULT 0,

  -- 90-day stats
  "kills90d" BIGINT DEFAULT 0,
  "losses90d" BIGINT DEFAULT 0,
  "iskDestroyed90d" NUMERIC DEFAULT 0,
  "iskLost90d" NUMERIC DEFAULT 0,
  "soloKills90d" BIGINT DEFAULT 0,
  "soloLosses90d" BIGINT DEFAULT 0,
  "npcKills90d" BIGINT DEFAULT 0,
  "npcLosses90d" BIGINT DEFAULT 0,

  -- 30-day stats
  "kills30d" BIGINT DEFAULT 0,
  "losses30d" BIGINT DEFAULT 0,
  "iskDestroyed30d" NUMERIC DEFAULT 0,
  "iskLost30d" NUMERIC DEFAULT 0,
  "soloKills30d" BIGINT DEFAULT 0,
  "soloLosses30d" BIGINT DEFAULT 0,
  "npcKills30d" BIGINT DEFAULT 0,
  "npcLosses30d" BIGINT DEFAULT 0,

  -- 14-day stats
  "kills14d" BIGINT DEFAULT 0,
  "losses14d" BIGINT DEFAULT 0,
  "iskDestroyed14d" NUMERIC DEFAULT 0,
  "iskLost14d" NUMERIC DEFAULT 0,
  "soloKills14d" BIGINT DEFAULT 0,
  "soloLosses14d" BIGINT DEFAULT 0,
  "npcKills14d" BIGINT DEFAULT 0,
  "npcLosses14d" BIGINT DEFAULT 0,

  -- Activity timestamps
  "lastKillTime" TIMESTAMP,
  "lastLossTime" TIMESTAMP,

  -- Maintenance
  "updatedAt" TIMESTAMP DEFAULT NOW(),

  PRIMARY KEY ("entityId", "entityType")
);

-- Indexes for common queries
CREATE INDEX idx_entity_stats_cache_type_kills_all ON entity_stats_cache("entityType", "killsAll" DESC);
CREATE INDEX idx_entity_stats_cache_type_kills_90d ON entity_stats_cache("entityType", "kills90d" DESC);
CREATE INDEX idx_entity_stats_cache_type_kills_30d ON entity_stats_cache("entityType", "kills30d" DESC);
CREATE INDEX idx_entity_stats_cache_last_activity ON entity_stats_cache("lastKillTime", "lastLossTime");

COMMENT ON TABLE entity_stats_cache IS 'Pre-calculated entity statistics cache, updated in real-time via triggers';

-- ============================================================================
-- HELPER FUNCTION: Upsert entity stats
-- ============================================================================

CREATE OR REPLACE FUNCTION upsert_entity_stats(
  p_entity_id BIGINT,
  p_entity_type TEXT,
  p_killmail_time TIMESTAMPTZ,
  p_total_value DOUBLE PRECISION,
  p_is_kill BOOLEAN,
  p_is_solo BOOLEAN,
  p_is_npc BOOLEAN
) RETURNS VOID AS $$
DECLARE
  v_age_days NUMERIC;
  v_in_90d BOOLEAN;
  v_in_30d BOOLEAN;
  v_in_14d BOOLEAN;
BEGIN
  -- Skip NULL entity IDs
  IF p_entity_id IS NULL THEN
    RETURN;
  END IF;

  -- Calculate killmail age in days
  v_age_days := EXTRACT(EPOCH FROM (NOW() - p_killmail_time)) / 86400.0;

  -- Determine which time buckets this killmail falls into
  v_in_90d := v_age_days <= 90;
  v_in_30d := v_age_days <= 30;
  v_in_14d := v_age_days <= 14;

  -- Upsert stats
  INSERT INTO entity_stats_cache (
    "entityId",
    "entityType",
    "killsAll",
    "lossesAll",
    "iskDestroyedAll",
    "iskLostAll",
    "soloKillsAll",
    "soloLossesAll",
    "npcKillsAll",
    "npcLossesAll",
    "kills90d",
    "losses90d",
    "iskDestroyed90d",
    "iskLost90d",
    "soloKills90d",
    "soloLosses90d",
    "npcKills90d",
    "npcLosses90d",
    "kills30d",
    "losses30d",
    "iskDestroyed30d",
    "iskLost30d",
    "soloKills30d",
    "soloLosses30d",
    "npcKills30d",
    "npcLosses30d",
    "kills14d",
    "losses14d",
    "iskDestroyed14d",
    "iskLost14d",
    "soloKills14d",
    "soloLosses14d",
    "npcKills14d",
    "npcLosses14d",
    "lastKillTime",
    "lastLossTime",
    "updatedAt"
  ) VALUES (
    p_entity_id,
    p_entity_type,
    CASE WHEN p_is_kill THEN 1 ELSE 0 END,
    CASE WHEN NOT p_is_kill THEN 1 ELSE 0 END,
    CASE WHEN p_is_kill THEN p_total_value ELSE 0 END,
    CASE WHEN NOT p_is_kill THEN p_total_value ELSE 0 END,
    CASE WHEN p_is_kill AND p_is_solo THEN 1 ELSE 0 END,
    CASE WHEN NOT p_is_kill AND p_is_solo THEN 1 ELSE 0 END,
    CASE WHEN p_is_kill AND p_is_npc THEN 1 ELSE 0 END,
    CASE WHEN NOT p_is_kill AND p_is_npc THEN 1 ELSE 0 END,
    CASE WHEN p_is_kill AND v_in_90d THEN 1 ELSE 0 END,
    CASE WHEN NOT p_is_kill AND v_in_90d THEN 1 ELSE 0 END,
    CASE WHEN p_is_kill AND v_in_90d THEN p_total_value ELSE 0 END,
    CASE WHEN NOT p_is_kill AND v_in_90d THEN p_total_value ELSE 0 END,
    CASE WHEN p_is_kill AND p_is_solo AND v_in_90d THEN 1 ELSE 0 END,
    CASE WHEN NOT p_is_kill AND p_is_solo AND v_in_90d THEN 1 ELSE 0 END,
    CASE WHEN p_is_kill AND p_is_npc AND v_in_90d THEN 1 ELSE 0 END,
    CASE WHEN NOT p_is_kill AND p_is_npc AND v_in_90d THEN 1 ELSE 0 END,
    CASE WHEN p_is_kill AND v_in_30d THEN 1 ELSE 0 END,
    CASE WHEN NOT p_is_kill AND v_in_30d THEN 1 ELSE 0 END,
    CASE WHEN p_is_kill AND v_in_30d THEN p_total_value ELSE 0 END,
    CASE WHEN NOT p_is_kill AND v_in_30d THEN p_total_value ELSE 0 END,
    CASE WHEN p_is_kill AND p_is_solo AND v_in_30d THEN 1 ELSE 0 END,
    CASE WHEN NOT p_is_kill AND p_is_solo AND v_in_30d THEN 1 ELSE 0 END,
    CASE WHEN p_is_kill AND p_is_npc AND v_in_30d THEN 1 ELSE 0 END,
    CASE WHEN NOT p_is_kill AND p_is_npc AND v_in_30d THEN 1 ELSE 0 END,
    CASE WHEN p_is_kill AND v_in_14d THEN 1 ELSE 0 END,
    CASE WHEN NOT p_is_kill AND v_in_14d THEN 1 ELSE 0 END,
    CASE WHEN p_is_kill AND v_in_14d THEN p_total_value ELSE 0 END,
    CASE WHEN NOT p_is_kill AND v_in_14d THEN p_total_value ELSE 0 END,
    CASE WHEN p_is_kill AND p_is_solo AND v_in_14d THEN 1 ELSE 0 END,
    CASE WHEN NOT p_is_kill AND p_is_solo AND v_in_14d THEN 1 ELSE 0 END,
    CASE WHEN p_is_kill AND p_is_npc AND v_in_14d THEN 1 ELSE 0 END,
    CASE WHEN NOT p_is_kill AND p_is_npc AND v_in_14d THEN 1 ELSE 0 END,
    CASE WHEN p_is_kill THEN p_killmail_time ELSE NULL END,
    CASE WHEN NOT p_is_kill THEN p_killmail_time ELSE NULL END,
    NOW()
  )
  ON CONFLICT ("entityId", "entityType") DO UPDATE SET
    "killsAll" = entity_stats_cache."killsAll" + CASE WHEN p_is_kill THEN 1 ELSE 0 END,
    "lossesAll" = entity_stats_cache."lossesAll" + CASE WHEN NOT p_is_kill THEN 1 ELSE 0 END,
    "iskDestroyedAll" = entity_stats_cache."iskDestroyedAll" + CASE WHEN p_is_kill THEN p_total_value ELSE 0 END,
    "iskLostAll" = entity_stats_cache."iskLostAll" + CASE WHEN NOT p_is_kill THEN p_total_value ELSE 0 END,
    "soloKillsAll" = entity_stats_cache."soloKillsAll" + CASE WHEN p_is_kill AND p_is_solo THEN 1 ELSE 0 END,
    "soloLossesAll" = entity_stats_cache."soloLossesAll" + CASE WHEN NOT p_is_kill AND p_is_solo THEN 1 ELSE 0 END,
    "npcKillsAll" = entity_stats_cache."npcKillsAll" + CASE WHEN p_is_kill AND p_is_npc THEN 1 ELSE 0 END,
    "npcLossesAll" = entity_stats_cache."npcLossesAll" + CASE WHEN NOT p_is_kill AND p_is_npc THEN 1 ELSE 0 END,

    "kills90d" = entity_stats_cache."kills90d" + CASE WHEN p_is_kill AND v_in_90d THEN 1 ELSE 0 END,
    "losses90d" = entity_stats_cache."losses90d" + CASE WHEN NOT p_is_kill AND v_in_90d THEN 1 ELSE 0 END,
    "iskDestroyed90d" = entity_stats_cache."iskDestroyed90d" + CASE WHEN p_is_kill AND v_in_90d THEN p_total_value ELSE 0 END,
    "iskLost90d" = entity_stats_cache."iskLost90d" + CASE WHEN NOT p_is_kill AND v_in_90d THEN p_total_value ELSE 0 END,
    "soloKills90d" = entity_stats_cache."soloKills90d" + CASE WHEN p_is_kill AND p_is_solo AND v_in_90d THEN 1 ELSE 0 END,
    "soloLosses90d" = entity_stats_cache."soloLosses90d" + CASE WHEN NOT p_is_kill AND p_is_solo AND v_in_90d THEN 1 ELSE 0 END,
    "npcKills90d" = entity_stats_cache."npcKills90d" + CASE WHEN p_is_kill AND p_is_npc AND v_in_90d THEN 1 ELSE 0 END,
    "npcLosses90d" = entity_stats_cache."npcLosses90d" + CASE WHEN NOT p_is_kill AND p_is_npc AND v_in_90d THEN 1 ELSE 0 END,

    "kills30d" = entity_stats_cache."kills30d" + CASE WHEN p_is_kill AND v_in_30d THEN 1 ELSE 0 END,
    "losses30d" = entity_stats_cache."losses30d" + CASE WHEN NOT p_is_kill AND v_in_30d THEN 1 ELSE 0 END,
    "iskDestroyed30d" = entity_stats_cache."iskDestroyed30d" + CASE WHEN p_is_kill AND v_in_30d THEN p_total_value ELSE 0 END,
    "iskLost30d" = entity_stats_cache."iskLost30d" + CASE WHEN NOT p_is_kill AND v_in_30d THEN p_total_value ELSE 0 END,
    "soloKills30d" = entity_stats_cache."soloKills30d" + CASE WHEN p_is_kill AND p_is_solo AND v_in_30d THEN 1 ELSE 0 END,
    "soloLosses30d" = entity_stats_cache."soloLosses30d" + CASE WHEN NOT p_is_kill AND p_is_solo AND v_in_30d THEN 1 ELSE 0 END,
    "npcKills30d" = entity_stats_cache."npcKills30d" + CASE WHEN p_is_kill AND p_is_npc AND v_in_30d THEN 1 ELSE 0 END,
    "npcLosses30d" = entity_stats_cache."npcLosses30d" + CASE WHEN NOT p_is_kill AND p_is_npc AND v_in_30d THEN 1 ELSE 0 END,

    "kills14d" = entity_stats_cache."kills14d" + CASE WHEN p_is_kill AND v_in_14d THEN 1 ELSE 0 END,
    "losses14d" = entity_stats_cache."losses14d" + CASE WHEN NOT p_is_kill AND v_in_14d THEN 1 ELSE 0 END,
    "iskDestroyed14d" = entity_stats_cache."iskDestroyed14d" + CASE WHEN p_is_kill AND v_in_14d THEN p_total_value ELSE 0 END,
    "iskLost14d" = entity_stats_cache."iskLost14d" + CASE WHEN NOT p_is_kill AND v_in_14d THEN p_total_value ELSE 0 END,
    "soloKills14d" = entity_stats_cache."soloKills14d" + CASE WHEN p_is_kill AND p_is_solo AND v_in_14d THEN 1 ELSE 0 END,
    "soloLosses14d" = entity_stats_cache."soloLosses14d" + CASE WHEN NOT p_is_kill AND p_is_solo AND v_in_14d THEN 1 ELSE 0 END,
    "npcKills14d" = entity_stats_cache."npcKills14d" + CASE WHEN p_is_kill AND p_is_npc AND v_in_14d THEN 1 ELSE 0 END,
    "npcLosses14d" = entity_stats_cache."npcLosses14d" + CASE WHEN NOT p_is_kill AND p_is_npc AND v_in_14d THEN 1 ELSE 0 END,

    "lastKillTime" = CASE WHEN p_is_kill THEN GREATEST(entity_stats_cache."lastKillTime", p_killmail_time) ELSE entity_stats_cache."lastKillTime" END,
    "lastLossTime" = CASE WHEN NOT p_is_kill THEN GREATEST(entity_stats_cache."lastLossTime", p_killmail_time) ELSE entity_stats_cache."lastLossTime" END,
    "updatedAt" = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Update stats on killmail INSERT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_entity_stats_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Update attacker character stats (kills)
  PERFORM upsert_entity_stats(
    NEW."topAttackerCharacterId",
    'character',
    NEW."killmailTime",
    NEW."totalValue",
    TRUE,  -- is_kill
    NEW.solo,
    NEW.npc
  );

  -- Update attacker corporation stats (kills)
  PERFORM upsert_entity_stats(
    NEW."topAttackerCorporationId",
    'corporation',
    NEW."killmailTime",
    NEW."totalValue",
    TRUE,  -- is_kill
    NEW.solo,
    NEW.npc
  );

  -- Update attacker alliance stats (kills)
  PERFORM upsert_entity_stats(
    NEW."topAttackerAllianceId",
    'alliance',
    NEW."killmailTime",
    NEW."totalValue",
    TRUE,  -- is_kill
    NEW.solo,
    NEW.npc
  );

  -- Update victim character stats (losses)
  PERFORM upsert_entity_stats(
    NEW."victimCharacterId",
    'character',
    NEW."killmailTime",
    NEW."totalValue",
    FALSE,  -- is_loss
    NEW.solo,
    NEW.npc
  );

  -- Update victim corporation stats (losses)
  PERFORM upsert_entity_stats(
    NEW."victimCorporationId",
    'corporation',
    NEW."killmailTime",
    NEW."totalValue",
    FALSE,  -- is_loss
    NEW.solo,
    NEW.npc
  );

  -- Update victim alliance stats (losses)
  PERFORM upsert_entity_stats(
    NEW."victimAllianceId",
    'alliance',
    NEW."killmailTime",
    NEW."totalValue",
    FALSE,  -- is_loss
    NEW.solo,
    NEW.npc
  );

  -- Update attacker faction stats (kills)
  PERFORM upsert_entity_stats(
    NEW."topAttackerFactionId",
    'faction',
    NEW."killmailTime",
    NEW."totalValue",
    TRUE,  -- is_kill
    NEW.solo,
    NEW.npc
  );

  -- Update victim faction stats (losses)
  PERFORM upsert_entity_stats(
    NEW."victimFactionId",
    'faction',
    NEW."killmailTime",
    NEW."totalValue",
    FALSE,  -- is_loss
    NEW.solo,
    NEW.npc
  );

  -- Update attacker ship group stats (kills)
  PERFORM upsert_entity_stats(
    NEW."topAttackerShipGroupId",
    'group',
    NEW."killmailTime",
    NEW."totalValue",
    TRUE,  -- is_kill
    NEW.solo,
    NEW.npc
  );

  -- Update victim ship group stats (losses)
  PERFORM upsert_entity_stats(
    NEW."victimShipGroupId",
    'group',
    NEW."killmailTime",
    NEW."totalValue",
    FALSE,  -- is_loss
    NEW.solo,
    NEW.npc
  );

  -- Update attacker ship type stats (kills)
  PERFORM upsert_entity_stats(
    NEW."topAttackerShipTypeId",
    'type',
    NEW."killmailTime",
    NEW."totalValue",
    TRUE,  -- is_kill
    NEW.solo,
    NEW.npc
  );

  -- Update victim ship type stats (losses)
  PERFORM upsert_entity_stats(
    NEW."victimShipTypeId",
    'type',
    NEW."killmailTime",
    NEW."totalValue",
    FALSE,  -- is_loss
    NEW.solo,
    NEW.npc
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger creation disabled - entity stats are now updated via queue-based processing
-- See queue/entity-stats.ts for the queue processor that handles entity stats updates
-- This eliminates deadlocks caused by concurrent killmail inserts

-- CREATE TRIGGER trigger_update_entity_stats_on_insert
--   AFTER INSERT ON killmails
--   FOR EACH ROW
--   EXECUTE FUNCTION update_entity_stats_on_insert();

COMMENT ON FUNCTION update_entity_stats_on_insert() IS 'Trigger function to update entity_stats_cache when killmails are inserted (currently disabled, replaced by queue-based processing)';

-- ============================================================================
-- NOTES
-- ============================================================================

/*
PERFORMANCE NOTES:
------------------

1. Trigger overhead: ~3-5ms per killmail insert
   - Acceptable for real-time WebSocket ingestion
   - Batched inserts will amortize the cost

2. Initial backfill: Use backfill script (separate file)
   - Estimated time: 1-2 hours for 90M killmails
   - Run during off-peak hours

3. Daily cleanup: See cron job (separate file)
   - Recalculates time-bucketed stats
   - Only processes active entities (last 90 days)

4. Index usage:
   - Primary key index on (entityId, entityType) for fast lookups
   - Composite indexes on entityType + kills for leaderboards

USAGE:
------

-- Get character stats (all time periods available)
SELECT * FROM entity_stats_cache
WHERE "entityId" = 123456 AND "entityType" = 'character';

-- Get top 100 characters by kills (last 30 days)
SELECT * FROM entity_stats_cache
WHERE "entityType" = 'character'
ORDER BY "kills30d" DESC
LIMIT 100;

MAINTENANCE:
------------

-- Check cache size
SELECT
  "entityType",
  COUNT(*) as entities,
  pg_size_pretty(pg_total_relation_size('entity_stats_cache')) as size
FROM entity_stats_cache
GROUP BY "entityType";

-- Find entities with no recent activity
SELECT COUNT(*) FROM entity_stats_cache
WHERE "lastKillTime" < NOW() - INTERVAL '90 days'
  AND "lastLossTime" < NOW() - INTERVAL '90 days';

*/

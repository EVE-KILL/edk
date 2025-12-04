-- Entity Stats Views
-- Creates unified views for character, corporation, and alliance statistics
-- PostgreSQL query planner will optimize these views when filtered by entity ID
-- Force migration rerun

SET client_min_messages TO WARNING;

-- Drop existing views if they exist
DROP VIEW IF EXISTS character_stats CASCADE;
DROP VIEW IF EXISTS corporation_stats CASCADE;
DROP VIEW IF EXISTS alliance_stats CASCADE;
DROP VIEW IF EXISTS faction_stats CASCADE;
DROP VIEW IF EXISTS entity_stats_unified CASCADE;

SET client_min_messages TO NOTICE;

-- ============================================================================
-- CHARACTER STATS VIEW
-- Aggregates all statistics for characters across all time
-- ============================================================================
CREATE VIEW character_stats AS
WITH character_kills AS (
  SELECT
    k."topAttackerCharacterId" AS "characterId",
    COUNT(*) AS kills,
    SUM(k."totalValue") AS "iskDestroyed",
    SUM(CASE WHEN k.solo THEN 1 ELSE 0 END) AS "soloKills",
    SUM(CASE WHEN k.npc THEN 1 ELSE 0 END) AS "npcKills",
    MAX(k."killmailTime") AS "lastKillTime"
  FROM killmails k
  WHERE k."topAttackerCharacterId" IS NOT NULL AND k."topAttackerCharacterId" != 0
  GROUP BY k."topAttackerCharacterId"
),
character_losses AS (
  SELECT
    k."victimCharacterId" AS "characterId",
    COUNT(*) AS losses,
    SUM(k."totalValue") AS "iskLost",
    SUM(CASE WHEN k.solo THEN 1 ELSE 0 END) AS "soloLosses",
    SUM(CASE WHEN k.npc THEN 1 ELSE 0 END) AS "npcLosses",
    MAX(k."killmailTime") AS "lastLossTime"
  FROM killmails k
  WHERE k."victimCharacterId" IS NOT NULL AND k."victimCharacterId" != 0
  GROUP BY k."victimCharacterId"
)
SELECT
  COALESCE(kills."characterId", losses."characterId") AS "characterId",
  'character'::text AS "entityType",
  COALESCE(kills.kills, 0) AS kills,
  COALESCE(losses.losses, 0) AS losses,
  COALESCE(kills."iskDestroyed", 0) AS "iskDestroyed",
  COALESCE(losses."iskLost", 0) AS "iskLost",
  CASE
    WHEN COALESCE(kills."iskDestroyed", 0) + COALESCE(losses."iskLost", 0) > 0
    THEN (COALESCE(kills."iskDestroyed", 0) / (COALESCE(kills."iskDestroyed", 0) + COALESCE(losses."iskLost", 0))) * 100
    ELSE 0
  END AS efficiency,
  CASE
    WHEN COALESCE(losses.losses, 0) > 0
    THEN COALESCE(kills.kills, 0)::numeric / losses.losses
    ELSE COALESCE(kills.kills, 0)
  END AS "killLossRatio",
  COALESCE(kills."soloKills", 0) AS "soloKills",
  COALESCE(losses."soloLosses", 0) AS "soloLosses",
  COALESCE(kills."npcKills", 0) AS "npcKills",
  COALESCE(losses."npcLosses", 0) AS "npcLosses",
  kills."lastKillTime",
  losses."lastLossTime",
  GREATEST(kills."lastKillTime", losses."lastLossTime") AS "lastActivityTime"
FROM character_kills kills
FULL OUTER JOIN character_losses losses ON kills."characterId" = losses."characterId";

-- Index hint: Create an index to help the view for single-character lookups
COMMENT ON VIEW character_stats IS 'Character statistics aggregated from killmails. Query planner will optimize when filtered by characterId.';

-- ============================================================================
-- CORPORATION STATS VIEW
-- Aggregates all statistics for corporations across all time
-- ============================================================================
CREATE VIEW corporation_stats AS
WITH corporation_kills AS (
  SELECT
    k."topAttackerCorporationId" AS "corporationId",
    COUNT(*) AS kills,
    SUM(k."totalValue") AS "iskDestroyed",
    SUM(CASE WHEN k.solo THEN 1 ELSE 0 END) AS "soloKills",
    SUM(CASE WHEN k.npc THEN 1 ELSE 0 END) AS "npcKills",
    MAX(k."killmailTime") AS "lastKillTime"
  FROM killmails k
  WHERE k."topAttackerCorporationId" IS NOT NULL AND k."topAttackerCorporationId" != 0
  GROUP BY k."topAttackerCorporationId"
),
corporation_losses AS (
  SELECT
    k."victimCorporationId" AS "corporationId",
    COUNT(*) AS losses,
    SUM(k."totalValue") AS "iskLost",
    SUM(CASE WHEN k.solo THEN 1 ELSE 0 END) AS "soloLosses",
    SUM(CASE WHEN k.npc THEN 1 ELSE 0 END) AS "npcLosses",
    MAX(k."killmailTime") AS "lastLossTime"
  FROM killmails k
  WHERE k."victimCorporationId" IS NOT NULL AND k."victimCorporationId" != 0
  GROUP BY k."victimCorporationId"
)
SELECT
  COALESCE(kills."corporationId", losses."corporationId") AS "corporationId",
  'corporation'::text AS "entityType",
  COALESCE(kills.kills, 0) AS kills,
  COALESCE(losses.losses, 0) AS losses,
  COALESCE(kills."iskDestroyed", 0) AS "iskDestroyed",
  COALESCE(losses."iskLost", 0) AS "iskLost",
  CASE
    WHEN COALESCE(kills."iskDestroyed", 0) + COALESCE(losses."iskLost", 0) > 0
    THEN (COALESCE(kills."iskDestroyed", 0) / (COALESCE(kills."iskDestroyed", 0) + COALESCE(losses."iskLost", 0))) * 100
    ELSE 0
  END AS efficiency,
  CASE
    WHEN COALESCE(losses.losses, 0) > 0
    THEN COALESCE(kills.kills, 0)::numeric / losses.losses
    ELSE COALESCE(kills.kills, 0)
  END AS "killLossRatio",
  COALESCE(kills."soloKills", 0) AS "soloKills",
  COALESCE(losses."soloLosses", 0) AS "soloLosses",
  COALESCE(kills."npcKills", 0) AS "npcKills",
  COALESCE(losses."npcLosses", 0) AS "npcLosses",
  kills."lastKillTime",
  losses."lastLossTime",
  GREATEST(kills."lastKillTime", losses."lastLossTime") AS "lastActivityTime"
FROM corporation_kills kills
FULL OUTER JOIN corporation_losses losses ON kills."corporationId" = losses."corporationId";

COMMENT ON VIEW corporation_stats IS 'Corporation statistics aggregated from killmails. Query planner will optimize when filtered by corporationId.';

-- ============================================================================
-- ALLIANCE STATS VIEW
-- Aggregates all statistics for alliances across all time
-- ============================================================================
CREATE VIEW alliance_stats AS
WITH alliance_kills AS (
  SELECT
    k."topAttackerAllianceId" AS "allianceId",
    COUNT(*) AS kills,
    SUM(k."totalValue") AS "iskDestroyed",
    SUM(CASE WHEN k.solo THEN 1 ELSE 0 END) AS "soloKills",
    SUM(CASE WHEN k.npc THEN 1 ELSE 0 END) AS "npcKills",
    MAX(k."killmailTime") AS "lastKillTime"
  FROM killmails k
  WHERE k."topAttackerAllianceId" IS NOT NULL AND k."topAttackerAllianceId" != 0
  GROUP BY k."topAttackerAllianceId"
),
alliance_losses AS (
  SELECT
    k."victimAllianceId" AS "allianceId",
    COUNT(*) AS losses,
    SUM(k."totalValue") AS "iskLost",
    SUM(CASE WHEN k.solo THEN 1 ELSE 0 END) AS "soloLosses",
    SUM(CASE WHEN k.npc THEN 1 ELSE 0 END) AS "npcLosses",
    MAX(k."killmailTime") AS "lastLossTime"
  FROM killmails k
  WHERE k."victimAllianceId" IS NOT NULL AND k."victimAllianceId" != 0
  GROUP BY k."victimAllianceId"
)
SELECT
  COALESCE(kills."allianceId", losses."allianceId") AS "allianceId",
  'alliance'::text AS "entityType",
  COALESCE(kills.kills, 0) AS kills,
  COALESCE(losses.losses, 0) AS losses,
  COALESCE(kills."iskDestroyed", 0) AS "iskDestroyed",
  COALESCE(losses."iskLost", 0) AS "iskLost",
  CASE
    WHEN COALESCE(kills."iskDestroyed", 0) + COALESCE(losses."iskLost", 0) > 0
    THEN (COALESCE(kills."iskDestroyed", 0) / (COALESCE(kills."iskDestroyed", 0) + COALESCE(losses."iskLost", 0))) * 100
    ELSE 0
  END AS efficiency,
  CASE
    WHEN COALESCE(losses.losses, 0) > 0
    THEN COALESCE(kills.kills, 0)::numeric / losses.losses
    ELSE COALESCE(kills.kills, 0)
  END AS "killLossRatio",
  COALESCE(kills."soloKills", 0) AS "soloKills",
  COALESCE(losses."soloLosses", 0) AS "soloLosses",
  COALESCE(kills."npcKills", 0) AS "npcKills",
  COALESCE(losses."npcLosses", 0) AS "npcLosses",
  kills."lastKillTime",
  losses."lastLossTime",
  GREATEST(kills."lastKillTime", losses."lastLossTime") AS "lastActivityTime"
FROM alliance_kills kills
FULL OUTER JOIN alliance_losses losses ON kills."allianceId" = losses."allianceId";

COMMENT ON VIEW alliance_stats IS 'Alliance statistics aggregated from killmails. Query planner will optimize when filtered by allianceId.';

-- ============================================================================
-- FACTION STATS VIEW
-- Aggregates all statistics for factions across all time
-- ============================================================================
CREATE VIEW faction_stats AS
WITH faction_kills AS (
  SELECT
    k."topAttackerFactionId" AS "factionId",
    COUNT(*) AS kills,
    SUM(k."totalValue") AS "iskDestroyed",
    SUM(CASE WHEN k.solo THEN 1 ELSE 0 END) AS "soloKills",
    SUM(CASE WHEN k.npc THEN 1 ELSE 0 END) AS "npcKills",
    MAX(k."killmailTime") AS "lastKillTime"
  FROM killmails k
  WHERE k."topAttackerFactionId" IS NOT NULL AND k."topAttackerFactionId" != 0
  GROUP BY k."topAttackerFactionId"
),
faction_losses AS (
  SELECT
    k."victimFactionId" AS "factionId",
    COUNT(*) AS losses,
    SUM(k."totalValue") AS "iskLost",
    SUM(CASE WHEN k.solo THEN 1 ELSE 0 END) AS "soloLosses",
    SUM(CASE WHEN k.npc THEN 1 ELSE 0 END) AS "npcLosses",
    MAX(k."killmailTime") AS "lastLossTime"
  FROM killmails k
  WHERE k."victimFactionId" IS NOT NULL AND k."victimFactionId" != 0
  GROUP BY k."victimFactionId"
)
SELECT
  COALESCE(kills."factionId", losses."factionId") AS "factionId",
  'faction'::text AS "entityType",
  COALESCE(kills.kills, 0) AS kills,
  COALESCE(losses.losses, 0) AS losses,
  COALESCE(kills."iskDestroyed", 0) AS "iskDestroyed",
  COALESCE(losses."iskLost", 0) AS "iskLost",
  CASE
    WHEN COALESCE(kills."iskDestroyed", 0) + COALESCE(losses."iskLost", 0) > 0
    THEN (COALESCE(kills."iskDestroyed", 0) / (COALESCE(kills."iskDestroyed", 0) + COALESCE(losses."iskLost", 0))) * 100
    ELSE 0
  END AS efficiency,
  CASE
    WHEN COALESCE(losses.losses, 0) > 0
    THEN COALESCE(kills.kills, 0)::numeric / losses.losses
    ELSE COALESCE(kills.kills, 0)
  END AS "killLossRatio",
  COALESCE(kills."soloKills", 0) AS "soloKills",
  COALESCE(losses."soloLosses", 0) AS "soloLosses",
  COALESCE(kills."npcKills", 0) AS "npcKills",
  COALESCE(losses."npcLosses", 0) AS "npcLosses",
  kills."lastKillTime",
  losses."lastLossTime",
  GREATEST(kills."lastKillTime", losses."lastLossTime") AS "lastActivityTime"
FROM faction_kills kills
FULL OUTER JOIN faction_losses losses ON kills."factionId" = losses."factionId";

COMMENT ON VIEW faction_stats IS 'Faction statistics aggregated from killmails. Query planner will optimize when filtered by factionId.';

-- ============================================================================
-- USAGE EXAMPLES AND PERFORMANCE NOTES
-- ============================================================================
/*

USAGE EXAMPLES:
---------------

-- Get stats for a specific character:
SELECT * FROM character_stats WHERE "characterId" = 123456;

-- Get stats for a specific corporation:
SELECT * FROM corporation_stats WHERE "corporationId" = 98765;

-- Get stats for a specific alliance:
SELECT * FROM alliance_stats WHERE "allianceId" = 99001234;

-- Get stats for a specific faction:
SELECT * FROM faction_stats WHERE "factionId" = 500001;

-- Top 10 characters by kills:
SELECT c.name, cs.*
FROM character_stats cs
JOIN characters c ON cs."characterId" = c."characterId"
ORDER BY cs.kills DESC
LIMIT 10;


PERFORMANCE NOTES:
------------------

1. The views use CTEs with FULL OUTER JOIN to handle entities with only kills or only losses.

2. PostgreSQL query planner will optimize these views when you add WHERE clauses:
   - WHERE "characterId" = X will push down the filter and only scan relevant partitions
   - The existing indexes on killmails table will be used efficiently

3. For time-filtered stats (last 7 days, etc), add time filter in your query:
   - The view definition doesn't include time filters to maximize query planner flexibility
   - Example: SELECT * FROM character_stats WHERE "lastActivityTime" >= NOW() - INTERVAL '7 days'

4. For time-based aggregations, modify the CTE WHERE clauses in your application query:
   ```sql
   WITH character_kills_weekly AS (
     SELECT "topAttackerCharacterId", COUNT(*) as kills
     FROM killmails
     WHERE "topAttackerCharacterId" = 123456
       AND "killmailTime" >= NOW() - INTERVAL '7 days'
     GROUP BY "topAttackerCharacterId"
   )
   ```

5. Consider adding partial indexes for time-based queries:
   CREATE INDEX idx_killmails_recent_char_kills
     ON killmails("topAttackerCharacterId", "totalValue")
     WHERE "killmailTime" >= NOW() - INTERVAL '90 days';

6. The views DO NOT materialize data - they compute on demand.
   - Use Redis caching at the application layer for frequently accessed entities
   - Consider materialized views only for "top 100" or "leaderboard" queries

*/

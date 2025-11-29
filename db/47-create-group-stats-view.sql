-- Group Stats View
-- Creates view for group (ship group) statistics
-- PostgreSQL query planner will optimize these views when filtered by group ID

SET client_min_messages TO WARNING;

-- Drop existing view if it exists
DROP VIEW IF EXISTS group_stats CASCADE;

SET client_min_messages TO NOTICE;

-- ============================================================================
-- GROUP STATS VIEW
-- Aggregates all statistics for groups (ship groups) across all time
-- ============================================================================
CREATE VIEW group_stats AS
WITH group_kills AS (
  SELECT
    k."topAttackerShipGroupId" AS "groupId",
    COUNT(*) AS kills,
    SUM(k."totalValue") AS "iskDestroyed",
    SUM(CASE WHEN k.solo THEN 1 ELSE 0 END) AS "soloKills",
    SUM(CASE WHEN k.npc THEN 1 ELSE 0 END) AS "npcKills",
    MAX(k."killmailTime") AS "lastKillTime"
  FROM killmails k
  WHERE k."topAttackerShipGroupId" IS NOT NULL
  GROUP BY k."topAttackerShipGroupId"
),
group_losses AS (
  SELECT
    k."victimShipGroupId" AS "groupId",
    COUNT(*) AS losses,
    SUM(k."totalValue") AS "iskLost",
    SUM(CASE WHEN k.solo THEN 1 ELSE 0 END) AS "soloLosses",
    SUM(CASE WHEN k.npc THEN 1 ELSE 0 END) AS "npcLosses",
    MAX(k."killmailTime") AS "lastLossTime"
  FROM killmails k
  WHERE k."victimShipGroupId" IS NOT NULL
  GROUP BY k."victimShipGroupId"
)
SELECT
  COALESCE(kills."groupId", losses."groupId") AS "groupId",
  'group'::text AS "entityType",
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
FROM group_kills kills
FULL OUTER JOIN group_losses losses ON kills."groupId" = losses."groupId";

COMMENT ON VIEW group_stats IS 'Group statistics aggregated from killmails. Query planner will optimize when filtered by groupId.';

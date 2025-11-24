-- Drop existing views in reverse order of dependency
SET client_min_messages TO WARNING;
DROP MATERIALIZED VIEW IF EXISTS top_characters_weekly CASCADE;
DROP MATERIALIZED VIEW IF EXISTS top_corporations_weekly CASCADE;
DROP MATERIALIZED VIEW IF EXISTS top_alliances_weekly CASCADE;
DROP MATERIALIZED VIEW IF EXISTS top_systems_weekly CASCADE;
DROP MATERIALIZED VIEW IF EXISTS top_regions_weekly CASCADE;
DROP VIEW IF EXISTS kill_list CASCADE;
SET client_min_messages TO NOTICE;

-- Add indexes to base tables to optimize kill_list view queries
-- These indexes support the common query patterns: filtering by entity IDs, time-based queries, and aggregations

-- Indexes for top attacker queries (kills by entity)
CREATE INDEX IF NOT EXISTS idx_killmails_top_attacker_char ON killmails("topAttackerCharacterId", "killmailTime" DESC) WHERE "topAttackerCharacterId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_killmails_top_attacker_corp ON killmails("topAttackerCorporationId", "killmailTime" DESC) WHERE "topAttackerCorporationId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_killmails_top_attacker_ally ON killmails("topAttackerAllianceId", "killmailTime" DESC) WHERE "topAttackerAllianceId" IS NOT NULL;

-- Composite indexes for victim queries (losses by entity) - time is already indexed separately
CREATE INDEX IF NOT EXISTS idx_killmails_victim_char_time ON killmails("victimCharacterId", "killmailTime" DESC) WHERE "victimCharacterId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_killmails_victim_corp_time ON killmails("victimCorporationId", "killmailTime" DESC);
CREATE INDEX IF NOT EXISTS idx_killmails_victim_ally_time ON killmails("victimAllianceId", "killmailTime" DESC) WHERE "victimAllianceId" IS NOT NULL;

-- Indexes for ship group filtering (big ships filter)
CREATE INDEX IF NOT EXISTS idx_killmails_victim_ship_type_time ON killmails("victimShipTypeId", "killmailTime" DESC);

-- Indexes for value filtering and sorting
CREATE INDEX IF NOT EXISTS idx_killmails_value_time ON killmails("totalValue" DESC, "killmailTime" DESC);

-- Indexes for flags (npc, solo, awox filters)
CREATE INDEX IF NOT EXISTS idx_killmails_npc_time ON killmails("npc", "killmailTime" DESC) WHERE "npc" = true;
CREATE INDEX IF NOT EXISTS idx_killmails_solo_time ON killmails("solo", "killmailTime" DESC) WHERE "solo" = true;

-- Composite index for weekly aggregations (used by top_* materialized views)
-- Note: Cannot use NOW() in index predicate (not immutable), so we index all rows
CREATE INDEX IF NOT EXISTS idx_killmails_time_attackers ON killmails("killmailTime" DESC, "topAttackerCharacterId", "topAttackerCorporationId", "topAttackerAllianceId", "totalValue");

-- Note: kill_list view has been removed.
-- All queries now use killmails table directly with denormalized fields.
-- The view was never used except by top_* materialized views, which now query directly.

-- Create top stats materialized views (these are small - only 10 rows each)
-- Query killmails directly with JOINs for names only
CREATE MATERIALIZED VIEW IF NOT EXISTS top_characters_weekly AS
SELECT
    k."topAttackerCharacterId" AS id,
    COALESCE(c.name, npc.name) AS name,
    COUNT(*) AS kills,
    SUM(k."totalValue") AS "iskDestroyed"
FROM killmails k
LEFT JOIN characters c ON k."topAttackerCharacterId" = c."characterId"
LEFT JOIN npcCharacters npc ON k."topAttackerCharacterId" = npc."characterId"
WHERE k."killmailTime" >= NOW() - INTERVAL '7 days' AND k."topAttackerCharacterId" IS NOT NULL
GROUP BY k."topAttackerCharacterId", c.name, npc.name
ORDER BY kills DESC
LIMIT 10;
-- The unique index is REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS top_characters_weekly_id_idx ON top_characters_weekly(id);

CREATE MATERIALIZED VIEW IF NOT EXISTS top_corporations_weekly AS
SELECT
    k."topAttackerCorporationId" AS id,
    COALESCE(corp.name, npc_corp.name) AS name,
    COUNT(*) AS kills,
    SUM(k."totalValue") AS "iskDestroyed"
FROM killmails k
LEFT JOIN corporations corp ON k."topAttackerCorporationId" = corp."corporationId"
LEFT JOIN npcCorporations npc_corp ON k."topAttackerCorporationId" = npc_corp."corporationId"
WHERE k."killmailTime" >= NOW() - INTERVAL '7 days' AND k."topAttackerCorporationId" IS NOT NULL
GROUP BY k."topAttackerCorporationId", corp.name, npc_corp.name
ORDER BY kills DESC
LIMIT 10;
-- The unique index is REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS top_corporations_weekly_id_idx ON top_corporations_weekly(id);

CREATE MATERIALIZED VIEW IF NOT EXISTS top_alliances_weekly AS
SELECT
    k."topAttackerAllianceId" AS id,
    ally.name AS name,
    COUNT(*) AS kills,
    SUM(k."totalValue") AS "iskDestroyed"
FROM killmails k
LEFT JOIN alliances ally ON k."topAttackerAllianceId" = ally."allianceId"
WHERE k."killmailTime" >= NOW() - INTERVAL '7 days' AND k."topAttackerAllianceId" IS NOT NULL
GROUP BY k."topAttackerAllianceId", ally.name
ORDER BY kills DESC
LIMIT 10;
-- The unique index is REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS top_alliances_weekly_id_idx ON top_alliances_weekly(id);

CREATE MATERIALIZED VIEW IF NOT EXISTS top_systems_weekly AS
SELECT
    k."solarSystemId" AS id,
    ss.name AS name,
    COUNT(*) AS kills,
    SUM(k."totalValue") AS "iskDestroyed"
FROM killmails k
LEFT JOIN solarSystems ss ON k."solarSystemId" = ss."solarSystemId"
WHERE k."killmailTime" >= NOW() - INTERVAL '7 days'
GROUP BY k."solarSystemId", ss.name
ORDER BY kills DESC
LIMIT 10;
-- The unique index is REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS top_systems_weekly_id_idx ON top_systems_weekly(id);

CREATE MATERIALIZED VIEW IF NOT EXISTS top_regions_weekly AS
SELECT
    k."regionId" AS id,
    r.name AS name,
    COUNT(*) AS kills,
    SUM(k."totalValue") AS "iskDestroyed"
FROM killmails k
LEFT JOIN regions r ON k."regionId" = r."regionId"
WHERE k."killmailTime" >= NOW() - INTERVAL '7 days'
GROUP BY k."regionId", r.name
ORDER BY kills DESC
LIMIT 10;
-- The unique index is REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS top_regions_weekly_id_idx ON top_regions_weekly(id);

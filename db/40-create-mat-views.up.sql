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

-- Recreate kill_list as a regular VIEW (not materialized)
-- This avoids storing 90M+ rows of denormalized data
CREATE VIEW kill_list AS
SELECT
    k."killmailId",
    k."killmailTime",
    k."solarSystemId",
    ss.name AS "solarSystemName",
    ss."regionId",
    r.name AS "regionName",
    ss."securityStatus" AS security,
    k."victimCharacterId",
    COALESCE(vc.name, vnpc.name, 'Unknown') AS "victimCharacterName",
    k."victimCorporationId",
    COALESCE(vcorp.name, vnpc_corp.name, 'Unknown') AS "victimCorporationName",
    COALESCE(vcorp.ticker, vnpc_corp."tickerName", '???') AS "victimCorporationTicker",
    k."victimAllianceId",
    valliance.name AS "victimAllianceName",
    valliance.ticker AS "victimAllianceTicker",
    k."victimShipTypeId",
    COALESCE(vship.name, 'Unknown') AS "victimShipName",
    COALESCE(vshipgroup.name, 'Unknown') AS "victimShipGroup",
    vship."groupId" AS "victimShipGroupId",
    k."victimDamageTaken",
    k."topAttackerCharacterId" AS "attackerCharacterId",
    COALESCE(ac.name, anpc.name, 'Unknown') AS "attackerCharacterName",
    k."topAttackerCorporationId" AS "attackerCorporationId",
    COALESCE(acorp.name, anpc_corp.name, 'Unknown') AS "attackerCorporationName",
    COALESCE(acorp.ticker, anpc_corp."tickerName", '???') AS "attackerCorporationTicker",
    k."topAttackerAllianceId" AS "attackerAllianceId",
    aalliance.name AS "attackerAllianceName",
    aalliance.ticker AS "attackerAllianceTicker",
    k."topAttackerShipTypeId" AS "attackerShipTypeId",
    COALESCE(aship.name, 'Unknown') as "attackerShipName",
    k."totalValue",
    k."attackerCount",
    k.npc,
    k.solo,
    k.awox
FROM killmails k
LEFT JOIN solarsystems ss ON k."solarSystemId" = ss."solarSystemId"
LEFT JOIN regions r ON ss."regionId" = r."regionId"
-- Victim JOINs
LEFT JOIN characters vc ON k."victimCharacterId" = vc."characterId"
LEFT JOIN npccharacters vnpc ON k."victimCharacterId" = vnpc."characterId"
LEFT JOIN corporations vcorp ON k."victimCorporationId" = vcorp."corporationId"
LEFT JOIN npccorporations vnpc_corp ON k."victimCorporationId" = vnpc_corp."corporationId"
LEFT JOIN alliances valliance ON k."victimAllianceId" = valliance."allianceId"
LEFT JOIN types vship ON k."victimShipTypeId" = vship."typeId"
LEFT JOIN groups vshipgroup ON vship."groupId" = vshipgroup."groupId"
-- Attacker JOINs
LEFT JOIN characters ac ON k."topAttackerCharacterId" = ac."characterId"
LEFT JOIN npccharacters anpc ON k."topAttackerCharacterId" = anpc."characterId"
LEFT JOIN corporations acorp ON k."topAttackerCorporationId" = acorp."corporationId"
LEFT JOIN npccorporations anpc_corp ON k."topAttackerCorporationId" = anpc_corp."corporationId"
LEFT JOIN alliances aalliance ON k."topAttackerAllianceId" = aalliance."allianceId"
LEFT JOIN types aship ON k."topAttackerShipTypeId" = aship."typeId";

-- Note: kill_list is now a regular view, not materialized.
-- Indexes are on the base killmails table above.
-- This avoids materializing 90M+ rows while still providing good query performance.

-- Create top stats materialized views (these are small - only 10 rows each)
CREATE MATERIALIZED VIEW IF NOT EXISTS top_characters_weekly AS
SELECT
    "attackerCharacterId" AS id,
    "attackerCharacterName" AS name,
    COUNT(*) AS kills,
    SUM("totalValue") AS "iskDestroyed"
FROM kill_list
WHERE "killmailTime" >= NOW() - INTERVAL '7 days' AND "attackerCharacterId" IS NOT NULL
GROUP BY "attackerCharacterId", "attackerCharacterName"
ORDER BY kills DESC
LIMIT 10;
-- The unique index is REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS top_characters_weekly_id_idx ON top_characters_weekly(id);

CREATE MATERIALIZED VIEW IF NOT EXISTS top_corporations_weekly AS
SELECT
    "attackerCorporationId" AS id,
    "attackerCorporationName" AS name,
    COUNT(*) AS kills,
    SUM("totalValue") AS "iskDestroyed"
FROM kill_list
WHERE "killmailTime" >= NOW() - INTERVAL '7 days' AND "attackerCorporationId" IS NOT NULL
GROUP BY "attackerCorporationId", "attackerCorporationName"
ORDER BY kills DESC
LIMIT 10;
-- The unique index is REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS top_corporations_weekly_id_idx ON top_corporations_weekly(id);

CREATE MATERIALIZED VIEW IF NOT EXISTS top_alliances_weekly AS
SELECT
    "attackerAllianceId" AS id,
    "attackerAllianceName" AS name,
    COUNT(*) AS kills,
    SUM("totalValue") AS "iskDestroyed"
FROM kill_list
WHERE "killmailTime" >= NOW() - INTERVAL '7 days' AND "attackerAllianceId" IS NOT NULL
GROUP BY "attackerAllianceId", "attackerAllianceName"
ORDER BY kills DESC
LIMIT 10;
-- The unique index is REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS top_alliances_weekly_id_idx ON top_alliances_weekly(id);

CREATE MATERIALIZED VIEW IF NOT EXISTS top_systems_weekly AS
SELECT
    "solarSystemId" AS id,
    "solarSystemName" AS name,
    COUNT(*) AS kills,
    SUM("totalValue") AS "iskDestroyed"
FROM kill_list
WHERE "killmailTime" >= NOW() - INTERVAL '7 days'
GROUP BY "solarSystemId", "solarSystemName"
ORDER BY kills DESC
LIMIT 10;
-- The unique index is REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS top_systems_weekly_id_idx ON top_systems_weekly(id);

CREATE MATERIALIZED VIEW IF NOT EXISTS top_regions_weekly AS
SELECT
    "regionId" AS id,
    "regionName" AS name,
    COUNT(*) AS kills,
    SUM("totalValue") AS "iskDestroyed"
FROM kill_list
WHERE "killmailTime" >= NOW() - INTERVAL '7 days'
GROUP BY "regionId", "regionName"
ORDER BY kills DESC
LIMIT 10;
-- The unique index is REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS top_regions_weekly_id_idx ON top_regions_weekly(id);

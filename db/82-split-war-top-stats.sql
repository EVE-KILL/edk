-- ============================================================================
-- SPLIT WAR TOP STATISTICS
-- Splits the massive war_top_statistics view into regular and faction views
-- to allow for different refresh schedules.
-- ============================================================================

SET client_min_messages TO WARNING;

-- Drop the existing monolithic view
DROP MATERIALIZED VIEW IF EXISTS war_top_statistics CASCADE;

-- ============================================================================
-- 1. REGULAR WARS (Hourly Refresh)
-- ============================================================================

CREATE MATERIALIZED VIEW war_top_statistics_regular AS
SELECT
    ROW_NUMBER() OVER (ORDER BY "warId", category, kills DESC, "iskValue" DESC) AS id,
    "warId",
    category,
    "entityId",
    "entityName",
    kills,
    "iskValue"
FROM (
-- Top 10 Characters
SELECT
    "warId", 'character' AS category, "entityId", "entityName", kills, "iskValue"
FROM (
    SELECT
        k."warId",
        a."characterId" AS "entityId",
        COALESCE(c.name, 'Character #' || a."characterId") AS "entityName",
        COUNT(DISTINCT k."killmailId")::int AS kills,
        COALESCE(SUM(k."totalValue"), 0)::float AS "iskValue",
        ROW_NUMBER() OVER (PARTITION BY k."warId" ORDER BY COUNT(DISTINCT k."killmailId") DESC, SUM(k."totalValue") DESC) as rn
    FROM killmails k
    JOIN attackers a ON k."killmailId" = a."killmailId"
    LEFT JOIN characters c ON c."characterId" = a."characterId"
    WHERE k."warId" IS NOT NULL
      AND k."warId" NOT IN (999999999999999, 999999999999998) -- Exclude faction wars
      AND a."characterId" IS NOT NULL AND a."characterId" != 0
    GROUP BY k."warId", a."characterId", c.name
) sub WHERE rn <= 10

UNION ALL

-- Top 10 Corporations
SELECT
    "warId", 'corporation' AS category, "entityId", "entityName", kills, "iskValue"
FROM (
    SELECT
        k."warId",
        a."corporationId" AS "entityId",
        COALESCE(corp.name, 'Corporation #' || a."corporationId") AS "entityName",
        COUNT(DISTINCT k."killmailId")::int AS kills,
        COALESCE(SUM(k."totalValue"), 0)::float AS "iskValue",
        ROW_NUMBER() OVER (PARTITION BY k."warId" ORDER BY COUNT(DISTINCT k."killmailId") DESC, SUM(k."totalValue") DESC) as rn
    FROM killmails k
    JOIN attackers a ON k."killmailId" = a."killmailId"
    LEFT JOIN corporations corp ON corp."corporationId" = a."corporationId"
    WHERE k."warId" IS NOT NULL
      AND k."warId" NOT IN (999999999999999, 999999999999998)
      AND a."corporationId" IS NOT NULL AND a."corporationId" != 0
    GROUP BY k."warId", a."corporationId", corp.name
) sub WHERE rn <= 10

UNION ALL

-- Top 10 Alliances
SELECT
    "warId", 'alliance' AS category, "entityId", "entityName", kills, "iskValue"
FROM (
    SELECT
        k."warId",
        a."allianceId" AS "entityId",
        COALESCE(ally.name, 'Alliance #' || a."allianceId") AS "entityName",
        COUNT(DISTINCT k."killmailId")::int AS kills,
        COALESCE(SUM(k."totalValue"), 0)::float AS "iskValue",
        ROW_NUMBER() OVER (PARTITION BY k."warId" ORDER BY COUNT(DISTINCT k."killmailId") DESC, SUM(k."totalValue") DESC) as rn
    FROM killmails k
    JOIN attackers a ON k."killmailId" = a."killmailId"
    LEFT JOIN alliances ally ON ally."allianceId" = a."allianceId"
    WHERE k."warId" IS NOT NULL
      AND k."warId" NOT IN (999999999999999, 999999999999998)
      AND a."allianceId" IS NOT NULL AND a."allianceId" != 0
    GROUP BY k."warId", a."allianceId", ally.name
) sub WHERE rn <= 10

UNION ALL

-- Top 10 Ships
SELECT
    "warId", 'ship' AS category, "entityId", "entityName", kills, "iskValue"
FROM (
    SELECT
        k."warId",
        k."victimShipTypeId" AS "entityId",
        COALESCE(t.name, 'Ship #' || k."victimShipTypeId") AS "entityName",
        COUNT(DISTINCT k."killmailId")::int AS kills,
        COALESCE(SUM(k."totalValue"), 0)::float AS "iskValue",
        ROW_NUMBER() OVER (PARTITION BY k."warId" ORDER BY COUNT(DISTINCT k."killmailId") DESC, SUM(k."totalValue") DESC) as rn
    FROM killmails k
    LEFT JOIN types t ON t."typeId" = k."victimShipTypeId"
    WHERE k."warId" IS NOT NULL
      AND k."warId" NOT IN (999999999999999, 999999999999998)
      AND k."victimShipTypeId" IS NOT NULL AND k."victimShipTypeId" != 0
    GROUP BY k."warId", k."victimShipTypeId", t.name
) sub WHERE rn <= 10

UNION ALL

-- Top 10 Systems
SELECT
    "warId", 'system' AS category, "entityId", "entityName", kills, "iskValue"
FROM (
    SELECT
        k."warId",
        k."solarSystemId" AS "entityId",
        COALESCE(sys.name, 'System #' || k."solarSystemId") AS "entityName",
        COUNT(DISTINCT k."killmailId")::int AS kills,
        COALESCE(SUM(k."totalValue"), 0)::float AS "iskValue",
        ROW_NUMBER() OVER (PARTITION BY k."warId" ORDER BY COUNT(DISTINCT k."killmailId") DESC, SUM(k."totalValue") DESC) as rn
    FROM killmails k
    LEFT JOIN solarsystems sys ON sys."solarSystemId" = k."solarSystemId"
    WHERE k."warId" IS NOT NULL
      AND k."warId" NOT IN (999999999999999, 999999999999998)
      AND k."solarSystemId" IS NOT NULL AND k."solarSystemId" != 0
    GROUP BY k."warId", k."solarSystemId", sys.name
) sub WHERE rn <= 10

UNION ALL

-- Top 10 Regions
SELECT
    "warId", 'region' AS category, "entityId", "entityName", kills, "iskValue"
FROM (
    SELECT
        k."warId",
        k."regionId" AS "entityId",
        COALESCE(reg.name, 'Region #' || k."regionId") AS "entityName",
        COUNT(DISTINCT k."killmailId")::int AS kills,
        COALESCE(SUM(k."totalValue"), 0)::float AS "iskValue",
        ROW_NUMBER() OVER (PARTITION BY k."warId" ORDER BY COUNT(DISTINCT k."killmailId") DESC, SUM(k."totalValue") DESC) as rn
    FROM killmails k
    LEFT JOIN regions reg ON reg."regionId" = k."regionId"
    WHERE k."warId" IS NOT NULL
      AND k."warId" NOT IN (999999999999999, 999999999999998)
      AND k."regionId" IS NOT NULL AND k."regionId" != 0
    GROUP BY k."warId", k."regionId", reg.name
) sub WHERE rn <= 10
) all_stats
WITH NO DATA;

CREATE UNIQUE INDEX war_top_stats_reg_id_idx ON war_top_statistics_regular(id);
CREATE INDEX war_top_stats_reg_war_cat_idx ON war_top_statistics_regular("warId", category);
CREATE INDEX war_top_stats_reg_war_idx ON war_top_statistics_regular("warId");


-- ============================================================================
-- 2. FACTION WARS (Daily Refresh)
-- ============================================================================

CREATE MATERIALIZED VIEW war_top_statistics_faction AS
SELECT
    ROW_NUMBER() OVER (ORDER BY "warId", category, kills DESC, "iskValue" DESC) AS id,
    "warId",
    category,
    "entityId",
    "entityName",
    kills,
    "iskValue"
FROM (
-- Top 10 Characters
SELECT
    "warId", 'character' AS category, "entityId", "entityName", kills, "iskValue"
FROM (
    SELECT
        w."warId",
        a."characterId" AS "entityId",
        COALESCE(c.name, 'Character #' || a."characterId") AS "entityName",
        COUNT(DISTINCT k."killmailId")::int AS kills,
        COALESCE(SUM(k."totalValue"), 0)::float AS "iskValue",
        ROW_NUMBER() OVER (PARTITION BY w."warId" ORDER BY COUNT(DISTINCT k."killmailId") DESC, SUM(k."totalValue") DESC) as rn
    FROM wars w
    JOIN killmails k ON k."victimFactionId" IN (w."aggressorAllianceId", w."defenderAllianceId") AND k."warId" IS NULL
    JOIN attackers a ON k."killmailId" = a."killmailId"
    LEFT JOIN characters c ON c."characterId" = a."characterId"
    WHERE w."warId" IN (999999999999999, 999999999999998)
      AND a."characterId" IS NOT NULL AND a."characterId" != 0
    GROUP BY w."warId", a."characterId", c.name
) sub WHERE rn <= 10

UNION ALL

-- Top 10 Corporations
SELECT
    "warId", 'corporation' AS category, "entityId", "entityName", kills, "iskValue"
FROM (
    SELECT
        w."warId",
        a."corporationId" AS "entityId",
        COALESCE(corp.name, 'Corporation #' || a."corporationId") AS "entityName",
        COUNT(DISTINCT k."killmailId")::int AS kills,
        COALESCE(SUM(k."totalValue"), 0)::float AS "iskValue",
        ROW_NUMBER() OVER (PARTITION BY w."warId" ORDER BY COUNT(DISTINCT k."killmailId") DESC, SUM(k."totalValue") DESC) as rn
    FROM wars w
    JOIN killmails k ON k."victimFactionId" IN (w."aggressorAllianceId", w."defenderAllianceId") AND k."warId" IS NULL
    JOIN attackers a ON k."killmailId" = a."killmailId"
    LEFT JOIN corporations corp ON corp."corporationId" = a."corporationId"
    WHERE w."warId" IN (999999999999999, 999999999999998)
      AND a."corporationId" IS NOT NULL AND a."corporationId" != 0
    GROUP BY w."warId", a."corporationId", corp.name
) sub WHERE rn <= 10

UNION ALL

-- Top 10 Alliances
SELECT
    "warId", 'alliance' AS category, "entityId", "entityName", kills, "iskValue"
FROM (
    SELECT
        w."warId",
        a."allianceId" AS "entityId",
        COALESCE(ally.name, 'Alliance #' || a."allianceId") AS "entityName",
        COUNT(DISTINCT k."killmailId")::int AS kills,
        COALESCE(SUM(k."totalValue"), 0)::float AS "iskValue",
        ROW_NUMBER() OVER (PARTITION BY w."warId" ORDER BY COUNT(DISTINCT k."killmailId") DESC, SUM(k."totalValue") DESC) as rn
    FROM wars w
    JOIN killmails k ON k."victimFactionId" IN (w."aggressorAllianceId", w."defenderAllianceId") AND k."warId" IS NULL
    JOIN attackers a ON k."killmailId" = a."killmailId"
    LEFT JOIN alliances ally ON ally."allianceId" = a."allianceId"
    WHERE w."warId" IN (999999999999999, 999999999999998)
      AND a."allianceId" IS NOT NULL AND a."allianceId" != 0
    GROUP BY w."warId", a."allianceId", ally.name
) sub WHERE rn <= 10

UNION ALL

-- Top 10 Ships
SELECT
    "warId", 'ship' AS category, "entityId", "entityName", kills, "iskValue"
FROM (
    SELECT
        w."warId",
        k."victimShipTypeId" AS "entityId",
        COALESCE(t.name, 'Ship #' || k."victimShipTypeId") AS "entityName",
        COUNT(DISTINCT k."killmailId")::int AS kills,
        COALESCE(SUM(k."totalValue"), 0)::float AS "iskValue",
        ROW_NUMBER() OVER (PARTITION BY w."warId" ORDER BY COUNT(DISTINCT k."killmailId") DESC, SUM(k."totalValue") DESC) as rn
    FROM wars w
    JOIN killmails k ON k."victimFactionId" IN (w."aggressorAllianceId", w."defenderAllianceId") AND k."warId" IS NULL
    LEFT JOIN types t ON t."typeId" = k."victimShipTypeId"
    WHERE w."warId" IN (999999999999999, 999999999999998)
      AND k."victimShipTypeId" IS NOT NULL AND k."victimShipTypeId" != 0
    GROUP BY w."warId", k."victimShipTypeId", t.name
) sub WHERE rn <= 10

UNION ALL

-- Top 10 Systems
SELECT
    "warId", 'system' AS category, "entityId", "entityName", kills, "iskValue"
FROM (
    SELECT
        w."warId",
        k."solarSystemId" AS "entityId",
        COALESCE(sys.name, 'System #' || k."solarSystemId") AS "entityName",
        COUNT(DISTINCT k."killmailId")::int AS kills,
        COALESCE(SUM(k."totalValue"), 0)::float AS "iskValue",
        ROW_NUMBER() OVER (PARTITION BY w."warId" ORDER BY COUNT(DISTINCT k."killmailId") DESC, SUM(k."totalValue") DESC) as rn
    FROM wars w
    JOIN killmails k ON k."victimFactionId" IN (w."aggressorAllianceId", w."defenderAllianceId") AND k."warId" IS NULL
    LEFT JOIN solarsystems sys ON sys."solarSystemId" = k."solarSystemId"
    WHERE w."warId" IN (999999999999999, 999999999999998)
      AND k."solarSystemId" IS NOT NULL AND k."solarSystemId" != 0
    GROUP BY w."warId", k."solarSystemId", sys.name
) sub WHERE rn <= 10

UNION ALL

-- Top 10 Regions
SELECT
    "warId", 'region' AS category, "entityId", "entityName", kills, "iskValue"
FROM (
    SELECT
        w."warId",
        k."regionId" AS "entityId",
        COALESCE(reg.name, 'Region #' || k."regionId") AS "entityName",
        COUNT(DISTINCT k."killmailId")::int AS kills,
        COALESCE(SUM(k."totalValue"), 0)::float AS "iskValue",
        ROW_NUMBER() OVER (PARTITION BY w."warId" ORDER BY COUNT(DISTINCT k."killmailId") DESC, SUM(k."totalValue") DESC) as rn
    FROM wars w
    JOIN killmails k ON k."victimFactionId" IN (w."aggressorAllianceId", w."defenderAllianceId") AND k."warId" IS NULL
    LEFT JOIN regions reg ON reg."regionId" = k."regionId"
    WHERE w."warId" IN (999999999999999, 999999999999998)
      AND k."regionId" IS NOT NULL AND k."regionId" != 0
    GROUP BY w."warId", k."regionId", reg.name
) sub WHERE rn <= 10
) all_stats
WITH NO DATA;

CREATE UNIQUE INDEX war_top_stats_fac_id_idx ON war_top_statistics_faction(id);
CREATE INDEX war_top_stats_fac_war_cat_idx ON war_top_statistics_faction("warId", category);
CREATE INDEX war_top_stats_fac_war_idx ON war_top_statistics_faction("warId");


-- ============================================================================
-- 3. COMBINED VIEW (Interface)
-- ============================================================================

CREATE OR REPLACE VIEW war_top_statistics AS
SELECT * FROM war_top_statistics_regular
UNION ALL
SELECT * FROM war_top_statistics_faction;

SET client_min_messages TO NOTICE;

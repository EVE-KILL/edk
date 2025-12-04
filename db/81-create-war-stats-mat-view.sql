-- ============================================================================
-- WAR STATISTICS MATERIALIZED VIEW
-- Pre-aggregates war statistics to avoid scanning millions of rows for
-- long-running wars (e.g., 22-year faction wars)
-- ============================================================================

SET client_min_messages TO WARNING;

-- Drop existing view if present
DROP MATERIALIZED VIEW IF EXISTS war_stats CASCADE;

-- Create materialized view for war statistics
-- This aggregates the following metrics per war:
-- - Overall kill counts and ISK totals
-- - Per-side metrics (aggressor vs defender)
-- - First/last kill timestamps
CREATE MATERIALIZED VIEW war_stats AS
SELECT
    w."warId",
    -- Overall stats
    COUNT(DISTINCT k."killmailId")::int AS "killCount",
    COALESCE(SUM(k."totalValue"), 0)::float AS "totalValue",
    MIN(k."killmailTime") AS "firstKill",
    MAX(k."killmailTime") AS "lastKill",

    -- Regular wars: aggressor metrics (kills against defenders)
    COUNT(DISTINCT k."killmailId") FILTER (WHERE
        k."victimCorporationId" = w."defenderCorporationId" OR
        k."victimAllianceId" = w."defenderAllianceId"
    )::int AS "aggressorShipsKilled",
    COALESCE(SUM(k."totalValue") FILTER (WHERE
        k."victimCorporationId" = w."defenderCorporationId" OR
        k."victimAllianceId" = w."defenderAllianceId"
    ), 0)::float AS "aggressorIskDestroyed",

    -- Regular wars: defender metrics (kills against aggressors)
    COUNT(DISTINCT k."killmailId") FILTER (WHERE
        k."victimCorporationId" = w."aggressorCorporationId" OR
        k."victimAllianceId" = w."aggressorAllianceId"
    )::int AS "defenderShipsKilled",
    COALESCE(SUM(k."totalValue") FILTER (WHERE
        k."victimCorporationId" = w."aggressorCorporationId" OR
        k."victimAllianceId" = w."aggressorAllianceId"
    ), 0)::float AS "defenderIskDestroyed",

    -- Faction wars: aggressor metrics (kills against defender faction)
    COUNT(DISTINCT k."killmailId") FILTER (WHERE
        k."victimFactionId" = w."defenderAllianceId" AND
        w."warId" IN (999999999999999, 999999999999998)
    )::int AS "factionAggressorShipsKilled",
    COALESCE(SUM(k."totalValue") FILTER (WHERE
        k."victimFactionId" = w."defenderAllianceId" AND
        w."warId" IN (999999999999999, 999999999999998)
    ), 0)::float AS "factionAggressorIskDestroyed",

    -- Faction wars: defender metrics (kills against aggressor faction)
    COUNT(DISTINCT k."killmailId") FILTER (WHERE
        k."victimFactionId" = w."aggressorAllianceId" AND
        w."warId" IN (999999999999999, 999999999999998)
    )::int AS "factionDefenderShipsKilled",
    COALESCE(SUM(k."totalValue") FILTER (WHERE
        k."victimFactionId" = w."aggressorAllianceId" AND
        w."warId" IN (999999999999999, 999999999999998)
    ), 0)::float AS "factionDefenderIskDestroyed"
FROM wars w
LEFT JOIN killmails k ON (
    -- Regular wars: match by warId
    (k."warId" = w."warId") OR
    -- Faction wars: match by victimFactionId (no warId set)
    (w."warId" IN (999999999999999, 999999999999998) AND
     k."victimFactionId" IN (w."aggressorAllianceId", w."defenderAllianceId") AND
     k."warId" IS NULL)
)
GROUP BY w."warId";

-- Create unique index (required for REFRESH MATERIALIZED VIEW CONCURRENTLY)
CREATE UNIQUE INDEX war_stats_war_id_idx ON war_stats("warId");

-- Create additional indexes for efficient access
CREATE INDEX war_stats_kill_count_idx ON war_stats("killCount" DESC);
CREATE INDEX war_stats_total_value_idx ON war_stats("totalValue" DESC);
CREATE INDEX war_stats_first_kill_idx ON war_stats("firstKill");
CREATE INDEX war_stats_last_kill_idx ON war_stats("lastKill" DESC);

-- ============================================================================
-- WAR PARTICIPANTS MATERIALIZED VIEW
-- Pre-aggregates top contributors per war to avoid expensive GROUP BY queries
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS war_participants CASCADE;

-- Create materialized view for war participants
-- Tracks top attackers grouped by alliance/corporation per war
CREATE MATERIALIZED VIEW war_participants AS
SELECT
    ROW_NUMBER() OVER () AS id,
    "warId",
    side,
    "corporationId",
    "allianceId",
    kills,
    value
FROM (
    -- Regular wars: aggressor participants (killed defenders)
    SELECT
        w."warId",
        'aggressor' AS side,
        k."topAttackerCorporationId" AS "corporationId",
        k."topAttackerAllianceId" AS "allianceId",
        COUNT(*)::int AS kills,
        COALESCE(SUM(k."totalValue"), 0)::float AS value
    FROM wars w
    JOIN killmails k ON k."warId" = w."warId"
    WHERE (k."victimCorporationId" = w."defenderCorporationId" OR k."victimAllianceId" = w."defenderAllianceId")
      AND (k."topAttackerAllianceId" IS NOT NULL OR k."topAttackerCorporationId" IS NOT NULL)
      AND k."topAttackerCorporationId" != 0
      AND w."warId" NOT IN (999999999999999, 999999999999998) -- Exclude faction wars
    GROUP BY w."warId", k."topAttackerAllianceId", k."topAttackerCorporationId"

    UNION ALL

    -- Regular wars: defender participants (killed aggressors)
    SELECT
        w."warId",
        'defender' AS side,
        k."topAttackerCorporationId" AS "corporationId",
        k."topAttackerAllianceId" AS "allianceId",
        COUNT(*)::int AS kills,
        COALESCE(SUM(k."totalValue"), 0)::float AS value
    FROM wars w
    JOIN killmails k ON k."warId" = w."warId"
    WHERE (k."victimCorporationId" = w."aggressorCorporationId" OR k."victimAllianceId" = w."aggressorAllianceId")
      AND (k."topAttackerAllianceId" IS NOT NULL OR k."topAttackerCorporationId" IS NOT NULL)
      AND k."topAttackerCorporationId" != 0
      AND w."warId" NOT IN (999999999999999, 999999999999998) -- Exclude faction wars
    GROUP BY w."warId", k."topAttackerAllianceId", k."topAttackerCorporationId"

    UNION ALL

    -- Faction wars: aggressor participants (killed defender faction)
    SELECT
        w."warId",
        'aggressor' AS side,
        k."topAttackerCorporationId" AS "corporationId",
        k."topAttackerAllianceId" AS "allianceId",
        COUNT(*)::int AS kills,
        COALESCE(SUM(k."totalValue"), 0)::float AS value
    FROM wars w
    JOIN killmails k ON (
        k."victimFactionId" = w."defenderAllianceId" AND
        k."warId" IS NULL
    )
    WHERE w."warId" IN (999999999999999, 999999999999998)
      AND (k."topAttackerAllianceId" IS NOT NULL OR k."topAttackerCorporationId" IS NOT NULL)
      AND k."topAttackerCorporationId" != 0
    GROUP BY w."warId", k."topAttackerAllianceId", k."topAttackerCorporationId"

    UNION ALL

    -- Faction wars: defender participants (killed aggressor faction)
    SELECT
        w."warId",
        'defender' AS side,
        k."topAttackerCorporationId" AS "corporationId",
        k."topAttackerAllianceId" AS "allianceId",
        COUNT(*)::int AS kills,
        COALESCE(SUM(k."totalValue"), 0)::float AS value
    FROM wars w
    JOIN killmails k ON (
        k."victimFactionId" = w."aggressorAllianceId" AND
        k."warId" IS NULL
    )
    WHERE w."warId" IN (999999999999999, 999999999999998)
      AND (k."topAttackerAllianceId" IS NOT NULL OR k."topAttackerCorporationId" IS NOT NULL)
      AND k."topAttackerCorporationId" != 0
    GROUP BY w."warId", k."topAttackerAllianceId", k."topAttackerCorporationId"
) subquery;

-- Create unique index on the generated id column (required for REFRESH MATERIALIZED VIEW CONCURRENTLY)
CREATE UNIQUE INDEX war_participants_unique_idx ON war_participants(id);

-- Create indexes for efficient queries
CREATE INDEX war_participants_war_id_idx ON war_participants("warId");
CREATE INDEX war_participants_side_idx ON war_participants("warId", side, kills DESC);
CREATE INDEX war_participants_value_idx ON war_participants("warId", side, value DESC);

-- ============================================================================
-- WAR SHIP CLASSES MATERIALIZED VIEW
-- Pre-aggregates ship class statistics per war
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS war_ship_classes CASCADE;

-- Create materialized view for war ship classes
-- Tracks what ship types were killed, grouped by side
CREATE MATERIALIZED VIEW war_ship_classes AS
SELECT
    ROW_NUMBER() OVER () AS id,
    "warId",
    side,
    "groupId",
    "count"
FROM (
    -- Regular wars: ships killed by aggressor (defender victims)
    SELECT
        w."warId",
        'aggressor' AS side,
        g."groupId",
        COUNT(DISTINCT k."killmailId")::int AS "count"
    FROM wars w
    JOIN killmails k ON k."warId" = w."warId"
    JOIN types t ON t."typeId" = k."victimShipTypeId"
    JOIN groups g ON g."groupId" = t."groupId"
    WHERE (k."victimCorporationId" = w."defenderCorporationId" OR k."victimAllianceId" = w."defenderAllianceId")
      AND w."warId" NOT IN (999999999999999, 999999999999998)
      AND g."groupId" != 0
    GROUP BY w."warId", g."groupId"

    UNION ALL

    -- Regular wars: ships killed by defender (aggressor victims)
    SELECT
        w."warId",
        'defender' AS side,
        g."groupId",
        COUNT(DISTINCT k."killmailId")::int AS "count"
    FROM wars w
    JOIN killmails k ON k."warId" = w."warId"
    JOIN types t ON t."typeId" = k."victimShipTypeId"
    JOIN groups g ON g."groupId" = t."groupId"
    WHERE (k."victimCorporationId" = w."aggressorCorporationId" OR k."victimAllianceId" = w."aggressorAllianceId")
      AND w."warId" NOT IN (999999999999999, 999999999999998)
      AND g."groupId" != 0
    GROUP BY w."warId", g."groupId"

    UNION ALL

    -- Faction wars: ships killed by aggressor (defender faction victims)
    SELECT
        w."warId",
        'aggressor' AS side,
        g."groupId",
        COUNT(DISTINCT k."killmailId")::int AS "count"
    FROM wars w
    JOIN killmails k ON (
        k."victimFactionId" = w."defenderAllianceId" AND
        k."warId" IS NULL
    )
    JOIN types t ON t."typeId" = k."victimShipTypeId"
    JOIN groups g ON g."groupId" = t."groupId"
    WHERE w."warId" IN (999999999999999, 999999999999998)
      AND g."groupId" != 0
    GROUP BY w."warId", g."groupId"

    UNION ALL

    -- Faction wars: ships killed by defender (aggressor faction victims)
    SELECT
        w."warId",
        'defender' AS side,
        g."groupId",
        COUNT(DISTINCT k."killmailId")::int AS "count"
    FROM wars w
    JOIN killmails k ON (
        k."victimFactionId" = w."aggressorAllianceId" AND
        k."warId" IS NULL
    )
    JOIN types t ON t."typeId" = k."victimShipTypeId"
    JOIN groups g ON g."groupId" = t."groupId"
    WHERE w."warId" IN (999999999999999, 999999999999998)
      AND g."groupId" != 0
    GROUP BY w."warId", g."groupId"
) subquery;

-- Create unique index on the generated id column (required for REFRESH MATERIALIZED VIEW CONCURRENTLY)
CREATE UNIQUE INDEX war_ship_classes_unique_idx ON war_ship_classes(id);

-- Create indexes for efficient queries
CREATE INDEX war_ship_classes_war_id_idx ON war_ship_classes("warId");
CREATE INDEX war_ship_classes_side_idx ON war_ship_classes("warId", side);
CREATE INDEX war_ship_classes_count_idx ON war_ship_classes("warId", side, "count" DESC);

-- ============================================================================
-- WAR MOST VALUABLE KILLS MATERIALIZED VIEW
-- Stores the top 10 most valuable killmail IDs per war to avoid expensive
-- ORDER BY totalValue queries on millions of rows
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS war_most_valuable_kills CASCADE;

-- Create materialized view for top valuable kills per war
-- Only stores killmail IDs, full details are fetched when displaying
CREATE MATERIALIZED VIEW war_most_valuable_kills AS
SELECT
    ROW_NUMBER() OVER () AS id,
    "warId",
    "killmailId",
    "totalValue"
FROM (
    -- Regular wars
    SELECT
        k."warId",
        k."killmailId",
        k."totalValue"
    FROM (
        SELECT
            k."warId",
            k."killmailId",
            k."totalValue",
            ROW_NUMBER() OVER (PARTITION BY k."warId" ORDER BY k."totalValue" DESC) as rn
        FROM killmails k
        WHERE k."warId" IS NOT NULL
          AND k."warId" NOT IN (999999999999999, 999999999999998)
    ) k
    WHERE k.rn <= 10

    UNION ALL

    -- Faction wars: Amarr vs Minmatar
    SELECT
        999999999999998 as "warId",
        k."killmailId",
        k."totalValue"
    FROM (
        SELECT
            k."killmailId",
            k."totalValue",
            ROW_NUMBER() OVER (ORDER BY k."totalValue" DESC) as rn
        FROM killmails k
        JOIN wars w ON w."warId" = 999999999999998
        WHERE k."victimFactionId" IN (w."aggressorAllianceId", w."defenderAllianceId")
          AND k."warId" IS NULL
    ) k
    WHERE k.rn <= 10

    UNION ALL

    -- Faction wars: Caldari vs Gallente
    SELECT
        999999999999999 as "warId",
        k."killmailId",
        k."totalValue"
    FROM (
        SELECT
            k."killmailId",
            k."totalValue",
            ROW_NUMBER() OVER (ORDER BY k."totalValue" DESC) as rn
        FROM killmails k
        JOIN wars w ON w."warId" = 999999999999999
        WHERE k."victimFactionId" IN (w."aggressorAllianceId", w."defenderAllianceId")
          AND k."warId" IS NULL
    ) k
    WHERE k.rn <= 10
) subquery;

-- Create unique index on the generated id column (required for REFRESH MATERIALIZED VIEW CONCURRENTLY)
CREATE UNIQUE INDEX war_most_valuable_kills_unique_idx ON war_most_valuable_kills(id);

-- Create indexes for efficient queries
CREATE INDEX war_most_valuable_kills_war_id_idx ON war_most_valuable_kills("warId");
CREATE INDEX war_most_valuable_kills_value_idx ON war_most_valuable_kills("warId", "totalValue" DESC);

-- ============================================================================
-- WAR TOP STATISTICS MATERIALIZED VIEW
-- Pre-aggregates top 10 entities per war for fast sidebar display
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS war_top_statistics CASCADE;

-- Create materialized view for top 10 statistics per war
CREATE MATERIALIZED VIEW war_top_statistics AS
SELECT
    ROW_NUMBER() OVER (ORDER BY "warId", category, kills DESC, "iskValue" DESC) AS id,
    "warId",
    category,
    "entityId",
    "entityName",
    kills,
    "iskValue"
FROM (
-- Top 10 Characters (attackers)
SELECT
    "warId",
    'character' AS category,
    "entityId",
    "entityName",
    kills,
    "iskValue"
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
      AND a."characterId" IS NOT NULL
      AND a."characterId" != 0
    GROUP BY k."warId", a."characterId", c.name
) sub WHERE rn <= 10

UNION ALL

-- Top 10 Corporations (attackers)
SELECT
    "warId",
    'corporation' AS category,
    "entityId",
    "entityName",
    kills,
    "iskValue"
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
      AND a."corporationId" IS NOT NULL
      AND a."corporationId" != 0
    GROUP BY k."warId", a."corporationId", corp.name
) sub WHERE rn <= 10

UNION ALL

-- Top 10 Alliances (attackers)
SELECT
    "warId",
    'alliance' AS category,
    "entityId",
    "entityName",
    kills,
    "iskValue"
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
      AND a."allianceId" IS NOT NULL
      AND a."allianceId" != 0
    GROUP BY k."warId", a."allianceId", ally.name
) sub WHERE rn <= 10

UNION ALL

-- Top 10 Ships (victims)
SELECT
    "warId",
    'ship' AS category,
    "entityId",
    "entityName",
    kills,
    "iskValue"
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
      AND k."victimShipTypeId" IS NOT NULL
      AND k."victimShipTypeId" != 0
    GROUP BY k."warId", k."victimShipTypeId", t.name
) sub WHERE rn <= 10

UNION ALL

-- Top 10 Systems
SELECT
    "warId",
    'system' AS category,
    "entityId",
    "entityName",
    kills,
    "iskValue"
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
      AND k."solarSystemId" IS NOT NULL
      AND k."solarSystemId" != 0
    GROUP BY k."warId", k."solarSystemId", sys.name
) sub WHERE rn <= 10

UNION ALL

-- Top 10 Regions
SELECT
    "warId",
    'region' AS category,
    "entityId",
    "entityName",
    kills,
    "iskValue"
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
      AND k."regionId" IS NOT NULL
      AND k."regionId" != 0
    GROUP BY k."warId", k."regionId", reg.name
) sub WHERE rn <= 10

UNION ALL

-- FACTION WARS: Top 10 Characters (attackers)
SELECT
    "warId",
    'character' AS category,
    "entityId",
    "entityName",
    kills,
    "iskValue"
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
      AND a."characterId" IS NOT NULL
      AND a."characterId" != 0
    GROUP BY w."warId", a."characterId", c.name
) sub WHERE rn <= 10

UNION ALL

-- FACTION WARS: Top 10 Corporations (attackers)
SELECT
    "warId",
    'corporation' AS category,
    "entityId",
    "entityName",
    kills,
    "iskValue"
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
      AND a."corporationId" IS NOT NULL
      AND a."corporationId" != 0
    GROUP BY w."warId", a."corporationId", corp.name
) sub WHERE rn <= 10

UNION ALL

-- FACTION WARS: Top 10 Alliances (attackers)
SELECT
    "warId",
    'alliance' AS category,
    "entityId",
    "entityName",
    kills,
    "iskValue"
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
      AND a."allianceId" IS NOT NULL
      AND a."allianceId" != 0
    GROUP BY w."warId", a."allianceId", ally.name
) sub WHERE rn <= 10

UNION ALL

-- FACTION WARS: Top 10 Ships (victims)
SELECT
    "warId",
    'ship' AS category,
    "entityId",
    "entityName",
    kills,
    "iskValue"
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
      AND k."victimShipTypeId" IS NOT NULL
      AND k."victimShipTypeId" != 0
    GROUP BY w."warId", k."victimShipTypeId", t.name
) sub WHERE rn <= 10

UNION ALL

-- FACTION WARS: Top 10 Systems
SELECT
    "warId",
    'system' AS category,
    "entityId",
    "entityName",
    kills,
    "iskValue"
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
      AND k."solarSystemId" IS NOT NULL
      AND k."solarSystemId" != 0
    GROUP BY w."warId", k."solarSystemId", sys.name
) sub WHERE rn <= 10

UNION ALL

-- FACTION WARS: Top 10 Regions
SELECT
    "warId",
    'region' AS category,
    "entityId",
    "entityName",
    kills,
    "iskValue"
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
      AND k."regionId" IS NOT NULL
      AND k."regionId" != 0
    GROUP BY w."warId", k."regionId", reg.name
) sub WHERE rn <= 10
) all_stats;

-- Create unique index on id (required for REFRESH MATERIALIZED VIEW CONCURRENTLY)
CREATE UNIQUE INDEX war_top_statistics_id_idx ON war_top_statistics(id);

-- Create indexes for efficient queries
CREATE INDEX war_top_statistics_war_category_idx ON war_top_statistics("warId", category);
CREATE INDEX war_top_statistics_war_id_idx ON war_top_statistics("warId");
CREATE INDEX war_top_statistics_category_idx ON war_top_statistics(category);

SET client_min_messages TO NOTICE;

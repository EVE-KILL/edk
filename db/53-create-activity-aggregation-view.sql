-- Optimization #11: Daily Entity Activity Aggregation
-- Tracks daily activity patterns for entities
-- Benefits: Fast activity timeline queries, historical trend analysis
-- Tradeoff: ~200 bytes per entity per day

CREATE TABLE IF NOT EXISTS entity_activity_daily (
    entityId UInt32,
    entityType Enum8('character' = 1, 'corporation' = 2, 'alliance' = 3),
    activityDate Date,

    -- Activity counts
    kills UInt16,
    losses UInt16,

    -- ISK values
    iskDestroyed Float64,
    iskLost Float64,

    -- Active hours bitmap (24 bits for 24 hours)
    activeHours UInt32,

    -- Unique opponents
    uniqueVictims UInt16,
    uniqueAttackers UInt16,

    -- Combat style
    soloKills UInt16,
    gangKills UInt16
) ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(activityDate)
ORDER BY (entityType, entityId, activityDate)
SETTINGS index_granularity = 8;

-- Index for entity lookups
CREATE INDEX IF NOT EXISTS idx_activity_entity ON entity_activity_daily (entityId) TYPE set(100) GRANULARITY 3;

-- Materialized view to populate entity_activity_daily from kills
CREATE MATERIALIZED VIEW IF NOT EXISTS entity_activity_daily_kills_mv TO entity_activity_daily AS
SELECT
    a.characterId AS entityId,
    'character' AS entityType,
    toDate(k.killmailTime) AS activityDate,
    1 AS kills,
    0 AS losses,
    k.totalValue AS iskDestroyed,
    0.0 AS iskLost,
    bitShiftLeft(1, toHour(k.killmailTime)) AS activeHours,
    1 AS uniqueVictims,
    0 AS uniqueAttackers,
    if(k.solo, 1, 0) AS soloKills,
    if(NOT k.solo, 1, 0) AS gangKills
FROM attackers a
JOIN killmails k ON a.killmailId = k.killmailId
WHERE a.characterId > 0;

-- Materialized view to populate entity_activity_daily from losses
CREATE MATERIALIZED VIEW IF NOT EXISTS entity_activity_daily_losses_mv TO entity_activity_daily AS
SELECT
    victimCharacterId AS entityId,
    'character' AS entityType,
    toDate(killmailTime) AS activityDate,
    0 AS kills,
    1 AS losses,
    0.0 AS iskDestroyed,
    totalValue AS iskLost,
    bitShiftLeft(1, toHour(killmailTime)) AS activeHours,
    0 AS uniqueVictims,
    1 AS uniqueAttackers,
    0 AS soloKills,
    0 AS gangKills
FROM killmails
WHERE victimCharacterId > 0;

-- Corporation kills (from top attacker corporation via killlist)
CREATE MATERIALIZED VIEW IF NOT EXISTS entity_activity_daily_corporation_kills_mv TO entity_activity_daily AS
SELECT
    topAttackerCorporationId AS entityId,
    'corporation' AS entityType,
    toDate(killmailTime) AS activityDate,
    1 AS kills,
    0 AS losses,
    totalValue AS iskDestroyed,
    0.0 AS iskLost,
    bitShiftLeft(1, toHour(killmailTime)) AS activeHours,
    1 AS uniqueVictims,
    0 AS uniqueAttackers,
    if(solo, 1, 0) AS soloKills,
    if(NOT solo, 1, 0) AS gangKills
FROM killlist
WHERE topAttackerCorporationId > 0;

-- Corporation losses (from victim corporation via killlist)
CREATE MATERIALIZED VIEW IF NOT EXISTS entity_activity_daily_corporation_losses_mv TO entity_activity_daily AS
SELECT
    victimCorporationId AS entityId,
    'corporation' AS entityType,
    toDate(killmailTime) AS activityDate,
    0 AS kills,
    1 AS losses,
    0.0 AS iskDestroyed,
    totalValue AS iskLost,
    bitShiftLeft(1, toHour(killmailTime)) AS activeHours,
    0 AS uniqueVictims,
    1 AS uniqueAttackers,
    0 AS soloKills,
    0 AS gangKills
FROM killlist
WHERE victimCorporationId > 0;

-- Alliance kills (from top attacker alliance via killlist)
CREATE MATERIALIZED VIEW IF NOT EXISTS entity_activity_daily_alliance_kills_mv TO entity_activity_daily AS
SELECT
    topAttackerAllianceId AS entityId,
    'alliance' AS entityType,
    toDate(killmailTime) AS activityDate,
    1 AS kills,
    0 AS losses,
    totalValue AS iskDestroyed,
    0.0 AS iskLost,
    bitShiftLeft(1, toHour(killmailTime)) AS activeHours,
    1 AS uniqueVictims,
    0 AS uniqueAttackers,
    if(solo, 1, 0) AS soloKills,
    if(NOT solo, 1, 0) AS gangKills
FROM killlist
WHERE topAttackerAllianceId > 0;

-- Alliance losses (from victim alliance via killlist)
CREATE MATERIALIZED VIEW IF NOT EXISTS entity_activity_daily_alliance_losses_mv TO entity_activity_daily AS
SELECT
    victimAllianceId AS entityId,
    'alliance' AS entityType,
    toDate(killmailTime) AS activityDate,
    0 AS kills,
    1 AS losses,
    0.0 AS iskDestroyed,
    totalValue AS iskLost,
    bitShiftLeft(1, toHour(killmailTime)) AS activeHours,
    0 AS uniqueVictims,
    1 AS uniqueAttackers,
    0 AS soloKills,
    0 AS gangKills
FROM killlist
WHERE victimAllianceId > 0;

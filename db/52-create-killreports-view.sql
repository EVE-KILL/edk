-- Optimization #9: Pre-computed Kill Reports
-- Daily aggregated statistics for kill reports
-- Benefits: Instant kill report generation, no runtime aggregation
-- Tradeoff: ~500 bytes per entity per day

CREATE TABLE IF NOT EXISTS killmail_reports (
    entityId UInt32,
    entityType Enum8('character' = 1, 'corporation' = 2, 'alliance' = 3),
    reportDate Date,

    -- Basic counts
    kills UInt32,
    losses UInt32,

    -- ISK values
    iskDestroyed Float64,
    iskLost Float64,
    efficiency Float32,

    -- Ship breakdown (top 10 ships as JSON)
    shipStats String, -- JSON: [{shipTypeId, kills, losses, iskDestroyed, iskLost}]

    -- System breakdown (top 10 systems as JSON)
    systemStats String, -- JSON: [{solarSystemId, kills, losses}]

    -- Hour-by-hour activity (24 entries)
    hourlyKills Array(UInt16), -- kills per hour [0-23]
    hourlyLosses Array(UInt16), -- losses per hour [0-23]

    -- Combat style metrics
    soloKills UInt16,
    soloLosses UInt16,
    gangKills UInt16,
    gangLosses UInt16,

    -- Weapon breakdown (top 5 weapons as JSON)
    weaponStats String -- JSON: [{weaponTypeId, kills}]
) ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(reportDate)
ORDER BY (entityType, entityId, reportDate)
SETTINGS index_granularity = 8;

-- Index for entity lookups
CREATE INDEX IF NOT EXISTS idx_reports_entity ON killmail_reports (entityId) TYPE set(100) GRANULARITY 3;

-- Materialized view to populate killmail_reports from kills
CREATE MATERIALIZED VIEW IF NOT EXISTS killmail_reports_kills_mv TO killmail_reports AS
SELECT
    a.characterId AS entityId,
    'character' AS entityType,
    toDate(k.killmailTime) AS reportDate,
    1 AS kills,
    0 AS losses,
    k.totalValue AS iskDestroyed,
    0.0 AS iskLost,
    100.0 AS efficiency,

    -- Ship stats as JSON
    concat('[{"shipTypeId":', toString(a.shipTypeId), ',"kills":1,"losses":0,"iskDestroyed":', toString(k.totalValue), ',"iskLost":0}]') AS shipStats,

    -- System stats as JSON
    concat('[{"solarSystemId":', toString(k.solarSystemId), ',"kills":1,"losses":0}]') AS systemStats,

    -- Hourly activity (create array with 1 in the hour slot)
    arrayMap(x -> if(x = toHour(k.killmailTime), 1, 0), range(24)) AS hourlyKills,
    arrayMap(x -> 0, range(24)) AS hourlyLosses,

    if(k.solo, 1, 0) AS soloKills,
    0 AS soloLosses,
    if(NOT k.solo, 1, 0) AS gangKills,
    0 AS gangLosses,

    -- Weapon stats as JSON
    concat('[{"weaponTypeId":', toString(a.weaponTypeId), ',"kills":1}]') AS weaponStats
FROM attackers a
JOIN killmails k ON a.killmailId = k.killmailId
WHERE a.characterId > 0;-- Materialized view to populate killmail_reports from losses
CREATE MATERIALIZED VIEW IF NOT EXISTS killmail_reports_losses_mv TO killmail_reports AS
SELECT
    victimCharacterId AS entityId,
    'character' AS entityType,
    toDate(killmailTime) AS reportDate,
    0 AS kills,
    1 AS losses,
    0.0 AS iskDestroyed,
    totalValue AS iskLost,
    0.0 AS efficiency,

    -- Ship stats as JSON
    concat('[{"shipTypeId":', toString(victimShipTypeId), ',"kills":0,"losses":1,"iskDestroyed":0,"iskLost":', toString(totalValue), '}]') AS shipStats,

    -- System stats as JSON
    concat('[{"solarSystemId":', toString(solarSystemId), ',"kills":0,"losses":1}]') AS systemStats,

    -- Hourly activity
    arrayMap(x -> 0, range(24)) AS hourlyKills,
    arrayMap(x -> if(x = toHour(killmailTime), 1, 0), range(24)) AS hourlyLosses,

    0 AS soloKills,
    if(solo, 1, 0) AS soloLosses,
    0 AS gangKills,
    if(NOT solo, 1, 0) AS gangLosses,

    -- No weapon stats for losses
    '[]' AS weaponStats
FROM killmails
WHERE victimCharacterId > 0;

-- Corporation kills (from top attacker corporation via killlist)
CREATE MATERIALIZED VIEW IF NOT EXISTS killmail_reports_corporation_kills_mv TO killmail_reports AS
SELECT
    topAttackerCorporationId AS entityId,
    'corporation' AS entityType,
    toDate(killmailTime) AS reportDate,
    1 AS kills,
    0 AS losses,
    totalValue AS iskDestroyed,
    0.0 AS iskLost,
    100.0 AS efficiency,
    '[]' AS shipStats, -- Corporation doesn't have "ships killed in"
    '[]' AS systemStats, -- Pre-aggregated stats not per-corporation
    arrayMap(x -> if(x = toHour(killmailTime), 1, 0), range(24)) AS hourlyKills,
    arrayMap(x -> 0, range(24)) AS hourlyLosses,
    if(solo, 1, 0) AS soloKills,
    0 AS soloLosses,
    if(NOT solo, 1, 0) AS gangKills,
    0 AS gangLosses,
    '[]' AS weaponStats
FROM killlist
WHERE topAttackerCorporationId > 0;

-- Corporation losses (from victim corporation via killlist)
CREATE MATERIALIZED VIEW IF NOT EXISTS killmail_reports_corporation_losses_mv TO killmail_reports AS
SELECT
    victimCorporationId AS entityId,
    'corporation' AS entityType,
    toDate(killmailTime) AS reportDate,
    0 AS kills,
    1 AS losses,
    0.0 AS iskDestroyed,
    totalValue AS iskLost,
    0.0 AS efficiency,
    '[]' AS shipStats,
    '[]' AS systemStats,
    arrayMap(x -> 0, range(24)) AS hourlyKills,
    arrayMap(x -> if(x = toHour(killmailTime), 1, 0), range(24)) AS hourlyLosses,
    0 AS soloKills,
    if(solo, 1, 0) AS soloLosses,
    0 AS gangKills,
    if(NOT solo, 1, 0) AS gangLosses,
    '[]' AS weaponStats
FROM killlist
WHERE victimCorporationId > 0;

-- Alliance kills (from top attacker alliance via killlist)
CREATE MATERIALIZED VIEW IF NOT EXISTS killmail_reports_alliance_kills_mv TO killmail_reports AS
SELECT
    topAttackerAllianceId AS entityId,
    'alliance' AS entityType,
    toDate(killmailTime) AS reportDate,
    1 AS kills,
    0 AS losses,
    totalValue AS iskDestroyed,
    0.0 AS iskLost,
    100.0 AS efficiency,
    '[]' AS shipStats,
    '[]' AS systemStats,
    arrayMap(x -> if(x = toHour(killmailTime), 1, 0), range(24)) AS hourlyKills,
    arrayMap(x -> 0, range(24)) AS hourlyLosses,
    if(solo, 1, 0) AS soloKills,
    0 AS soloLosses,
    if(NOT solo, 1, 0) AS gangKills,
    0 AS gangLosses,
    '[]' AS weaponStats
FROM killlist
WHERE topAttackerAllianceId > 0;

-- Alliance losses (from victim alliance via killlist)
CREATE MATERIALIZED VIEW IF NOT EXISTS killmail_reports_alliance_losses_mv TO killmail_reports AS
SELECT
    victimAllianceId AS entityId,
    'alliance' AS entityType,
    toDate(killmailTime) AS reportDate,
    0 AS kills,
    1 AS losses,
    0.0 AS iskDestroyed,
    totalValue AS iskLost,
    0.0 AS efficiency,
    '[]' AS shipStats,
    '[]' AS systemStats,
    arrayMap(x -> 0, range(24)) AS hourlyKills,
    arrayMap(x -> if(x = toHour(killmailTime), 1, 0), range(24)) AS hourlyLosses,
    0 AS soloKills,
    if(solo, 1, 0) AS soloLosses,
    0 AS gangKills,
    if(NOT solo, 1, 0) AS gangLosses,
    '[]' AS weaponStats
FROM killlist
WHERE victimAllianceId > 0;

-- Entity Stats Daily - Time-Series Aggregations
-- Pre-compute stats per entity per day, then sum for any time range
-- Single materialized view per entity type firing once per day

-- ==============================================================================
-- CORPORATION STATS DAILY
-- ==============================================================================

CREATE TABLE IF NOT EXISTS entity_stats_daily_corporation (
    date Date,
    corporationId UInt32,
    corporationName String,
    kills UInt32 DEFAULT 0,
    losses UInt32 DEFAULT 0,
    iskDestroyed Float64 DEFAULT 0,
    iskLost Float64 DEFAULT 0,
    points UInt32 DEFAULT 0,
    soloKills UInt32 DEFAULT 0,
    soloLosses UInt32 DEFAULT 0,
    npcKills UInt32 DEFAULT 0,
    npcLosses UInt32 DEFAULT 0,
    topShipTypeId UInt32 DEFAULT 0,
    topShipKills UInt32 DEFAULT 0,
    topSystemId UInt32 DEFAULT 0,
    topSystemKills UInt32 DEFAULT 0,
    lastKillTime DateTime DEFAULT toDateTime(0),
    lastLossTime DateTime DEFAULT toDateTime(0)
) ENGINE = MergeTree()
ORDER BY (date, corporationId)
PARTITION BY toYYYYMM(date)
SETTINGS index_granularity = 3;

CREATE INDEX IF NOT EXISTS idx_entity_daily_corp_entity ON entity_stats_daily_corporation (corporationId) TYPE set(100) GRANULARITY 3;
CREATE INDEX IF NOT EXISTS idx_entity_daily_corp_date ON entity_stats_daily_corporation (date) TYPE minmax GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_entity_daily_corp_kills ON entity_stats_daily_corporation (kills) TYPE minmax GRANULARITY 1;

-- Materialized view: Corporation kills (top attacker) + losses (victim) - both in single row per day
CREATE MATERIALIZED VIEW IF NOT EXISTS entity_stats_daily_corporation_mv TO entity_stats_daily_corporation AS
SELECT
    toDate(k.killmailTime) AS date,
    COALESCE(k.topAttackerCorporationId, k.victimCorporationId) AS corporationId,
    any(COALESCE(acorp.name, vcorp.name)) AS corporationName,
    sumIf(1, k.topAttackerCorporationId = COALESCE(k.topAttackerCorporationId, k.victimCorporationId)) AS kills,
    sumIf(1, k.victimCorporationId = COALESCE(k.topAttackerCorporationId, k.victimCorporationId)) AS losses,
    sumIf(k.totalValue, k.topAttackerCorporationId = COALESCE(k.topAttackerCorporationId, k.victimCorporationId)) AS iskDestroyed,
    sumIf(k.totalValue, k.victimCorporationId = COALESCE(k.topAttackerCorporationId, k.victimCorporationId)) AS iskLost,
    sumIf(1, k.topAttackerCorporationId = COALESCE(k.topAttackerCorporationId, k.victimCorporationId)) AS points,
    sumIf(1, k.topAttackerCorporationId = COALESCE(k.topAttackerCorporationId, k.victimCorporationId) AND k.solo = 1) AS soloKills,
    sumIf(1, k.victimCorporationId = COALESCE(k.topAttackerCorporationId, k.victimCorporationId) AND k.solo = 1) AS soloLosses,
    sumIf(1, k.topAttackerCorporationId = COALESCE(k.topAttackerCorporationId, k.victimCorporationId) AND k.npc = 1) AS npcKills,
    sumIf(1, k.victimCorporationId = COALESCE(k.topAttackerCorporationId, k.victimCorporationId) AND k.npc = 1) AS npcLosses,
    argMaxIf(k.victimShipTypeId, k.killmailTime, k.victimCorporationId = COALESCE(k.topAttackerCorporationId, k.victimCorporationId)) AS topShipTypeId,
    sumIf(1, k.victimCorporationId = COALESCE(k.topAttackerCorporationId, k.victimCorporationId)) AS topShipKills,
    argMaxIf(k.solarSystemId, k.killmailTime, k.topAttackerCorporationId = COALESCE(k.topAttackerCorporationId, k.victimCorporationId) OR k.victimCorporationId = COALESCE(k.topAttackerCorporationId, k.victimCorporationId)) AS topSystemId,
    count() AS topSystemKills,
    maxIf(k.killmailTime, k.topAttackerCorporationId = COALESCE(k.topAttackerCorporationId, k.victimCorporationId)) AS lastKillTime,
    maxIf(k.killmailTime, k.victimCorporationId = COALESCE(k.topAttackerCorporationId, k.victimCorporationId)) AS lastLossTime
FROM killmails k
LEFT JOIN corporations acorp ON k.topAttackerCorporationId = acorp.corporationId
LEFT JOIN corporations vcorp ON k.victimCorporationId = vcorp.corporationId
WHERE k.topAttackerCorporationId > 0 OR k.victimCorporationId > 0
GROUP BY date, corporationId;

-- ==============================================================================
-- ALLIANCE STATS DAILY
-- ==============================================================================

CREATE TABLE IF NOT EXISTS entity_stats_daily_alliance (
    date Date,
    allianceId UInt32,
    allianceName String,
    kills UInt32 DEFAULT 0,
    losses UInt32 DEFAULT 0,
    iskDestroyed Float64 DEFAULT 0,
    iskLost Float64 DEFAULT 0,
    points UInt32 DEFAULT 0,
    soloKills UInt32 DEFAULT 0,
    soloLosses UInt32 DEFAULT 0,
    npcKills UInt32 DEFAULT 0,
    npcLosses UInt32 DEFAULT 0,
    topShipTypeId UInt32 DEFAULT 0,
    topShipKills UInt32 DEFAULT 0,
    topSystemId UInt32 DEFAULT 0,
    topSystemKills UInt32 DEFAULT 0,
    lastKillTime DateTime DEFAULT toDateTime(0),
    lastLossTime DateTime DEFAULT toDateTime(0)
) ENGINE = MergeTree()
ORDER BY (date, allianceId)
PARTITION BY toYYYYMM(date)
SETTINGS index_granularity = 3;

CREATE INDEX IF NOT EXISTS idx_entity_daily_alliance_entity ON entity_stats_daily_alliance (allianceId) TYPE set(100) GRANULARITY 3;
CREATE INDEX IF NOT EXISTS idx_entity_daily_alliance_date ON entity_stats_daily_alliance (date) TYPE minmax GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_entity_daily_alliance_kills ON entity_stats_daily_alliance (kills) TYPE minmax GRANULARITY 1;

-- Materialized view: Alliance kills (top attacker) + losses (victim) - both in single row per day
CREATE MATERIALIZED VIEW IF NOT EXISTS entity_stats_daily_alliance_mv TO entity_stats_daily_alliance AS
SELECT
    toDate(k.killmailTime) AS date,
    COALESCE(k.topAttackerAllianceId, k.victimAllianceId) AS allianceId,
    any(COALESCE(aalliance.name, valliance.name)) AS allianceName,
    sumIf(1, k.topAttackerAllianceId = COALESCE(k.topAttackerAllianceId, k.victimAllianceId)) AS kills,
    sumIf(1, k.victimAllianceId = COALESCE(k.topAttackerAllianceId, k.victimAllianceId)) AS losses,
    sumIf(k.totalValue, k.topAttackerAllianceId = COALESCE(k.topAttackerAllianceId, k.victimAllianceId)) AS iskDestroyed,
    sumIf(k.totalValue, k.victimAllianceId = COALESCE(k.topAttackerAllianceId, k.victimAllianceId)) AS iskLost,
    sumIf(1, k.topAttackerAllianceId = COALESCE(k.topAttackerAllianceId, k.victimAllianceId)) AS points,
    sumIf(1, k.topAttackerAllianceId = COALESCE(k.topAttackerAllianceId, k.victimAllianceId) AND k.solo = 1) AS soloKills,
    sumIf(1, k.victimAllianceId = COALESCE(k.topAttackerAllianceId, k.victimAllianceId) AND k.solo = 1) AS soloLosses,
    sumIf(1, k.topAttackerAllianceId = COALESCE(k.topAttackerAllianceId, k.victimAllianceId) AND k.npc = 1) AS npcKills,
    sumIf(1, k.victimAllianceId = COALESCE(k.topAttackerAllianceId, k.victimAllianceId) AND k.npc = 1) AS npcLosses,
    argMaxIf(k.victimShipTypeId, k.killmailTime, k.victimAllianceId = COALESCE(k.topAttackerAllianceId, k.victimAllianceId)) AS topShipTypeId,
    sumIf(1, k.victimAllianceId = COALESCE(k.topAttackerAllianceId, k.victimAllianceId)) AS topShipKills,
    argMaxIf(k.solarSystemId, k.killmailTime, k.topAttackerAllianceId = COALESCE(k.topAttackerAllianceId, k.victimAllianceId) OR k.victimAllianceId = COALESCE(k.topAttackerAllianceId, k.victimAllianceId)) AS topSystemId,
    count() AS topSystemKills,
    maxIf(k.killmailTime, k.topAttackerAllianceId = COALESCE(k.topAttackerAllianceId, k.victimAllianceId)) AS lastKillTime,
    maxIf(k.killmailTime, k.victimAllianceId = COALESCE(k.topAttackerAllianceId, k.victimAllianceId)) AS lastLossTime
FROM killmails k
LEFT JOIN alliances aalliance ON k.topAttackerAllianceId = aalliance.allianceId
LEFT JOIN alliances valliance ON k.victimAllianceId = valliance.allianceId
WHERE k.topAttackerAllianceId > 0 OR k.victimAllianceId > 0
GROUP BY date, allianceId;

-- ==============================================================================
-- SHIP STATS DAILY (losses only)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS entity_stats_daily_ship (
    date Date,
    shipTypeId UInt32,
    shipName String,
    kills UInt32 DEFAULT 0,
    losses UInt32 DEFAULT 0,
    iskDestroyed Float64 DEFAULT 0,
    iskLost Float64 DEFAULT 0,
    points UInt32 DEFAULT 0
) ENGINE = MergeTree()
ORDER BY (date, shipTypeId)
PARTITION BY toYYYYMM(date)
SETTINGS index_granularity = 3;

CREATE INDEX IF NOT EXISTS idx_entity_daily_ship_entity ON entity_stats_daily_ship (shipTypeId) TYPE set(100) GRANULARITY 3;
CREATE INDEX IF NOT EXISTS idx_entity_daily_ship_date ON entity_stats_daily_ship (date) TYPE minmax GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_entity_daily_ship_losses ON entity_stats_daily_ship (losses) TYPE minmax GRANULARITY 1;

-- Materialized view: Ship losses only
CREATE MATERIALIZED VIEW IF NOT EXISTS entity_stats_daily_ship_mv TO entity_stats_daily_ship AS
SELECT
    toDate(k.killmailTime) AS date,
    k.victimShipTypeId AS shipTypeId,
    any(t.name) AS shipName,
    0 AS kills,
    count(DISTINCT k.killmailId) AS losses,
    0.0 AS iskDestroyed,
    sum(k.totalValue) AS iskLost,
    0 AS points
FROM killmails k
LEFT JOIN types t ON k.victimShipTypeId = t.typeId
WHERE k.victimShipTypeId > 0
GROUP BY date, shipTypeId;

-- ==============================================================================
-- SYSTEM STATS DAILY
-- ==============================================================================

CREATE TABLE IF NOT EXISTS entity_stats_daily_system (
    date Date,
    systemId UInt32,
    systemName String,
    kills UInt32 DEFAULT 0,
    losses UInt32 DEFAULT 0,
    iskDestroyed Float64 DEFAULT 0,
    iskLost Float64 DEFAULT 0,
    points UInt32 DEFAULT 0
) ENGINE = MergeTree()
ORDER BY (date, systemId)
PARTITION BY toYYYYMM(date)
SETTINGS index_granularity = 3;

CREATE INDEX IF NOT EXISTS idx_entity_daily_system_entity ON entity_stats_daily_system (systemId) TYPE set(100) GRANULARITY 3;
CREATE INDEX IF NOT EXISTS idx_entity_daily_system_date ON entity_stats_daily_system (date) TYPE minmax GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_entity_daily_system_kills ON entity_stats_daily_system (kills) TYPE minmax GRANULARITY 1;

-- Materialized view: System kills (all killmails in system)
CREATE MATERIALIZED VIEW IF NOT EXISTS entity_stats_daily_system_mv TO entity_stats_daily_system AS
SELECT
    toDate(k.killmailTime) AS date,
    k.solarSystemId AS systemId,
    any(s.name) AS systemName,
    count(DISTINCT k.killmailId) AS kills,
    0 AS losses,
    sum(k.totalValue) AS iskDestroyed,
    0.0 AS iskLost,
    count(DISTINCT k.killmailId) AS points
FROM killmails k
LEFT JOIN solarSystems s ON k.solarSystemId = s.solarSystemId
WHERE k.solarSystemId > 0
GROUP BY date, systemId;

-- ==============================================================================
-- REGION STATS DAILY
-- ==============================================================================

CREATE TABLE IF NOT EXISTS entity_stats_daily_region (
    date Date,
    regionId UInt32,
    regionName String,
    kills UInt32 DEFAULT 0,
    losses UInt32 DEFAULT 0,
    iskDestroyed Float64 DEFAULT 0,
    iskLost Float64 DEFAULT 0,
    points UInt32 DEFAULT 0
) ENGINE = MergeTree()
ORDER BY (date, regionId)
PARTITION BY toYYYYMM(date)
SETTINGS index_granularity = 3;

CREATE INDEX IF NOT EXISTS idx_entity_daily_region_entity ON entity_stats_daily_region (regionId) TYPE set(100) GRANULARITY 3;
CREATE INDEX IF NOT EXISTS idx_entity_daily_region_date ON entity_stats_daily_region (date) TYPE minmax GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_entity_daily_region_kills ON entity_stats_daily_region (kills) TYPE minmax GRANULARITY 1;

-- Materialized view: Region kills (via system -> region join)
CREATE MATERIALIZED VIEW IF NOT EXISTS entity_stats_daily_region_mv TO entity_stats_daily_region AS
SELECT
    toDate(k.killmailTime) AS date,
    s.regionId AS regionId,
    any(r.name) AS regionName,
    count(DISTINCT k.killmailId) AS kills,
    0 AS losses,
    sum(k.totalValue) AS iskDestroyed,
    0.0 AS iskLost,
    count(DISTINCT k.killmailId) AS points
FROM killmails k
LEFT JOIN solarSystems s ON k.solarSystemId = s.solarSystemId
LEFT JOIN regions r ON s.regionId = r.regionId
WHERE s.regionId > 0
GROUP BY date, regionId;

-- ==============================================================================
-- CHARACTER STATS DAILY (kills from attackers table)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS entity_stats_daily_character (
    date Date,
    characterId UInt32,
    characterName String,
    kills UInt32 DEFAULT 0,
    losses UInt32 DEFAULT 0,
    iskDestroyed Float64 DEFAULT 0,
    iskLost Float64 DEFAULT 0,
    points UInt32 DEFAULT 0,
    soloKills UInt32 DEFAULT 0,
    soloLosses UInt32 DEFAULT 0,
    npcKills UInt32 DEFAULT 0,
    npcLosses UInt32 DEFAULT 0,
    topShipTypeId UInt32 DEFAULT 0,
    topShipKills UInt32 DEFAULT 0,
    topSystemId UInt32 DEFAULT 0,
    topSystemKills UInt32 DEFAULT 0,
    lastKillTime DateTime DEFAULT toDateTime(0),
    lastLossTime DateTime DEFAULT toDateTime(0)
) ENGINE = MergeTree()
ORDER BY (date, characterId)
PARTITION BY toYYYYMM(date)
SETTINGS index_granularity = 3;

CREATE INDEX IF NOT EXISTS idx_entity_daily_character_entity ON entity_stats_daily_character (characterId) TYPE set(100) GRANULARITY 3;
CREATE INDEX IF NOT EXISTS idx_entity_daily_character_date ON entity_stats_daily_character (date) TYPE minmax GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_entity_daily_character_kills ON entity_stats_daily_character (kills) TYPE minmax GRANULARITY 1;

-- Materialized view: Character kills (from all attackers) + losses (as victim) - both in single row per day
CREATE MATERIALIZED VIEW IF NOT EXISTS entity_stats_daily_character_mv TO entity_stats_daily_character AS
WITH kills_data AS (
  -- Kills: as attacker
  SELECT
    toDate(k.killmailTime) AS date,
    a.characterId AS characterId,
    any(COALESCE(c.name, nc.name, '')) AS characterName,
    count() AS kills,
    0 AS losses,
    sum(k.totalValue) AS iskDestroyed,
    0.0 AS iskLost,
    count() AS points,
    countIf(k.solo = 1) AS soloKills,
    0 AS soloLosses,
    countIf(k.npc = 1) AS npcKills,
    0 AS npcLosses,
    argMax(a.shipTypeId, k.killmailTime) AS topShipTypeId,
    count() AS topShipKills,
    argMax(k.solarSystemId, k.killmailTime) AS topSystemId,
    count() AS topSystemKills,
    max(k.killmailTime) AS lastKillTime,
    toDateTime(0) AS lastLossTime
  FROM attackers a
  INNER JOIN killmails k ON a.killmailId = k.killmailId
  LEFT JOIN characters c ON a.characterId = c.characterId
  LEFT JOIN npcCharacters nc ON a.characterId = nc.characterId
  WHERE a.characterId > 0
  GROUP BY date, characterId
),
losses_data AS (
  -- Losses: as victim
  SELECT
    toDate(k.killmailTime) AS date,
    k.victimCharacterId AS characterId,
    any(COALESCE(vc.name, nvc.name, '')) AS characterName,
    0 AS kills,
    count() AS losses,
    0.0 AS iskDestroyed,
    sum(k.totalValue) AS iskLost,
    0 AS points,
    0 AS soloKills,
    countIf(k.solo = 1) AS soloLosses,
    0 AS npcKills,
    countIf(k.npc = 1) AS npcLosses,
    argMax(k.victimShipTypeId, k.killmailTime) AS topShipTypeId,
    count() AS topShipKills,
    argMax(k.solarSystemId, k.killmailTime) AS topSystemId,
    count() AS topSystemKills,
    toDateTime(0) AS lastKillTime,
    max(k.killmailTime) AS lastLossTime
  FROM killmails k
  LEFT JOIN characters vc ON k.victimCharacterId = vc.characterId
  LEFT JOIN npcCharacters nvc ON k.victimCharacterId = nvc.characterId
  WHERE k.victimCharacterId > 0
  GROUP BY date, characterId
)
SELECT
  date,
  characterId,
  any(characterName) AS characterName,
  sum(kills) AS kills,
  sum(losses) AS losses,
  sum(iskDestroyed) AS iskDestroyed,
  sum(iskLost) AS iskLost,
  sum(points) AS points,
  sum(soloKills) AS soloKills,
  sum(soloLosses) AS soloLosses,
  sum(npcKills) AS npcKills,
  sum(npcLosses) AS npcLosses,
  max(topShipTypeId) AS topShipTypeId,
  max(topShipKills) AS topShipKills,
  max(topSystemId) AS topSystemId,
  max(topSystemKills) AS topSystemKills,
  maxIf(lastKillTime, lastKillTime != toDateTime(0)) AS lastKillTime,
  maxIf(lastLossTime, lastLossTime != toDateTime(0)) AS lastLossTime
FROM (
  SELECT * FROM kills_data
  UNION ALL
  SELECT * FROM losses_data
)
GROUP BY date, characterId;

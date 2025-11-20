-- Unified Killlist Materialized View
-- Single table for all killmail list views (frontpage, entity pages, etc.)
-- Optimization #6 applied: Added set(100) indexes on entity IDs

-- Unified killlist table: shows kills with denormalized data and entity tracking
CREATE TABLE IF NOT EXISTS killlist (
    killmailId UInt32,
    killmailTime DateTime,

    -- Location
    solarSystemId UInt32,
    solarSystemName String,
    regionId UInt32,
    regionName String,
    security Float32,

    -- Victim info
    victimCharacterId Nullable(UInt32),
    victimCharacterName String,
    victimCorporationId UInt32,
    victimCorporationName String,
    victimCorporationTicker String,
    victimAllianceId Nullable(UInt32),
    victimAllianceName String,
    victimAllianceTicker String,
    victimShipTypeId UInt32,
    victimShipName String,
    victimShipGroupId UInt32,
    victimShipGroup String,
    victimDamageTaken UInt32,

    -- Attacker info (top attacker)
    topAttackerCharacterId Nullable(UInt32),
    topAttackerCharacterName String,
    topAttackerCorporationId Nullable(UInt32),
    topAttackerCorporationName String,
    topAttackerCorporationTicker String,
    topAttackerAllianceId Nullable(UInt32),
    topAttackerAllianceName String,
    topAttackerAllianceTicker String,
    topAttackerShipTypeId Nullable(UInt32),

    -- Value and counts
    totalValue Float64,
    attackerCount UInt16,

    -- Flags
    npc Boolean,
    solo Boolean,
    awox Boolean,

    -- Entity tracking (for entity-specific queries)
    entityId UInt32,
    entityType Enum8('none' = 0, 'character' = 1, 'corporation' = 2, 'alliance' = 3),
    isVictim Boolean,

    -- Optimization #4: Projection for value-sorted queries
    PROJECTION killlist_by_value (
        SELECT *
        ORDER BY (totalValue, killmailTime, killmailId)
    ),
    -- Projection optimized for entityType and entityId filtering
    PROJECTION killlist_by_entity_type (
        SELECT *
        ORDER BY (entityType, entityId, killmailTime, killmailId)
    )
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(killmailTime)
ORDER BY (killmailTime, killmailId)
SETTINGS index_granularity = 1;

-- Optimization #6: Set indexes on entity IDs for efficient IN queries
CREATE INDEX IF NOT EXISTS idx_killlist_victim_character ON killlist (victimCharacterId) TYPE set(100) GRANULARITY 3;
CREATE INDEX IF NOT EXISTS idx_killlist_victim_corporation ON killlist (victimCorporationId) TYPE set(100) GRANULARITY 3;
CREATE INDEX IF NOT EXISTS idx_killlist_victim_alliance ON killlist (victimAllianceId) TYPE set(100) GRANULARITY 3;
CREATE INDEX IF NOT EXISTS idx_killlist_attacker_character ON killlist (topAttackerCharacterId) TYPE set(100) GRANULARITY 3;
CREATE INDEX IF NOT EXISTS idx_killlist_attacker_corporation ON killlist (topAttackerCorporationId) TYPE set(100) GRANULARITY 3;
CREATE INDEX IF NOT EXISTS idx_killlist_attacker_alliance ON killlist (topAttackerAllianceId) TYPE set(100) GRANULARITY 3;
CREATE INDEX IF NOT EXISTS idx_killlist_entity ON killlist (entityId) TYPE set(100) GRANULARITY 3;
CREATE INDEX IF NOT EXISTS idx_killlist_entity_type ON killlist (entityType) TYPE set(100) GRANULARITY 3;
CREATE INDEX IF NOT EXISTS idx_killlist_region ON killlist (regionId) TYPE minmax GRANULARITY 3;
CREATE INDEX IF NOT EXISTS idx_killlist_security ON killlist (security) TYPE minmax GRANULARITY 3;
CREATE INDEX IF NOT EXISTS idx_killlist_victim_ship_group ON killlist (victimShipGroupId) TYPE set(100) GRANULARITY 3;
-- Performance optimization: indexes for PREWHERE filtering and time-range queries
CREATE INDEX IF NOT EXISTS idx_killlist_entity_type_victim ON killlist (entityType, isVictim) TYPE set(3) GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_killlist_time ON killlist (killmailTime) TYPE minmax GRANULARITY 1;

-- Materialized view to populate killlist from victims (frontpage + entity pages)
CREATE MATERIALIZED VIEW IF NOT EXISTS killlist_victim_mv TO killlist AS
SELECT
    k.killmailId AS killmailId,
    k.killmailTime AS killmailTime,
    k.solarSystemId AS solarSystemId,
    coalesce(sys.name, 'Unknown') AS solarSystemName,
    coalesce(sys.regionId, 0) AS regionId,
    coalesce(reg.name, 'Unknown') AS regionName,
    coalesce(sys.securityStatus, 0.0) AS security,
    k.victimCharacterId AS victimCharacterId,
    coalesce(vc.name, vnpc.name, 'Unknown') AS victimCharacterName,
    k.victimCorporationId AS victimCorporationId,
    coalesce(vcorp.name, vnpc_corp.name, 'Unknown') AS victimCorporationName,
    coalesce(vcorp.ticker, vnpc_corp.tickerName, '???') AS victimCorporationTicker,
    k.victimAllianceId AS victimAllianceId,
    coalesce(valliance.name, '') AS victimAllianceName,
    coalesce(valliance.ticker, '') AS victimAllianceTicker,
    k.victimShipTypeId AS victimShipTypeId,
    coalesce(vship.name, 'Unknown') AS victimShipName,
    coalesce(t.groupId, 0) AS victimShipGroupId,
    coalesce(vshipgroup.name, 'Unknown') AS victimShipGroup,
    k.victimDamageTaken AS victimDamageTaken,
    k.topAttackerCharacterId AS topAttackerCharacterId,
    coalesce(ac.name, anpc.name, 'Unknown') AS topAttackerCharacterName,
    k.topAttackerCorporationId AS topAttackerCorporationId,
    coalesce(acorp.name, anpc_corp.name, 'Unknown') AS topAttackerCorporationName,
    coalesce(acorp.ticker, anpc_corp.tickerName, '???') AS topAttackerCorporationTicker,
    k.topAttackerAllianceId AS topAttackerAllianceId,
    coalesce(aalliance.name, '') AS topAttackerAllianceName,
    coalesce(aalliance.ticker, '') AS topAttackerAllianceTicker,
    k.topAttackerShipTypeId AS topAttackerShipTypeId,
    k.totalValue AS totalValue,
    k.attackerCount AS attackerCount,
    k.npc AS npc,
    k.solo AS solo,
    k.awox AS awox,
    k.victimCharacterId AS entityId,
    'character' AS entityType,
    true AS isVictim
FROM killmails k
LEFT JOIN solarSystems sys FINAL ON k.solarSystemId = sys.solarSystemId
LEFT JOIN regions reg FINAL ON sys.regionId = reg.regionId
LEFT JOIN characters vc FINAL ON k.victimCharacterId = vc.characterId
LEFT JOIN npcCharacters vnpc FINAL ON k.victimCharacterId = vnpc.characterId
LEFT JOIN corporations vcorp FINAL ON k.victimCorporationId = vcorp.corporationId
LEFT JOIN npcCorporations vnpc_corp FINAL ON k.victimCorporationId = vnpc_corp.corporationId
LEFT JOIN alliances valliance FINAL ON k.victimAllianceId = valliance.allianceId
LEFT JOIN types vship FINAL ON k.victimShipTypeId = vship.typeId
LEFT JOIN types t FINAL ON k.victimShipTypeId = t.typeId
LEFT JOIN groups vshipgroup FINAL ON t.groupId = vshipgroup.groupId
LEFT JOIN characters ac FINAL ON k.topAttackerCharacterId = ac.characterId
LEFT JOIN npcCharacters anpc FINAL ON k.topAttackerCharacterId = anpc.characterId
LEFT JOIN corporations acorp FINAL ON k.topAttackerCorporationId = acorp.corporationId
LEFT JOIN npcCorporations anpc_corp FINAL ON k.topAttackerCorporationId = anpc_corp.corporationId
LEFT JOIN alliances aalliance FINAL ON k.topAttackerAllianceId = aalliance.allianceId
WHERE k.victimCharacterId > 0;

-- Materialized view to populate killlist from attackers (entity pages)
CREATE MATERIALIZED VIEW IF NOT EXISTS killlist_attacker_mv TO killlist AS
SELECT
    k.killmailId AS killmailId,
    k.killmailTime AS killmailTime,
    k.solarSystemId AS solarSystemId,
    coalesce(sys.name, 'Unknown') AS solarSystemName,
    coalesce(sys.regionId, 0) AS regionId,
    coalesce(reg.name, 'Unknown') AS regionName,
    coalesce(sys.securityStatus, 0.0) AS security,
    k.victimCharacterId AS victimCharacterId,
    coalesce(vc.name, vnpc.name, 'Unknown') AS victimCharacterName,
    k.victimCorporationId AS victimCorporationId,
    coalesce(vcorp.name, vnpc_corp.name, 'Unknown') AS victimCorporationName,
    coalesce(vcorp.ticker, vnpc_corp.tickerName, '???') AS victimCorporationTicker,
    k.victimAllianceId AS victimAllianceId,
    coalesce(valliance.name, '') AS victimAllianceName,
    coalesce(valliance.ticker, '') AS victimAllianceTicker,
    k.victimShipTypeId AS victimShipTypeId,
    coalesce(vship.name, 'Unknown') AS victimShipName,
    coalesce(t.groupId, 0) AS victimShipGroupId,
    coalesce(vshipgroup.name, 'Unknown') AS victimShipGroup,
    k.victimDamageTaken AS victimDamageTaken,
    k.topAttackerCharacterId AS topAttackerCharacterId,
    coalesce(ac.name, anpc.name, 'Unknown') AS topAttackerCharacterName,
    k.topAttackerCorporationId AS topAttackerCorporationId,
    coalesce(acorp.name, anpc_corp.name, 'Unknown') AS topAttackerCorporationName,
    coalesce(acorp.ticker, anpc_corp.tickerName, '???') AS topAttackerCorporationTicker,
    k.topAttackerAllianceId AS topAttackerAllianceId,
    coalesce(aalliance.name, '') AS topAttackerAllianceName,
    coalesce(aalliance.ticker, '') AS topAttackerAllianceTicker,
    k.topAttackerShipTypeId AS topAttackerShipTypeId,
    k.totalValue AS totalValue,
    k.attackerCount AS attackerCount,
    k.npc AS npc,
    k.solo AS solo,
    k.awox AS awox,
    a.characterId AS entityId,
    'character' AS entityType,
    false AS isVictim
FROM attackers a
JOIN killmails k ON a.killmailId = k.killmailId
LEFT JOIN solarSystems sys FINAL ON k.solarSystemId = sys.solarSystemId
LEFT JOIN regions reg FINAL ON sys.regionId = reg.regionId
LEFT JOIN characters vc FINAL ON k.victimCharacterId = vc.characterId
LEFT JOIN npcCharacters vnpc FINAL ON k.victimCharacterId = vnpc.characterId
LEFT JOIN corporations vcorp FINAL ON k.victimCorporationId = vcorp.corporationId
LEFT JOIN npcCorporations vnpc_corp FINAL ON k.victimCorporationId = vnpc_corp.corporationId
LEFT JOIN alliances valliance FINAL ON k.victimAllianceId = valliance.allianceId
LEFT JOIN types vship FINAL ON k.victimShipTypeId = vship.typeId
LEFT JOIN types t FINAL ON k.victimShipTypeId = t.typeId
LEFT JOIN groups vshipgroup FINAL ON t.groupId = vshipgroup.groupId
LEFT JOIN characters ac FINAL ON k.topAttackerCharacterId = ac.characterId
LEFT JOIN npcCharacters anpc FINAL ON k.topAttackerCharacterId = anpc.characterId
LEFT JOIN corporations acorp FINAL ON k.topAttackerCorporationId = acorp.corporationId
LEFT JOIN npcCorporations anpc_corp FINAL ON k.topAttackerCorporationId = anpc_corp.corporationId
LEFT JOIN alliances aalliance FINAL ON k.topAttackerAllianceId = aalliance.allianceId
WHERE a.characterId > 0;

-- Materialized view for frontpage (no entity tracking)
CREATE MATERIALIZED VIEW IF NOT EXISTS killlist_frontpage_mv TO killlist AS
SELECT
    k.killmailId AS killmailId,
    k.killmailTime AS killmailTime,
    k.solarSystemId AS solarSystemId,
    coalesce(sys.name, 'Unknown') AS solarSystemName,
    coalesce(sys.regionId, 0) AS regionId,
    coalesce(reg.name, 'Unknown') AS regionName,
    coalesce(sys.securityStatus, 0.0) AS security,
    k.victimCharacterId AS victimCharacterId,
    coalesce(vc.name, vnpc.name, 'Unknown') AS victimCharacterName,
    k.victimCorporationId AS victimCorporationId,
    coalesce(vcorp.name, vnpc_corp.name, 'Unknown') AS victimCorporationName,
    coalesce(vcorp.ticker, vnpc_corp.tickerName, '???') AS victimCorporationTicker,
    k.victimAllianceId AS victimAllianceId,
    coalesce(valliance.name, '') AS victimAllianceName,
    coalesce(valliance.ticker, '') AS victimAllianceTicker,
    k.victimShipTypeId AS victimShipTypeId,
    coalesce(vship.name, 'Unknown') AS victimShipName,
    coalesce(t.groupId, 0) AS victimShipGroupId,
    coalesce(vshipgroup.name, 'Unknown') AS victimShipGroup,
    k.victimDamageTaken AS victimDamageTaken,
    k.topAttackerCharacterId AS topAttackerCharacterId,
    coalesce(ac.name, anpc.name, 'Unknown') AS topAttackerCharacterName,
    k.topAttackerCorporationId AS topAttackerCorporationId,
    coalesce(acorp.name, anpc_corp.name, 'Unknown') AS topAttackerCorporationName,
    coalesce(acorp.ticker, anpc_corp.tickerName, '???') AS topAttackerCorporationTicker,
    k.topAttackerAllianceId AS topAttackerAllianceId,
    coalesce(aalliance.name, '') AS topAttackerAllianceName,
    coalesce(aalliance.ticker, '') AS topAttackerAllianceTicker,
    k.topAttackerShipTypeId AS topAttackerShipTypeId,
    k.totalValue AS totalValue,
    k.attackerCount AS attackerCount,
    k.npc AS npc,
    k.solo AS solo,
    k.awox AS awox,
    0 AS entityId,
    'none' AS entityType,
    false AS isVictim
FROM killmails k
LEFT JOIN solarSystems sys FINAL ON k.solarSystemId = sys.solarSystemId
LEFT JOIN regions reg FINAL ON sys.regionId = reg.regionId
LEFT JOIN characters vc FINAL ON k.victimCharacterId = vc.characterId
LEFT JOIN npcCharacters vnpc FINAL ON k.victimCharacterId = vnpc.characterId
LEFT JOIN corporations vcorp FINAL ON k.victimCorporationId = vcorp.corporationId
LEFT JOIN npcCorporations vnpc_corp FINAL ON k.victimCorporationId = vnpc_corp.corporationId
LEFT JOIN alliances valliance FINAL ON k.victimAllianceId = valliance.allianceId
LEFT JOIN types vship FINAL ON k.victimShipTypeId = vship.typeId
LEFT JOIN types t FINAL ON k.victimShipTypeId = t.typeId
LEFT JOIN groups vshipgroup FINAL ON t.groupId = vshipgroup.groupId
LEFT JOIN characters ac FINAL ON k.topAttackerCharacterId = ac.characterId
LEFT JOIN npcCharacters anpc FINAL ON k.topAttackerCharacterId = anpc.characterId
LEFT JOIN corporations acorp FINAL ON k.topAttackerCorporationId = acorp.corporationId
LEFT JOIN npcCorporations anpc_corp FINAL ON k.topAttackerCorporationId = anpc_corp.corporationId
LEFT JOIN alliances aalliance FINAL ON k.topAttackerAllianceId = aalliance.allianceId;

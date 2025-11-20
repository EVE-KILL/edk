-- Most Valuable Kills Materialized View (Denormalized & Optimized)
-- Tracks the most expensive kills with all entity names pre-computed
-- Denormalization eliminates expensive JOINs for O(1) lookup performance
--
-- OPTIMIZATION: Removed periodType Enum and CROSS JOIN multiplication
-- Instead: compute period at query time using killmailTime range
-- This reduces storage by 5x and enables better partition pruning
-- IMPORTANT: Requires entities (characters/corporations/alliances) to be inserted BEFORE killmails

DROP TABLE IF EXISTS most_valuable_kills;
DROP TABLE IF EXISTS most_valuable_kills_latest;
DROP VIEW IF EXISTS most_valuable_kills_mv;
DROP VIEW IF EXISTS most_valuable_kills_latest_mv;

CREATE TABLE IF NOT EXISTS most_valuable_kills_latest (
    killmailId UInt32,
    killmailTime DateTime,
    solarSystemId UInt32,
    solarSystemName String DEFAULT 'Unknown',
    victimCharacterId Nullable(UInt32),
    victimCharacterName String DEFAULT 'Unknown',
    victimCorporationId UInt32,
    victimCorporationName String DEFAULT 'Unknown',
    victimCorporationTicker String DEFAULT '???',
    victimAllianceId Nullable(UInt32),
    victimAllianceName Nullable(String),
    victimAllianceTicker Nullable(String),
    victimShipTypeId UInt32,
    victimShipName String DEFAULT 'Unknown',
    victimShipGroupId UInt32,
    victimShipGroup String DEFAULT 'Unknown',
    topAttackerCharacterId Nullable(UInt32),
    topAttackerCharacterName Nullable(String) DEFAULT 'Unknown',
    topAttackerCorporationId Nullable(UInt32),
    topAttackerCorporationName Nullable(String) DEFAULT 'Unknown',
    topAttackerCorporationTicker Nullable(String) DEFAULT '???',
    topAttackerAllianceId Nullable(UInt32),
    topAttackerAllianceName Nullable(String),
    topAttackerAllianceTicker Nullable(String),
    regionName String DEFAULT 'Unknown',
    totalValue Float64,
    attackerCount UInt16,
    npc Boolean,
    solo Boolean
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(killmailTime)
ORDER BY (killmailTime DESC, totalValue DESC, killmailId)
SETTINGS index_granularity = 3, allow_experimental_reverse_key = 1;

-- Materialized view to populate most_valuable_kills_latest (WITHOUT CROSS JOIN!)
CREATE MATERIALIZED VIEW IF NOT EXISTS most_valuable_kills_latest_mv TO most_valuable_kills_latest AS
SELECT
    k.killmailId,
    k.killmailTime,
    k.solarSystemId as solarSystemId,
    coalesce(ss.name, 'Unknown System') as solarSystemName,
    k.victimCharacterId,
    coalesce(vc.name, vnc.name, 'Unknown') as victimCharacterName,
    k.victimCorporationId,
    coalesce(vco.name, vnco.name, 'Unknown') as victimCorporationName,
    coalesce(vco.ticker, vnco.tickerName, '???') as victimCorporationTicker,
    k.victimAllianceId,
    coalesce(va.name, NULL) as victimAllianceName,
    coalesce(va.ticker, NULL) as victimAllianceTicker,
    k.victimShipTypeId,
    coalesce(t.name, 'Unknown Ship') as victimShipName,
    coalesce(t.groupId, 0) as victimShipGroupId,
    coalesce(g.name, 'Unknown') as victimShipGroup,
    k.topAttackerCharacterId,
    coalesce(ac.name, anc.name, 'Unknown') as topAttackerCharacterName,
    k.topAttackerCorporationId,
    coalesce(aco.name, anco.name, 'Unknown') as topAttackerCorporationName,
    coalesce(aco.ticker, anco.tickerName, '???') as topAttackerCorporationTicker,
    k.topAttackerAllianceId,
    coalesce(aa.name, NULL) as topAttackerAllianceName,
    coalesce(aa.ticker, NULL) as topAttackerAllianceTicker,
    coalesce(r.name, 'Unknown Region') as regionName,
    k.totalValue,
    k.attackerCount,
    k.npc,
    k.solo
FROM killmails k
LEFT JOIN solarSystems ss ON k.solarSystemId = ss.solarSystemId
LEFT JOIN regions r ON ss.regionId = r.regionId
LEFT JOIN characters vc ON k.victimCharacterId = vc.characterId AND k.victimCharacterId > 0
LEFT JOIN npcCharacters vnc ON k.victimCharacterId = vnc.characterId AND k.victimCharacterId > 0
LEFT JOIN corporations vco ON k.victimCorporationId = vco.corporationId
LEFT JOIN npcCorporations vnco ON k.victimCorporationId = vnco.corporationId
LEFT JOIN alliances va ON k.victimAllianceId = va.allianceId AND k.victimAllianceId > 0
LEFT JOIN types t ON k.victimShipTypeId = t.typeId
LEFT JOIN groups g ON t.groupId = g.groupId
LEFT JOIN characters ac ON k.topAttackerCharacterId = ac.characterId AND k.topAttackerCharacterId > 0
LEFT JOIN npcCharacters anc ON k.topAttackerCharacterId = anc.characterId AND k.topAttackerCharacterId > 0
LEFT JOIN corporations aco ON k.topAttackerCorporationId = aco.corporationId
LEFT JOIN npcCorporations anco ON k.topAttackerCorporationId = anco.corporationId
LEFT JOIN alliances aa ON k.topAttackerAllianceId = aa.allianceId AND k.topAttackerAllianceId > 0;

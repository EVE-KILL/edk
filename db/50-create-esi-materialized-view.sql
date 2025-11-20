-- Optimization #2: Materialized ESI Format View
-- Pre-computes the ESI killmail format for instant API responses
-- Benefits: 10-50x faster killmail API lookups, eliminates complex JSON reconstruction
-- Tradeoff: ~5-7 KB additional storage per killmail

CREATE TABLE IF NOT EXISTS killmails_esi (
    killmailId UInt32,
    killmailTime DateTime,
    solarSystemId UInt32,

    -- Victim data
    victimCharacterId Nullable(UInt32),
    victimCorporationId UInt32,
    victimAllianceId Nullable(UInt32),
    victimShipTypeId UInt32,
    victimDamageTaken UInt32,
    victimPosition String, -- JSON: {x, y, z}

    -- Attackers as JSON array string (pre-serialized)
    attackers String,

    -- Items as JSON array string (pre-serialized)
    items String,

    -- Metadata
    totalValue Float64,
    attackerCount UInt16,
    npc Boolean,
    solo Boolean,
    awox Boolean,

    -- Version for updates
    version UInt32
) ENGINE = ReplacingMergeTree(version)
PARTITION BY toYYYYMM(killmailTime)
ORDER BY killmailId
SETTINGS index_granularity = 3;

-- Materialized view to populate killmails_esi
CREATE MATERIALIZED VIEW IF NOT EXISTS killmails_esi_mv TO killmails_esi AS
SELECT
    killmailId,
    killmailTime,
    solarSystemId,
    victimCharacterId,
    victimCorporationId,
    victimAllianceId,
    victimShipTypeId,
    victimDamageTaken,
    if(
        positionX IS NOT NULL AND positionY IS NOT NULL AND positionZ IS NOT NULL,
        concat('{"x":', toString(positionX), ',"y":', toString(positionY), ',"z":', toString(positionZ), '}'),
        '{"x":0,"y":0,"z":0}'
    ) AS victimPosition,


    -- Pre-serialize attackers as JSON array
    coalesce(
        (
            SELECT concat('[',
                arrayStringConcat(
                    groupArray(concat(
                        '{"character_id":', toString(coalesce(characterId, 0)),
                        ',"corporation_id":', toString(coalesce(corporationId, 0)),
                        if(allianceId > 0, concat(',"alliance_id":', toString(allianceId)), ''),
                        ',"ship_type_id":', toString(coalesce(shipTypeId, 0)),
                        ',"weapon_type_id":', toString(coalesce(weaponTypeId, 0)),
                        ',"damage_done":', toString(damageDone),
                        if(finalBlow, ',"final_blow":true', ''),
                        '}'
                    )),
                    ','
                ),
            ']')
            FROM attackers a
            WHERE a.killmailId = killmails.killmailId
        ),
        '[]'
    ) AS attackers,

    -- Pre-serialize items as JSON array
    coalesce(
        (
            SELECT concat('[',
                arrayStringConcat(
                    groupArray(concat(
                        '{"item_type_id":', toString(itemTypeId),
                        ',"flag":', toString(flag),
                        if(quantityDropped > 0, concat(',"quantity_dropped":', toString(quantityDropped)), ''),
                        if(quantityDestroyed > 0, concat(',"quantity_destroyed":', toString(quantityDestroyed)), ''),
                        if(singleton, ',"singleton":1', ''),
                        '}'
                    )),
                    ','
                ),
            ']')
            FROM items i
            WHERE i.killmailId = killmails.killmailId
        ),
        '[]'
    ) AS items,

    totalValue,
    attackerCount,
    npc,
    solo,
    awox,
    toUnixTimestamp(now()) AS version
FROM killmails;

import { database } from '../../server/helpers/database';

export const description = 'Create entity_killlist materialized view';

export async function action() {
  try {
    console.log('🔧 Creating entity_killlist materialized view...');

    // Drop existing objects
    console.log('  Dropping existing objects...');
    await database.execute('DROP TABLE IF EXISTS entity_killlist_mv');
    await database.execute('DROP TABLE IF EXISTS entity_killlist');
    await database.execute('DROP VIEW IF EXISTS entity_killlist');
    console.log('  ✅ Dropped existing objects');

    // Create materialized view
    console.log('  Creating materialized view...');
    const viewSql = `
CREATE MATERIALIZED VIEW IF NOT EXISTS entity_killlist
ENGINE = ReplacingMergeTree(version)
ORDER BY (killmail_time, killmail_id)
PARTITION BY toYYYYMM(killmail_time)
POPULATE
AS
SELECT
  k.killmailId as killmail_id,
  k.killmailTime as killmail_time,
  k.version as version,
  1 as is_kill,
  
  -- VICTIM DATA
  k.victimCharacterId as victim_character_id,
  coalesce(c_victim.name, nc_victim.name, 'Unknown') as victim_character_name,
  
  k.victimCorporationId as victim_corporation_id,
  coalesce(corp_victim.name, npc_corp_victim.name, 'Unknown') as victim_corporation_name,
  coalesce(corp_victim.ticker, npc_corp_victim.tickerName, '???') as victim_corporation_ticker,
  
  k.victimAllianceId as victim_alliance_id,
  coalesce(a_victim.name, 'Unknown') as victim_alliance_name,
  coalesce(a_victim.ticker, '???') as victim_alliance_ticker,
  
  k.victimShipTypeId as victim_ship_type_id,
  coalesce(t_victim.name, 'Unknown') as victim_ship_name,
  coalesce(g_victim.name, 'Unknown') as victim_ship_group,
  coalesce(g_victim.groupId, 0) as victim_ship_group_id,
  
  -- ATTACKER DATA
  fb.characterId as attacker_character_id,
  coalesce(c_attacker.name, nc_attacker.name, 'Unknown') as attacker_character_name,
  
  fb.corporationId as attacker_corporation_id,
  coalesce(corp_attacker.name, npc_corp_attacker.name, 'Unknown') as attacker_corporation_name,
  coalesce(corp_attacker.ticker, npc_corp_attacker.tickerName, '???') as attacker_corporation_ticker,
  
  fb.allianceId as attacker_alliance_id,
  coalesce(a_attacker.name, 'Unknown') as attacker_alliance_name,
  coalesce(a_attacker.ticker, '???') as attacker_alliance_ticker,
  
  fb.shipTypeId as attacker_ship_type_id,
  coalesce(t_attacker.name, 'Unknown') as attacker_ship_name,
  coalesce(g_attacker.name, 'Unknown') as attacker_ship_group,
  coalesce(g_attacker.groupId, 0) as attacker_ship_group_id,
  
  -- LOCATION DATA
  k.solarSystemId as solar_system_id,
  coalesce(sys.name, 'Unknown') as solar_system_name,
  coalesce(sys.securityStatus, 0.0) as solar_system_security,
  coalesce(sys.regionId, 0) as region_id,
  coalesce(reg.name, 'Unknown') as region_name,
  
  -- VALUE DATA
  coalesce(p_victim_ship.average_price, 0.0) as victim_ship_value,
  coalesce(p_attacker_ship.average_price, 0.0) as attacker_ship_value,
  coalesce(items_agg.dropped_value, 0.0) as items_dropped_value,
  coalesce(items_agg.destroyed_value, 0.0) as items_destroyed_value,
  coalesce(p_victim_ship.average_price, 0.0) + 
  coalesce(items_agg.dropped_value, 0.0) + 
  coalesce(items_agg.destroyed_value, 0.0) as total_value,
  
  -- STATS DATA
  attacker_stats.attacker_count as attacker_count,
  (attacker_stats.attacker_count = 1 AND fb.characterId IS NOT NULL) as is_solo,
  attacker_stats.is_npc as is_npc_kill

FROM edk.killmails k

LEFT JOIN edk.attackers fb ON k.killmailId = fb.killmailId AND fb.finalBlow = 1

LEFT JOIN (
  SELECT
    killmailId,
    count(*) as attacker_count,
    countIf(characterId IS NULL) = count(*) as is_npc
  FROM edk.attackers
  GROUP BY killmailId
) attacker_stats ON k.killmailId = attacker_stats.killmailId

LEFT JOIN edk.types t_victim ON k.victimShipTypeId = t_victim.typeId
LEFT JOIN edk.groups g_victim ON t_victim.groupId = g_victim.groupId

LEFT JOIN edk.characters c_victim ON k.victimCharacterId = c_victim.character_id
LEFT JOIN edk.npcCharacters nc_victim ON k.victimCharacterId = nc_victim.characterId

LEFT JOIN edk.corporations corp_victim ON k.victimCorporationId = corp_victim.corporation_id
LEFT JOIN edk.npcCorporations npc_corp_victim ON k.victimCorporationId = npc_corp_victim.corporationId

LEFT JOIN edk.alliances a_victim ON k.victimAllianceId = a_victim.alliance_id

LEFT JOIN (
  SELECT
    type_id,
    argMax(average_price, version) as average_price
  FROM edk.prices
  WHERE region_id = 10000002
  AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
  GROUP BY type_id
) p_victim_ship ON k.victimShipTypeId = p_victim_ship.type_id

LEFT JOIN edk.types t_attacker ON fb.shipTypeId = t_attacker.typeId
LEFT JOIN edk.groups g_attacker ON t_attacker.groupId = g_attacker.groupId

LEFT JOIN edk.characters c_attacker ON fb.characterId = c_attacker.character_id
LEFT JOIN edk.npcCharacters nc_attacker ON fb.characterId = nc_attacker.characterId

LEFT JOIN edk.corporations corp_attacker ON fb.corporationId = corp_attacker.corporation_id
LEFT JOIN edk.npcCorporations npc_corp_attacker ON fb.corporationId = npc_corp_attacker.corporationId

LEFT JOIN edk.alliances a_attacker ON fb.allianceId = a_attacker.alliance_id

LEFT JOIN (
  SELECT
    type_id,
    argMax(average_price, version) as average_price
  FROM edk.prices
  WHERE region_id = 10000002
  AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
  GROUP BY type_id
) p_attacker_ship ON fb.shipTypeId = p_attacker_ship.type_id

LEFT JOIN edk.mapSolarSystems sys ON k.solarSystemId = sys.solarSystemId
LEFT JOIN edk.mapRegions reg ON sys.regionId = reg.regionId

LEFT JOIN (
  SELECT
    i.killmailId,
    sum(coalesce(p.average_price, 0.0) * i.quantityDropped) as dropped_value,
    sum(coalesce(p.average_price, 0.0) * i.quantityDestroyed) as destroyed_value
  FROM edk.items i
  LEFT JOIN (
    SELECT
      type_id,
      argMax(average_price, version) as average_price
    FROM edk.prices
    WHERE region_id = 10000002
    AND price_date = (SELECT max(price_date) FROM edk.prices WHERE region_id = 10000002)
    GROUP BY type_id
  ) p ON i.itemTypeId = p.type_id
  GROUP BY i.killmailId
) items_agg ON k.killmailId = items_agg.killmailId
    `;

    await database.execute(viewSql);
    console.log('  ✅ Created materialized view');

    console.log('✅ Entity killlist view created successfully!');
  } catch (error) {
    console.error(
      '❌ Error:',
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

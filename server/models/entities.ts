/**
 * Entity Model
 * Handles entity page queries using the entity_killlist materialized view
 * Provides top boxes, most valuable kills, and entity statistics
 */

import { database } from '../helpers/database'

export interface TopBoxItem {
  id: number
  name: string
  count: number
  kills: number
  losses: number
}

export interface MostValuableKill {
  killmail_id: number
  killmail_time: string
  victim_ship_name: string
  victim_ship_type_id: number
  victim_character_name: string
  victim_corporation_name: string
  victim_corporation_ticker: string
  victim_alliance_name: string | null
  victim_alliance_ticker: string | null
  solar_system_name: string
  region_name: string
  total_value: number
  attacker_count: number
}

export interface EntityStats {
  kills: number
  losses: number
  killLossRatio: number
  iskDestroyed: number
  iskLost: number
  iskEfficiency: number
  efficiency: number
}

/**
 * Get top 10 ships for a character (as attacker/killer)
 */
export async function getTopShips(
  characterId: number,
  days: number = 30
): Promise<TopBoxItem[]> {
  const cutoffTimestamp = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)

  const result = await database.query<{
    ship_type_id: number
    ship_name: string
    total: number
    kills: number
    losses: number
  }>(`
    SELECT
      attacker_ship_type_id as ship_type_id,
      attacker_ship_name as ship_name,
      count() as total,
      countIf(victim_character_id = {characterId:UInt32}) as kills,
      countIf(victim_character_id != {characterId:UInt32}) as losses
    FROM entity_killlist
    WHERE (attacker_character_id = {characterId:UInt32})
    AND killmail_time >= toDateTime({cutoffTimestamp:UInt32})
    GROUP BY attacker_ship_type_id, attacker_ship_name
    ORDER BY total DESC
    LIMIT 10
  `, { characterId, cutoffTimestamp })

  return result.map(r => ({
    id: r.ship_type_id,
    name: r.ship_name,
    count: r.total,
    kills: r.kills,
    losses: r.losses
  }))
}

/**
 * Get top 10 systems for a character (as attacker/killer)
 */
export async function getTopSystems(
  characterId: number,
  days: number = 30
): Promise<TopBoxItem[]> {
  const cutoffTimestamp = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)

  const result = await database.query<{
    system_id: number
    system_name: string
    total: number
    kills: number
    losses: number
  }>(`
    SELECT
      solar_system_id as system_id,
      solar_system_name as system_name,
      count() as total,
      countIf(victim_character_id = {characterId:UInt32}) as kills,
      countIf(victim_character_id != {characterId:UInt32}) as losses
    FROM entity_killlist
    WHERE (attacker_character_id = {characterId:UInt32})
    AND killmail_time >= toDateTime({cutoffTimestamp:UInt32})
    GROUP BY solar_system_id, solar_system_name
    ORDER BY total DESC
    LIMIT 10
  `, { characterId, cutoffTimestamp })

  return result.map(r => ({
    id: r.system_id,
    name: r.system_name,
    count: r.total,
    kills: r.kills,
    losses: r.losses
  }))
}

/**
 * Get top 10 regions for a character (as attacker/killer)
 */
export async function getTopRegions(
  characterId: number,
  days: number = 30
): Promise<TopBoxItem[]> {
  const cutoffTimestamp = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)

  const result = await database.query<{
    region_id: number
    region_name: string
    total: number
    kills: number
    losses: number
  }>(`
    SELECT
      region_id,
      region_name,
      count() as total,
      countIf(victim_character_id = {characterId:UInt32}) as kills,
      countIf(victim_character_id != {characterId:UInt32}) as losses
    FROM entity_killlist
    WHERE (attacker_character_id = {characterId:UInt32})
    AND killmail_time >= toDateTime({cutoffTimestamp:UInt32})
    GROUP BY region_id, region_name
    ORDER BY total DESC
    LIMIT 10
  `, { characterId, cutoffTimestamp })

  return result.map(r => ({
    id: r.region_id,
    name: r.region_name,
    count: r.total,
    kills: r.kills,
    losses: r.losses
  }))
}

/**
 * Get top 10 corporations killed by a character
 */
export async function getTopCorporationsKilled(
  characterId: number,
  days: number = 30
): Promise<TopBoxItem[]> {
  const cutoffTimestamp = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)

  const result = await database.query<{
    corp_id: number
    corp_name: string
    total: number
    kills: number
    losses: number
  }>(`
    SELECT
      victim_corporation_id as corp_id,
      victim_corporation_name as corp_name,
      count() as total,
      countIf(victim_character_id = {characterId:UInt32}) as kills,
      countIf(victim_character_id != {characterId:UInt32}) as losses
    FROM entity_killlist
    WHERE (attacker_character_id = {characterId:UInt32})
    AND killmail_time >= toDateTime({cutoffTimestamp:UInt32})
    GROUP BY victim_corporation_id, victim_corporation_name
    ORDER BY total DESC
    LIMIT 10
  `, { characterId, cutoffTimestamp })

  return result.map(r => ({
    id: r.corp_id,
    name: r.corp_name,
    count: r.total,
    kills: r.kills,
    losses: r.losses
  }))
}

/**
 * Get top 10 alliances killed by a character
 */
export async function getTopAlliancesKilled(
  characterId: number,
  days: number = 30
): Promise<TopBoxItem[]> {
  const cutoffTimestamp = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)

  const result = await database.query<{
    alliance_id: number | null
    alliance_name: string
    total: number
    kills: number
    losses: number
  }>(`
    SELECT
      victim_alliance_id as alliance_id,
      victim_alliance_name as alliance_name,
      count() as total,
      countIf(victim_character_id = {characterId:UInt32}) as kills,
      countIf(victim_character_id != {characterId:UInt32}) as losses
    FROM entity_killlist
    WHERE (attacker_character_id = {characterId:UInt32})
    AND victim_alliance_id IS NOT NULL
    AND killmail_time >= toDateTime({cutoffTimestamp:UInt32})
    GROUP BY victim_alliance_id, victim_alliance_name
    ORDER BY total DESC
    LIMIT 10
  `, { characterId, cutoffTimestamp })

  return result
    .filter(r => r.alliance_id !== null)
    .map(r => ({
      id: r.alliance_id!,
      name: r.alliance_name,
      count: r.total,
      kills: r.kills,
      losses: r.losses
    }))
}

/**
 * Get most valuable kills for a character (as attacker)
 */
export async function getMostValuableKillsByCharacterNew(
  characterId: number,
  limit: number = 6,
  days: number = 7
): Promise<MostValuableKill[]> {
  const cutoffTimestamp = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)

  const result = await database.query<MostValuableKill>(`
    SELECT
      killmail_id,
      killmail_time,
      victim_ship_name,
      victim_ship_type_id,
      victim_character_name,
      victim_corporation_name,
      victim_corporation_ticker,
      victim_alliance_name,
      victim_alliance_ticker,
      solar_system_name,
      region_name,
      total_value,
      attacker_count
    FROM entity_killlist
    WHERE attacker_character_id = {characterId:UInt32}
    AND killmail_time >= toDateTime({cutoffTimestamp:UInt32})
    ORDER BY total_value DESC
    LIMIT {limit:UInt32}
  `, { characterId, cutoffTimestamp, limit })

  return result
}

/**
 * Get entity statistics (kills, losses, ISK, efficiency)
 * Calculates stats from entity_killlist on-demand
 */
export async function getCharacterStats(characterId: number): Promise<EntityStats> {
  const result = await database.queryOne<{
    kills: number
    losses: number
    isk_destroyed: number
    isk_lost: number
  }>(`
    SELECT
      countIf(attacker_character_id = {characterId:UInt32}) as kills,
      countIf(victim_character_id = {characterId:UInt32}) as losses,
      sumIf(total_value, attacker_character_id = {characterId:UInt32}) as isk_destroyed,
      sumIf(total_value, victim_character_id = {characterId:UInt32}) as isk_lost
    FROM entity_killlist
    WHERE attacker_character_id = {characterId:UInt32} OR victim_character_id = {characterId:UInt32}
  `, { characterId })

  if (!result) {
    return {
      kills: 0,
      losses: 0,
      killLossRatio: 0,
      iskDestroyed: 0,
      iskLost: 0,
      iskEfficiency: 0,
      efficiency: 0
    }
  }

  const { kills, losses, isk_destroyed, isk_lost } = result
  const totalISK = (isk_destroyed || 0) + (isk_lost || 0)
  const totalKills = kills + losses

  return {
    kills: kills || 0,
    losses: losses || 0,
    killLossRatio: losses > 0 ? kills / losses : kills,
    iskDestroyed: isk_destroyed || 0,
    iskLost: isk_lost || 0,
    iskEfficiency: totalISK > 0 ? ((isk_destroyed || 0) / totalISK) * 100 : 0,
    efficiency: totalKills > 0 ? (kills / totalKills) * 100 : 0
  }
}

/**
 * Get entity statistics for a corporation
 */
export async function getCorporationStats(corporationId: number): Promise<EntityStats> {
  const result = await database.queryOne<{
    kills: number
    losses: number
    isk_destroyed: number
    isk_lost: number
  }>(`
    SELECT
      countIf(attacker_corporation_id = {corporationId:UInt32}) as kills,
      countIf(victim_corporation_id = {corporationId:UInt32}) as losses,
      sumIf(total_value, attacker_corporation_id = {corporationId:UInt32}) as isk_destroyed,
      sumIf(total_value, victim_corporation_id = {corporationId:UInt32}) as isk_lost
    FROM entity_killlist
    WHERE attacker_corporation_id = {corporationId:UInt32} OR victim_corporation_id = {corporationId:UInt32}
  `, { corporationId })

  if (!result) {
    return {
      kills: 0,
      losses: 0,
      killLossRatio: 0,
      iskDestroyed: 0,
      iskLost: 0,
      iskEfficiency: 0,
      efficiency: 0
    }
  }

  const { kills, losses, isk_destroyed, isk_lost } = result
  const totalISK = (isk_destroyed || 0) + (isk_lost || 0)
  const totalKills = kills + losses

  return {
    kills: kills || 0,
    losses: losses || 0,
    killLossRatio: losses > 0 ? kills / losses : kills,
    iskDestroyed: isk_destroyed || 0,
    iskLost: isk_lost || 0,
    iskEfficiency: totalISK > 0 ? ((isk_destroyed || 0) / totalISK) * 100 : 0,
    efficiency: totalKills > 0 ? (kills / totalKills) * 100 : 0
  }
}

/**
 * Get top 10 corporations killed by a corporation
 */
export async function getTopCorporationsKilledByCorporation(
  corporationId: number,
  days: number = 30
): Promise<TopBoxItem[]> {
  const cutoffTimestamp = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)

  const result = await database.query<{
    corp_id: number
    corp_name: string
    total: number
    kills: number
    losses: number
  }>(`
    SELECT
      victim_corporation_id as corp_id,
      victim_corporation_name as corp_name,
      count() as total,
      countIf(victim_corporation_id = {corporationId:UInt32}) as kills,
      countIf(victim_corporation_id != {corporationId:UInt32}) as losses
    FROM entity_killlist
    WHERE (attacker_corporation_id = {corporationId:UInt32})
    AND killmail_time >= toDateTime({cutoffTimestamp:UInt32})
    GROUP BY victim_corporation_id, victim_corporation_name
    ORDER BY total DESC
    LIMIT 10
  `, { corporationId, cutoffTimestamp })

  return result.map(r => ({
    id: r.corp_id,
    name: r.corp_name,
    count: r.total,
    kills: r.kills,
    losses: r.losses
  }))
}

/**
 * Get top 10 alliances killed by a corporation
 */
export async function getTopAlliancesKilledByCorporation(
  corporationId: number,
  days: number = 30
): Promise<TopBoxItem[]> {
  const cutoffTimestamp = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)

  const result = await database.query<{
    alliance_id: number | null
    alliance_name: string
    total: number
    kills: number
    losses: number
  }>(`
    SELECT
      victim_alliance_id as alliance_id,
      victim_alliance_name as alliance_name,
      count() as total,
      countIf(victim_corporation_id = {corporationId:UInt32}) as kills,
      countIf(victim_corporation_id != {corporationId:UInt32}) as losses
    FROM entity_killlist
    WHERE (attacker_corporation_id = {corporationId:UInt32})
    AND victim_alliance_id IS NOT NULL
    AND killmail_time >= toDateTime({cutoffTimestamp:UInt32})
    GROUP BY victim_alliance_id, victim_alliance_name
    ORDER BY total DESC
    LIMIT 10
  `, { corporationId, cutoffTimestamp })

  return result
    .filter(r => r.alliance_id !== null)
    .map(r => ({
      id: r.alliance_id!,
      name: r.alliance_name,
      count: r.total,
      kills: r.kills,
      losses: r.losses
    }))
}

/**
 * Get most valuable kills for a corporation (as attacker)
 */
export async function getMostValuableKillsByCorporationNew(
  corporationId: number,
  limit: number = 6,
  days: number = 7
): Promise<MostValuableKill[]> {
  const cutoffTimestamp = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)

  const result = await database.query<MostValuableKill>(`
    SELECT
      killmail_id,
      killmail_time,
      victim_ship_name,
      victim_ship_type_id,
      victim_character_name,
      victim_corporation_name,
      victim_corporation_ticker,
      victim_alliance_name,
      victim_alliance_ticker,
      solar_system_name,
      region_name,
      total_value,
      attacker_count
    FROM entity_killlist
    WHERE attacker_corporation_id = {corporationId:UInt32}
    AND killmail_time >= toDateTime({cutoffTimestamp:UInt32})
    ORDER BY total_value DESC
    LIMIT {limit:UInt32}
  `, { corporationId, cutoffTimestamp, limit })

  return result
}

/**
 * Get entity statistics for an alliance
 */
export async function getAllianceStats(allianceId: number): Promise<EntityStats> {
  const result = await database.queryOne<{
    kills: number
    losses: number
    isk_destroyed: number
    isk_lost: number
  }>(`
    SELECT
      countIf(attacker_alliance_id = {allianceId:UInt32}) as kills,
      countIf(victim_alliance_id = {allianceId:UInt32}) as losses,
      sumIf(total_value, attacker_alliance_id = {allianceId:UInt32}) as isk_destroyed,
      sumIf(total_value, victim_alliance_id = {allianceId:UInt32}) as isk_lost
    FROM entity_killlist
    WHERE attacker_alliance_id = {allianceId:UInt32} OR victim_alliance_id = {allianceId:UInt32}
  `, { allianceId })

  if (!result) {
    return {
      kills: 0,
      losses: 0,
      killLossRatio: 0,
      iskDestroyed: 0,
      iskLost: 0,
      iskEfficiency: 0,
      efficiency: 0
    }
  }

  const { kills, losses, isk_destroyed, isk_lost } = result
  const totalISK = (isk_destroyed || 0) + (isk_lost || 0)
  const totalKills = kills + losses

  return {
    kills: kills || 0,
    losses: losses || 0,
    killLossRatio: losses > 0 ? kills / losses : kills,
    iskDestroyed: isk_destroyed || 0,
    iskLost: isk_lost || 0,
    iskEfficiency: totalISK > 0 ? ((isk_destroyed || 0) / totalISK) * 100 : 0,
    efficiency: totalKills > 0 ? (kills / totalKills) * 100 : 0
  }
}


/**
 * Get top 10 corporations killed by an alliance
 */
export async function getTopCorporationsKilledByAlliance(
  allianceId: number,
  days: number = 30
): Promise<TopBoxItem[]> {
  const cutoffTimestamp = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)

  const result = await database.query<{
    corp_id: number
    corp_name: string
    total: number
    kills: number
    losses: number
  }>(`
    SELECT
      victim_corporation_id as corp_id,
      victim_corporation_name as corp_name,
      count() as total,
      countIf(victim_alliance_id = {allianceId:UInt32}) as kills,
      countIf(victim_alliance_id != {allianceId:UInt32}) as losses
    FROM entity_killlist
    WHERE (attacker_alliance_id = {allianceId:UInt32})
    AND killmail_time >= toDateTime({cutoffTimestamp:UInt32})
    GROUP BY victim_corporation_id, victim_corporation_name
    ORDER BY total DESC
    LIMIT 10
  `, { allianceId, cutoffTimestamp })

  return result.map(r => ({
    id: r.corp_id,
    name: r.corp_name,
    count: r.total,
    kills: r.kills,
    losses: r.losses
  }))
}

/**
 * Get top 10 alliances killed by an alliance
 */
export async function getTopAlliancesKilledByAlliance(
  allianceId: number,
  days: number = 30
): Promise<TopBoxItem[]> {
  const cutoffTimestamp = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)

  const result = await database.query<{
    alliance_id: number | null
    alliance_name: string
    total: number
    kills: number
    losses: number
  }>(`
    SELECT
      victim_alliance_id as alliance_id,
      victim_alliance_name as alliance_name,
      count() as total,
      countIf(victim_alliance_id = {allianceId:UInt32}) as kills,
      countIf(victim_alliance_id != {allianceId:UInt32}) as losses
    FROM entity_killlist
    WHERE (attacker_alliance_id = {allianceId:UInt32})
    AND victim_alliance_id IS NOT NULL
    AND killmail_time >= toDateTime({cutoffTimestamp:UInt32})
    GROUP BY victim_alliance_id, victim_alliance_name
    ORDER BY total DESC
    LIMIT 10
  `, { allianceId, cutoffTimestamp })

  return result
    .filter(r => r.alliance_id !== null)
    .map(r => ({
      id: r.alliance_id!,
      name: r.alliance_name,
      count: r.total,
      kills: r.kills,
      losses: r.losses
    }))
}

/**
 * Get most valuable kills for an alliance (as attacker)
 */
export async function getMostValuableKillsByAllianceNew(
  allianceId: number,
  limit: number = 6,
  days: number = 7
): Promise<MostValuableKill[]> {
  const cutoffTimestamp = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)

  const result = await database.query<MostValuableKill>(`
    SELECT
      killmail_id,
      killmail_time,
      victim_ship_name,
      victim_ship_type_id,
      victim_character_name,
      victim_corporation_name,
      victim_corporation_ticker,
      victim_alliance_name,
      victim_alliance_ticker,
      solar_system_name,
      region_name,
      total_value,
      attacker_count
    FROM entity_killlist
    WHERE attacker_alliance_id = {allianceId:UInt32}
    AND killmail_time >= toDateTime({cutoffTimestamp:UInt32})
    ORDER BY total_value DESC
    LIMIT {limit:UInt32}
  `, { allianceId, cutoffTimestamp, limit })

  return result
}

/**
 * Get top 10 systems for a corporation (as attacker/killer)
 */
export async function getTopSystemsByCorporation(
  corporationId: number,
  days: number = 30
): Promise<TopBoxItem[]> {
  const cutoffTimestamp = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)

  const result = await database.query<{
    system_id: number
    system_name: string
    total: number
    kills: number
    losses: number
  }>(`
    SELECT
      solar_system_id as system_id,
      solar_system_name as system_name,
      count() as total,
      countIf(victim_corporation_id = {corporationId:UInt32}) as kills,
      countIf(victim_corporation_id != {corporationId:UInt32}) as losses
    FROM entity_killlist
    WHERE (attacker_corporation_id = {corporationId:UInt32})
    AND killmail_time >= toDateTime({cutoffTimestamp:UInt32})
    GROUP BY solar_system_id, solar_system_name
    ORDER BY total DESC
    LIMIT 10
  `, { corporationId, cutoffTimestamp })

  return result.map(r => ({
    id: r.system_id,
    name: r.system_name,
    count: r.total,
    kills: r.kills,
    losses: r.losses
  }))
}

/**
 * Get top 10 regions for a corporation (as attacker/killer)
 */
export async function getTopRegionsByCorporation(
  corporationId: number,
  days: number = 30
): Promise<TopBoxItem[]> {
  const cutoffTimestamp = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)

  const result = await database.query<{
    region_id: number
    region_name: string
    total: number
    kills: number
    losses: number
  }>(`
    SELECT
      region_id,
      region_name,
      count() as total,
      countIf(victim_corporation_id = {corporationId:UInt32}) as kills,
      countIf(victim_corporation_id != {corporationId:UInt32}) as losses
    FROM entity_killlist
    WHERE (attacker_corporation_id = {corporationId:UInt32})
    AND killmail_time >= toDateTime({cutoffTimestamp:UInt32})
    GROUP BY region_id, region_name
    ORDER BY total DESC
    LIMIT 10
  `, { corporationId, cutoffTimestamp })

  return result.map(r => ({
    id: r.region_id,
    name: r.region_name,
    count: r.total,
    kills: r.kills,
    losses: r.losses
  }))
}

/**
 * Get top 10 systems for an alliance (as attacker/killer)
 */
export async function getTopSystemsByAlliance(
  allianceId: number,
  days: number = 30
): Promise<TopBoxItem[]> {
  const cutoffTimestamp = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)

  const result = await database.query<{
    system_id: number
    system_name: string
    total: number
    kills: number
    losses: number
  }>(`
    SELECT
      solar_system_id as system_id,
      solar_system_name as system_name,
      count() as total,
      countIf(victim_alliance_id = {allianceId:UInt32}) as kills,
      countIf(victim_alliance_id != {allianceId:UInt32}) as losses
    FROM entity_killlist
    WHERE (attacker_alliance_id = {allianceId:UInt32})
    AND killmail_time >= toDateTime({cutoffTimestamp:UInt32})
    GROUP BY solar_system_id, solar_system_name
    ORDER BY total DESC
    LIMIT 10
  `, { allianceId, cutoffTimestamp })

  return result.map(r => ({
    id: r.system_id,
    name: r.system_name,
    count: r.total,
    kills: r.kills,
    losses: r.losses
  }))
}

/**
 * Get top 10 regions for an alliance (as attacker/killer)
 */
export async function getTopRegionsByAlliance(
  allianceId: number,
  days: number = 30
): Promise<TopBoxItem[]> {
  const cutoffTimestamp = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)

  const result = await database.query<{
    region_id: number
    region_name: string
    total: number
    kills: number
    losses: number
  }>(`
    SELECT
      region_id,
      region_name,
      count() as total,
      countIf(victim_alliance_id = {allianceId:UInt32}) as kills,
      countIf(victim_alliance_id != {allianceId:UInt32}) as losses
    FROM entity_killlist
    WHERE (attacker_alliance_id = {allianceId:UInt32})
    AND killmail_time >= toDateTime({cutoffTimestamp:UInt32})
    GROUP BY region_id, region_name
    ORDER BY total DESC
    LIMIT 10
  `, { allianceId, cutoffTimestamp })

  return result.map(r => ({
    id: r.region_id,
    name: r.region_name,
    count: r.total,
    kills: r.kills,
    losses: r.losses
  }))
}


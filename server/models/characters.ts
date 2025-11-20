/**
 * Character Model
 * Handles character-related data queries
 */
import { database } from '../helpers/database'

export interface CharacterInfo {
  id: number
  name: string
  corporation: {
    id: number
    name: string
    ticker: string
  } | null
  alliance: {
    id: number
    name: string
    ticker: string
  } | null
  stats: {
    kills: number
    losses: number
    killLossRatio: number
    efficiency: number
    iskDestroyed: number
    iskLost: number
    iskEfficiency: number
  }
}

/**
 * Get character information with statistics
 */
export async function getCharacterInfo(characterId: number): Promise<CharacterInfo | null> {
  // First get character name from characters table
  const character = await database.queryOne<{
    name: string
  }>(`
    SELECT name
    FROM characters
    WHERE characterId = {characterId:UInt32}
    LIMIT 1
  `, { characterId })

  if (!character || !character.name) {
    return null
  }

  // Get latest corporation/alliance info from most recent killmail activity
  const corpAllianceQuery = await database.queryOne<{
    corporationId: number | null
    corporationName: string | null
    corporationTicker: string | null
    allianceId: number | null
    allianceName: string | null
    allianceTicker: string | null
  }>(`
    SELECT
      anyLast(corporationId) as corporationId,
      anyLast(corporationName) as corporationName,
      anyLast(corporationTicker) as corporationTicker,
      anyLast(allianceId) as allianceId,
      anyLast(allianceName) as allianceName,
      anyLast(allianceTicker) as allianceTicker
    FROM (
      SELECT
        a.corporationId as corporationId,
        corp.name as corporationName,
        corp.ticker as corporationTicker,
        a.allianceId as allianceId,
        alliance.ticker as allianceName,
        alliance.ticker as allianceTicker,
        k.killmailTime as lastSeen
      FROM attackers a
      FINAL
      LEFT JOIN killmails k FINAL ON a.killmailId = k.killmailId
      LEFT JOIN corporations corp FINAL ON a.corporationId = corp.corporationId
      LEFT JOIN corporations alliance FINAL ON a.allianceId = alliance.corporationId
      WHERE a.characterId = {characterId:UInt32}

      UNION ALL

      SELECT
        k.victimCorporationId as corporationId,
        corp.name as corporationName,
        corp.ticker as corporationTicker,
        k.victimAllianceId as allianceId,
        alliance.name as allianceName,
        alliance.ticker as allianceTicker,
        k.killmailTime as lastSeen
      FROM killmails k
      FINAL
      LEFT JOIN corporations corp FINAL ON k.victimCorporationId = corp.corporationId
      LEFT JOIN corporations alliance FINAL ON k.victimAllianceId = alliance.corporationId
      WHERE k.victimCharacterId = {characterId:UInt32}

      ORDER BY lastSeen DESC
      LIMIT 100
    )
  `, { characterId })

  // Build corporation object
  let corporation: CharacterInfo['corporation'] = null
  if (corpAllianceQuery?.corporationId) {
    corporation = {
      id: corpAllianceQuery.corporationId,
      name: corpAllianceQuery.corporationName || `Corp ${corpAllianceQuery.corporationId}`,
      ticker: corpAllianceQuery.corporationTicker || '???'
    }
  }

  // Build alliance object
  let alliance: CharacterInfo['alliance'] = null
  if (corpAllianceQuery?.allianceId) {
    alliance = {
      id: corpAllianceQuery.allianceId,
      name: corpAllianceQuery.allianceName || `Alliance ${corpAllianceQuery.allianceId}`,
      ticker: corpAllianceQuery.allianceTicker || '???'
    }
  }

  // Get statistics
  const stats = await database.queryOne<{
    kills: number
    losses: number
    iskDestroyed: number
    iskLost: number
  }>(`
    WITH
      kills_stats AS (
        SELECT
          count() as kills,
          sum(k.victimDamageTaken * COALESCE(p.averagePrice, 0)) +
          sum(i.totalValue) as iskDestroyed
        FROM attackers a
        FINAL
        LEFT JOIN killmails k FINAL ON a.killmailId = k.killmailId
        LEFT JOIN prices p ON k.victimShipTypeId = p.typeId AND toDate(k.killmailTime) = p.priceDate
        LEFT JOIN (
          SELECT
            items.killmailId as killmailId,
            sum((quantityDestroyed + quantityDropped) * COALESCE(prices.averagePrice, 0)) as totalValue
          FROM items
          FINAL
          LEFT JOIN killmails km FINAL ON items.killmailId = km.killmailId
          LEFT JOIN prices ON items.itemTypeId = prices.typeId AND toDate(km.killmailTime) = prices.priceDate
          GROUP BY items.killmailId
        ) i ON k.killmailId = i.killmailId
        WHERE a.characterId = {characterId:UInt32}
      ),
      losses_stats AS (
        SELECT
          count() as losses,
          sum(k.victimDamageTaken * COALESCE(p.averagePrice, 0)) +
          sum(i.totalValue) as iskLost
        FROM killmails k
        FINAL
        LEFT JOIN prices p ON k.victimShipTypeId = p.typeId AND toDate(k.killmailTime) = p.priceDate
        LEFT JOIN (
          SELECT
            items.killmailId as killmailId,
            sum((quantityDestroyed + quantityDropped) * COALESCE(prices.averagePrice, 0)) as totalValue
          FROM items
          FINAL
          LEFT JOIN killmails km FINAL ON items.killmailId = km.killmailId
          LEFT JOIN prices ON items.itemTypeId = prices.typeId AND toDate(km.killmailTime) = prices.priceDate
          GROUP BY items.killmailId
        ) i ON k.killmailId = i.killmailId
        WHERE k.victimCharacterId = {characterId:UInt32}
      )
    SELECT
      kills_stats.kills as kills,
      losses_stats.losses as losses,
      kills_stats.iskDestroyed as iskDestroyed,
      losses_stats.iskLost as iskLost
    FROM kills_stats, losses_stats
  `, { characterId })

  const kills = stats?.kills || 0
  const losses = stats?.losses || 0
  const iskDestroyed = stats?.iskDestroyed || 0
  const iskLost = stats?.iskLost || 0
  const killLossRatio = losses > 0 ? kills / losses : kills
  const efficiency = (iskDestroyed + iskLost) > 0 ? (iskDestroyed / (iskDestroyed + iskLost)) * 100 : 0
  const iskEfficiency = (iskDestroyed + iskLost) > 0 ? (iskDestroyed / (iskDestroyed + iskLost)) * 100 : 0

  return {
    id: characterId,
    name: character.name,
    corporation,
    alliance,
    stats: {
      kills,
      losses,
      killLossRatio,
      efficiency,
      iskDestroyed,
      iskLost,
      iskEfficiency
    }
  }
}

export interface ShipGroupStats {
  groupId: number
  groupName: string
  killed: number
  lost: number
}

/**
 * Get ship group statistics for a character (last 30 days)
 */
export async function getShipGroupStatsByCharacter(characterId: number): Promise<ShipGroupStats[]> {
  const stats = await database.query<ShipGroupStats>(`
    WITH
      killed_stats AS (
        SELECT
          g.groupId as groupId,
          g.name as groupName,
          count() as killed
        FROM attackers a
        FINAL
        LEFT JOIN killmails k FINAL ON a.killmailId = k.killmailId
        LEFT JOIN types t ON k.victimShipTypeId = t.typeId
        LEFT JOIN groups g ON t.groupId = g.groupId
        WHERE a.characterId = {characterId:UInt32}
          AND k.killmailTime >= now() - INTERVAL 30 DAY
          AND g.groupId IS NOT NULL
        GROUP BY g.groupId, g.name
      ),
      lost_stats AS (
        SELECT
          g.groupId as groupId,
          g.name as groupName,
          count() as lost
        FROM killmails k
        FINAL
        LEFT JOIN types t ON k.victimShipTypeId = t.typeId
        LEFT JOIN groups g ON t.groupId = g.groupId
        WHERE k.victimCharacterId = {characterId:UInt32}
          AND k.killmailTime >= now() - INTERVAL 30 DAY
          AND g.groupId IS NOT NULL
        GROUP BY g.groupId, g.name
      )
    SELECT
      coalesce(killed_stats.groupId, lost_stats.groupId) as groupId,
      coalesce(killed_stats.groupName, lost_stats.groupName) as groupName,
      coalesce(killed_stats.killed, 0) as killed,
      coalesce(lost_stats.lost, 0) as lost
    FROM killed_stats
    FULL OUTER JOIN lost_stats ON killed_stats.groupId = lost_stats.groupId
    ORDER BY (killed + lost) DESC
    LIMIT 100
  `, { characterId })

  return stats
}

export interface CharacterTopEntity {
  id: number
  name: string
  kills: number
}

export interface CharacterTopBoxStats {
  ships: CharacterTopEntity[]
  systems: CharacterTopEntity[]
  regions: CharacterTopEntity[]
  corporations: CharacterTopEntity[]
  alliances: CharacterTopEntity[]
}

/**
 * Get top 10 stats for a character (last 7 days)
 * Shows: ships, systems, regions, corporations, alliances (excludes characters)
 */
export async function getTop10StatsByCharacter(characterId: number): Promise<CharacterTopBoxStats> {
  // Top ships killed
  const ships = await database.query<CharacterTopEntity>(`
    SELECT
      t.typeId as id,
      t.name as name,
      count() as kills
    FROM attackers a
    FINAL
    LEFT JOIN killmails k FINAL ON a.killmailId = k.killmailId
    LEFT JOIN types t ON k.victimShipTypeId = t.typeId
    WHERE a.characterId = {characterId:UInt32}
      AND k.killmailTime >= now() - INTERVAL 7 DAY
      AND t.typeId IS NOT NULL
    GROUP BY t.typeId, t.name
    ORDER BY kills DESC
    LIMIT 10
  `, { characterId })

  // Top systems
  const systems = await database.query<CharacterTopEntity>(`
    SELECT
      sys.solarSystemId as id,
      sys.name as name,
      count() as kills
    FROM attackers a
    FINAL
    LEFT JOIN killmails k FINAL ON a.killmailId = k.killmailId
    LEFT JOIN mapSolarSystems sys ON k.solarSystemId = sys.solarSystemId
    WHERE a.characterId = {characterId:UInt32}
      AND k.killmailTime >= now() - INTERVAL 7 DAY
      AND sys.solarSystemId IS NOT NULL
    GROUP BY sys.solarSystemId, sys.name
    ORDER BY kills DESC
    LIMIT 10
  `, { characterId })

  // Top regions
  const regions = await database.query<CharacterTopEntity>(`
    SELECT
      reg.regionId as id,
      reg.name as name,
      count() as kills
    FROM attackers a
    FINAL
    LEFT JOIN killmails k FINAL ON a.killmailId = k.killmailId
    LEFT JOIN mapSolarSystems sys ON k.solarSystemId = sys.solarSystemId
    LEFT JOIN mapRegions reg ON sys.regionId = reg.regionId
    WHERE a.characterId = {characterId:UInt32}
      AND k.killmailTime >= now() - INTERVAL 7 DAY
      AND reg.regionId IS NOT NULL
    GROUP BY reg.regionId, reg.name
    ORDER BY kills DESC
    LIMIT 10
  `, { characterId })

  // Top corporations killed
  const corporations = await database.query<CharacterTopEntity>(`
    SELECT
      corp.corporationId as id,
      corp.name as name,
      count() as kills
    FROM attackers a
    FINAL
    LEFT JOIN killmails k FINAL ON a.killmailId = k.killmailId
    LEFT JOIN npcCorporations corp ON k.victimCorporationId = corp.corporationId
    WHERE a.characterId = {characterId:UInt32}
      AND k.killmailTime >= now() - INTERVAL 7 DAY
      AND corp.corporationId IS NOT NULL
    GROUP BY corp.corporationId, corp.name
    ORDER BY kills DESC
    LIMIT 10
  `, { characterId })

  // Top alliances killed
  const alliances = await database.query<CharacterTopEntity>(`
    SELECT
      alliance.corporationId as id,
      alliance.name as name,
      count() as kills
    FROM attackers a
    FINAL
    LEFT JOIN killmails k FINAL ON a.killmailId = k.killmailId
    LEFT JOIN npcCorporations alliance ON k.victimAllianceId = alliance.corporationId
    WHERE a.characterId = {characterId:UInt32}
      AND k.killmailTime >= now() - INTERVAL 7 DAY
      AND alliance.corporationId IS NOT NULL
      AND k.victimAllianceId IS NOT NULL
    GROUP BY alliance.corporationId, alliance.name
    ORDER BY kills DESC
    LIMIT 10
  `, { characterId })

  return {
    ships,
    systems,
    regions,
    corporations,
    alliances
  }
}

export interface CharacterKillmailRow {
  killmail_id: number
  killmail_time: Date
  victim_ship_type_id: number
  victim_ship_name: string
  victim_ship_group: string
  victim_characterId: number | null
  victim_character_name: string
  victim_corporationId: number
  victim_corporation_name: string
  victim_corporation_ticker: string
  victim_allianceId: number | null
  victim_alliance_name: string | null
  victim_alliance_ticker: string | null
  attacker_characterId: number | null
  attacker_character_name: string
  attacker_corporationId: number | null
  attacker_corporation_name: string
  attacker_corporation_ticker: string
  attacker_allianceId: number | null
  attacker_alliance_name: string | null
  attacker_alliance_ticker: string | null
  solar_system_id: number
  solar_system_name: string
  solar_system_security: number
  region_id: number
  region_name: string
  ship_value: number
  total_value: number
  attacker_count: number
}

/**
 * Get killmails for a character
 * @param characterId Character ID
 * @param limit Number of killmails to return
 * @param offset Offset for pagination
 * @param type Filter by 'all', 'kills', or 'losses'
 */
export async function getCharacterKillmails(
  characterId: number,
  limit: number = 30,
  offset: number = 0,
  type: 'all' | 'kills' | 'losses' = 'all'
): Promise<CharacterKillmailRow[]> {
  let whereClause = ''
  if (type === 'kills') {
    // Character was an attacker (check attackers table)
    whereClause = `
      AND killmail_id IN (
        SELECT killmailId
        FROM attackers
        FINAL
        WHERE characterId = {characterId:UInt32}
      )
    `
  } else if (type === 'losses') {
    // Character was the victim
    whereClause = `AND victim_characterId = {characterId:UInt32}`
  } else {
    // All: either attacker or victim
    whereClause = `
      AND (
        victim_characterId = {characterId:UInt32}
        OR killmail_id IN (
          SELECT killmailId
          FROM attackers
          FINAL
          WHERE characterId = {characterId:UInt32}
        )
      )
    `
  }

  const sql = `
    SELECT
      killmail_id,
      killmail_time,
      victim_ship_type_id,
      victim_ship_name,
      victim_ship_group,
      victim_characterId,
      victim_character_name,
      victim_corporationId,
      victim_corporation_name,
      victim_corporation_ticker,
      victim_allianceId,
      victim_alliance_name,
      victim_alliance_ticker,
      attacker_characterId,
      attacker_character_name,
      attacker_corporationId,
      attacker_corporation_name,
      attacker_corporation_ticker,
      attacker_allianceId,
      attacker_alliance_name,
      attacker_alliance_ticker,
      solar_system_id,
      solar_system_name,
      solar_system_security,
      region_id,
      region_name,
      ship_value,
      total_value,
      attacker_count
    FROM killlist_frontpage
    WHERE 1=1
      ${whereClause}
    ORDER BY killmail_time DESC
    LIMIT {limit:UInt32} OFFSET {offset:UInt32}
  `

  return await database.query<CharacterKillmailRow>(sql, {
    characterId,
    limit,
    offset
  })
}

/**
 * Count killmails for a character
 * @param characterId Character ID
 * @param type Filter by 'all', 'kills', or 'losses'
 */
export async function getCharacterKillmailCount(
  characterId: number,
  type: 'all' | 'kills' | 'losses' = 'all'
): Promise<number> {
  let whereClause = ''
  if (type === 'kills') {
    whereClause = `
      AND killmail_id IN (
        SELECT killmailId
        FROM attackers
        FINAL
        WHERE characterId = {characterId:UInt32}
      )
    `
  } else if (type === 'losses') {
    whereClause = `AND victim_characterId = {characterId:UInt32}`
  } else {
    whereClause = `
      AND (
        victim_characterId = {characterId:UInt32}
        OR killmail_id IN (
          SELECT killmailId
          FROM attackers
          FINAL
          WHERE characterId = {characterId:UInt32}
        )
      )
    `
  }

  const sql = `
    SELECT count() as count
    FROM killlist_frontpage
    WHERE 1=1
      ${whereClause}
  `

  const result = await database.queryValue<number>(sql, { characterId })
  return result || 0
}

/**
 * Character database record interface
 */
export interface Character {
  characterId: number
  allianceId: number | null
  birthday: string
  bloodlineId: number
  corporationId: number
  description: string
  gender: string
  name: string
  raceId: number
  securityStatus: number
  updatedAt: Date
  version: number
}

/**
 * Get character by ID (basic record)
 */
export async function getCharacter(characterId: number): Promise<Character | null> {
  return await database.queryOne<Character>(
    'SELECT * FROM characters FINAL WHERE characterId = {id:UInt32}',
    { id: characterId }
  )
}

/**
 * Get multiple characters by IDs
 */
export async function getCharacters(characterIds: number[]): Promise<Character[]> {
  if (characterIds.length === 0) return []

  return await database.query<Character>(
    'SELECT * FROM characters FINAL WHERE characterId IN ({ids:Array(UInt32)})',
    { ids: characterIds }
  )
}

/**
 * Search characters by name
 */
export async function searchCharacters(searchTerm: string, limit: number = 20): Promise<Character[]> {
  return await database.query<Character>(
    `SELECT * FROM characters FINAL
     WHERE name ILIKE {search:String}
     ORDER BY name
     LIMIT {limit:UInt32}`,
    { search: `%${searchTerm}%`, limit }
  )
}

/**
 * Get character name by ID
 */
export async function getCharacterName(characterId: number): Promise<string | null> {
  const name = await database.queryValue<string>(
    'SELECT name FROM characters FINAL WHERE characterId = {id:UInt32}',
    { id: characterId }
  )
  return name || null
}

/**
 * Character with corporation and alliance info
 */
export interface CharacterWithCorporationAndAlliance {
  name: string
  corporationId: number
  corporationName: string
  corporationTicker: string
  allianceId: number | null
  allianceName: string | null
  allianceTicker: string | null
}

/**
 * Get character with joined corporation and alliance data
 */
export async function getCharacterWithCorporationAndAlliance(
  characterId: number
): Promise<CharacterWithCorporationAndAlliance | null> {
  return await database.queryOne<CharacterWithCorporationAndAlliance>(
    `SELECT
      c.name as name,
      c.corporationId as corporationId,
      corp.name as corporationName,
      corp.ticker as corporationTicker,
      corp.allianceId as allianceId,
      alliance.name as allianceName,
      alliance.ticker as allianceTicker
    FROM characters c FINAL
    LEFT JOIN corporations corp FINAL ON c.corporationId = corp.corporationId
    LEFT JOIN alliances alliance FINAL ON corp.allianceId = alliance.allianceId
    WHERE c.characterId = {characterId:UInt32}
    LIMIT 1`,
    { characterId }
  )
}

/**
 * Store or update character data
 */
export async function storeCharacter(
  characterId: number,
  data: {
    allianceId: number | null
    birthday: string
    bloodlineId: number
    corporationId: number
    description: string
    gender: string
    name: string
    raceId: number
    securityStatus: number
  }
): Promise<void> {
  const now = Math.floor(Date.now() / 1000)

  await database.bulkInsert('characters', [
    {
      characterId: characterId,
      allianceId: data.allianceId,
      birthday: data.birthday,
      bloodline_id: data.bloodlineId,
      corporationId: data.corporationId,
      description: data.description,
      gender: data.gender,
      name: data.name,
      race_id: data.raceId,
      security_status: data.securityStatus,
      updated_at: now,
      version: now
    }
  ])
}

/**
 * Bulk store character data (for backfill/import)
 */
export async function storeCharactersBulk(
  characters: Array<{
    characterId: number
    allianceId: number | null
    birthday: string
    bloodlineId: number
    corporationId: number
    description: string
    gender: string
    name: string
    raceId: number
    securityStatus: number
  }>
): Promise<void> {
  if (characters.length === 0) return

  const now = Math.floor(Date.now() / 1000)

  const records = characters.map(char => ({
    characterId: char.characterId,
    allianceId: char.allianceId,
    birthday: char.birthday,
    bloodlineId: char.bloodlineId,
    corporationId: char.corporationId,
    description: char.description,
    gender: char.gender,
    name: char.name,
    raceId: char.raceId,
    securityStatus: char.securityStatus,
    updatedAt: now,
    version: now
  }))

  await database.bulkInsert('characters', records)
}

/**
 * Check if character exists
 */
export async function characterExists(characterId: number): Promise<boolean> {
  const count = await database.count('characters', 'characterId = {id:UInt32}', { id: characterId })
  return count > 0
}

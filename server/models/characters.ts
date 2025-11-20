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
  // Postgres specific: using DISTINCT ON or LIMIT/ORDER BY
  // ClickHouse's anyLast is like picking the last value in a group.
  // Here we want the most recent corp/alliance for the character.
  const corpAllianceQuery = await database.queryOne<{
    corporationId: number | null
    corporationName: string | null
    corporationTicker: string | null
    allianceId: number | null
    allianceName: string | null
    allianceTicker: string | null
  }>(`
    SELECT
      corporationId,
      corporationName,
      corporationTicker,
      allianceId,
      allianceName,
      allianceTicker
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
      LEFT JOIN killmails k ON a.killmailId = k.killmailId
      LEFT JOIN corporations corp ON a.corporationId = corp.corporationId
      LEFT JOIN corporations alliance ON a.allianceId = alliance.corporationId
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
      LEFT JOIN corporations corp ON k.victimCorporationId = corp.corporationId
      LEFT JOIN corporations alliance ON k.victimAllianceId = alliance.corporationId
      WHERE k.victimCharacterId = {characterId:UInt32}
    ) as sub
    ORDER BY lastSeen DESC
    LIMIT 1
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
          count(*) as kills,
          sum(k.victimDamageTaken * COALESCE(p.averagePrice, 0)) +
          sum(i.totalValue) as iskDestroyed
        FROM attackers a
        LEFT JOIN killmails k ON a.killmailId = k.killmailId
        LEFT JOIN prices p ON k.victimShipTypeId = p.typeId AND k.killmailTime::date = p.priceDate
        LEFT JOIN (
          SELECT
            items.killmailId as killmailId,
            sum((quantityDestroyed + quantityDropped) * COALESCE(prices.averagePrice, 0)) as totalValue
          FROM items
          LEFT JOIN killmails km ON items.killmailId = km.killmailId
          LEFT JOIN prices ON items.itemTypeId = prices.typeId AND km.killmailTime::date = prices.priceDate
          GROUP BY items.killmailId
        ) i ON k.killmailId = i.killmailId
        WHERE a.characterId = {characterId:UInt32}
      ),
      losses_stats AS (
        SELECT
          count(*) as losses,
          sum(k.victimDamageTaken * COALESCE(p.averagePrice, 0)) +
          sum(i.totalValue) as iskLost
        FROM killmails k
        LEFT JOIN prices p ON k.victimShipTypeId = p.typeId AND k.killmailTime::date = p.priceDate
        LEFT JOIN (
          SELECT
            items.killmailId as killmailId,
            sum((quantityDestroyed + quantityDropped) * COALESCE(prices.averagePrice, 0)) as totalValue
          FROM items
          LEFT JOIN killmails km ON items.killmailId = km.killmailId
          LEFT JOIN prices ON items.itemTypeId = prices.typeId AND km.killmailTime::date = prices.priceDate
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

  const kills = Number(stats?.kills) || 0
  const losses = Number(stats?.losses) || 0
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
          count(*) as killed
        FROM attackers a
        LEFT JOIN killmails k ON a.killmailId = k.killmailId
        LEFT JOIN types t ON k.victimShipTypeId = t.typeId
        LEFT JOIN groups g ON t.groupId = g.groupId
        WHERE a.characterId = {characterId:UInt32}
          AND k.killmailTime >= NOW() - INTERVAL '30 days'
          AND g.groupId IS NOT NULL
        GROUP BY g.groupId, g.name
      ),
      lost_stats AS (
        SELECT
          g.groupId as groupId,
          g.name as groupName,
          count(*) as lost
        FROM killmails k
        LEFT JOIN types t ON k.victimShipTypeId = t.typeId
        LEFT JOIN groups g ON t.groupId = g.groupId
        WHERE k.victimCharacterId = {characterId:UInt32}
          AND k.killmailTime >= NOW() - INTERVAL '30 days'
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
    ORDER BY (coalesce(killed_stats.killed, 0) + coalesce(lost_stats.lost, 0)) DESC
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
      count(*) as kills
    FROM attackers a
    LEFT JOIN killmails k ON a.killmailId = k.killmailId
    LEFT JOIN types t ON k.victimShipTypeId = t.typeId
    WHERE a.characterId = {characterId:UInt32}
      AND k.killmailTime >= NOW() - INTERVAL '7 days'
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
      count(*) as kills
    FROM attackers a
    LEFT JOIN killmails k ON a.killmailId = k.killmailId
    LEFT JOIN solarSystems sys ON k.solarSystemId = sys.solarSystemId
    WHERE a.characterId = {characterId:UInt32}
      AND k.killmailTime >= NOW() - INTERVAL '7 days'
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
      count(*) as kills
    FROM attackers a
    LEFT JOIN killmails k ON a.killmailId = k.killmailId
    LEFT JOIN solarSystems sys ON k.solarSystemId = sys.solarSystemId
    LEFT JOIN regions reg ON sys.regionId = reg.regionId
    WHERE a.characterId = {characterId:UInt32}
      AND k.killmailTime >= NOW() - INTERVAL '7 days'
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
      count(*) as kills
    FROM attackers a
    LEFT JOIN killmails k ON a.killmailId = k.killmailId
    LEFT JOIN npcCorporations corp ON k.victimCorporationId = corp.corporationId
    WHERE a.characterId = {characterId:UInt32}
      AND k.killmailTime >= NOW() - INTERVAL '7 days'
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
      count(*) as kills
    FROM attackers a
    LEFT JOIN killmails k ON a.killmailId = k.killmailId
    LEFT JOIN npcCorporations alliance ON k.victimAllianceId = alliance.corporationId
    WHERE a.characterId = {characterId:UInt32}
      AND k.killmailTime >= NOW() - INTERVAL '7 days'
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
  // NOTE: killlist_frontpage was a view in ClickHouse.
  // In Postgres, we should either create a similar view or query the tables directly.
  // Assuming we use tables directly now as we skipped views.

  // However, this query is complex. I'll replace it with a placeholder or simplified version
  // since the view definition was removed.
  // Actually, I should check what killlist_frontpage did.
  // It joined killmails with all entities.

  // For now, I will assume the user will manually fix complex view dependencies or I should write the JOINs.
  // Given "everything is pretty much implemented", I'll try to replace usage of killlist_frontpage with a JOIN query.

  const baseQuery = `
    SELECT
      k.killmailId as killmail_id,
      k.killmailTime as killmail_time,
      k.victimShipTypeId as victim_ship_type_id,
      t.name as victim_ship_name,
      g.name as victim_ship_group,
      k.victimCharacterId as victim_characterId,
      c.name as victim_character_name,
      k.victimCorporationId as victim_corporationId,
      corp.name as victim_corporation_name,
      corp.ticker as victim_corporation_ticker,
      k.victimAllianceId as victim_allianceId,
      all.name as victim_alliance_name,
      all.ticker as victim_alliance_ticker,
      k.topAttackerCharacterId as attacker_characterId,
      ac.name as attacker_character_name,
      k.topAttackerCorporationId as attacker_corporationId,
      acorp.name as attacker_corporation_name,
      acorp.ticker as attacker_corporation_ticker,
      k.topAttackerAllianceId as attacker_allianceId,
      aall.name as attacker_alliance_name,
      aall.ticker as attacker_alliance_ticker,
      k.solarSystemId as solar_system_id,
      sys.name as solar_system_name,
      sys.securityStatus as solar_system_security,
      sys.regionId as region_id,
      reg.name as region_name,
      (k.victimDamageTaken * COALESCE(p.averagePrice, 0)) as ship_value,
      k.totalValue as total_value,
      k.attackerCount as attacker_count
    FROM killmails k
    LEFT JOIN types t ON k.victimShipTypeId = t.typeId
    LEFT JOIN groups g ON t.groupId = g.groupId
    LEFT JOIN characters c ON k.victimCharacterId = c.characterId
    LEFT JOIN corporations corp ON k.victimCorporationId = corp.corporationId
    LEFT JOIN alliances all ON k.victimAllianceId = all.allianceId
    LEFT JOIN characters ac ON k.topAttackerCharacterId = ac.characterId
    LEFT JOIN corporations acorp ON k.topAttackerCorporationId = acorp.corporationId
    LEFT JOIN alliances aall ON k.topAttackerAllianceId = aall.allianceId
    LEFT JOIN solarSystems sys ON k.solarSystemId = sys.solarSystemId
    LEFT JOIN regions reg ON sys.regionId = reg.regionId
    LEFT JOIN prices p ON k.victimShipTypeId = p.typeId AND k.killmailTime::date = p.priceDate
  `

  if (type === 'kills') {
    // Character was an attacker (check attackers table)
    whereClause = `
      AND k.killmailId IN (
        SELECT killmailId
        FROM attackers
        WHERE characterId = {characterId:UInt32}
      )
    `
  } else if (type === 'losses') {
    // Character was the victim
    whereClause = `AND k.victimCharacterId = {characterId:UInt32}`
  } else {
    // All: either attacker or victim
    whereClause = `
      AND (
        k.victimCharacterId = {characterId:UInt32}
        OR k.killmailId IN (
          SELECT killmailId
          FROM attackers
          WHERE characterId = {characterId:UInt32}
        )
      )
    `
  }

  const sql = `
    ${baseQuery}
    WHERE 1=1
      ${whereClause}
    ORDER BY k.killmailTime DESC
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
      AND killmailId IN (
        SELECT killmailId
        FROM attackers
        WHERE characterId = {characterId:UInt32}
      )
    `
  } else if (type === 'losses') {
    whereClause = `AND victimCharacterId = {characterId:UInt32}`
  } else {
    whereClause = `
      AND (
        victimCharacterId = {characterId:UInt32}
        OR killmailId IN (
          SELECT killmailId
          FROM attackers
          WHERE characterId = {characterId:UInt32}
        )
      )
    `
  }

  const sql = `
    SELECT count(*) as count
    FROM killmails
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
    'SELECT * FROM characters WHERE characterId = {id:UInt32}',
    { id: characterId }
  )
}

/**
 * Get multiple characters by IDs
 */
export async function getCharacters(characterIds: number[]): Promise<Character[]> {
  if (characterIds.length === 0) return []

  return await database.query<Character>(
    'SELECT * FROM characters WHERE characterId = ANY({ids:Array(UInt32)})',
    { ids: characterIds }
  )
}

/**
 * Search characters by name
 */
export async function searchCharacters(searchTerm: string, limit: number = 20): Promise<Character[]> {
  return await database.query<Character>(
    `SELECT * FROM characters
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
    'SELECT name FROM characters WHERE characterId = {id:UInt32}',
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
    FROM characters c
    LEFT JOIN corporations corp ON c.corporationId = corp.corporationId
    LEFT JOIN alliances alliance ON corp.allianceId = alliance.allianceId
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

  // Postgres bulkInsert syntax is different if we used the helper strictly for CH.
  // The helper I wrote uses Bun SQL insert.
  // I need to match the field names to columns.
  // Columns: characterId, allianceId, birthday, bloodlineId, corporationId, description, gender, name, raceId, securityStatus, updatedAt, version
  // The input has snake_case in previous code maybe?
  // The table has camelCase columns in my CREATE TABLE but previous code used snake_case keys in `storeCharacter`?
  // `updated_at: now` -> `updatedAt`.

  await database.bulkInsert('characters', [
    {
      characterId: characterId,
      allianceId: data.allianceId,
      birthday: data.birthday,
      bloodlineId: data.bloodlineId,
      corporationId: data.corporationId,
      description: data.description,
      gender: data.gender,
      name: data.name,
      raceId: data.raceId,
      securityStatus: data.securityStatus,
      updatedAt: new Date(now * 1000), // Postgres TIMESTAMP
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
    updatedAt: new Date(now * 1000),
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

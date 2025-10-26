/**
 * Killlist Frontpage Model
 *
 * Queries the killlist_frontpage materialized view for home page killmail display
 * This view contains pre-joined data from killmails, characters, corporations,
 * alliances, types, groups, and solar systems
 */

export interface KilllistFrontpageRow {
  killmail_id: number
  killmail_time: Date

  // Victim ship
  victim_ship_type_id: number
  victim_ship_name: string
  victim_ship_group: string

  // Victim character
  victim_character_id: number | null
  victim_character_name: string

  // Victim corporation
  victim_corporation_id: number
  victim_corporation_name: string
  victim_corporation_ticker: string

  // Victim alliance (optional)
  victim_alliance_id: number | null
  victim_alliance_name: string | null
  victim_alliance_ticker: string | null

  // Final blow attacker
  attacker_character_id: number | null
  attacker_character_name: string
  attacker_corporation_id: number | null
  attacker_corporation_name: string
  attacker_corporation_ticker: string
  attacker_alliance_id: number | null
  attacker_alliance_name: string | null
  attacker_alliance_ticker: string | null

  // Solar system
  solar_system_id: number
  solar_system_name: string
  solar_system_security: number
  region_id: number
  region_name: string

  // Values and stats
  ship_value: number
  total_value: number
  attacker_count: number
}

/**
 * Get recent killmails for the front page
 * @param limit Number of killmails to return (default: 30)
 * @param offset Offset for pagination (default: 0)
 * @returns Array of killmail data
 */
export async function getRecentKillmails(limit: number = 30, offset: number = 0): Promise<KilllistFrontpageRow[]> {
  const sql = `
    SELECT
      killmail_id,
      killmail_time,
      victim_ship_type_id,
      victim_ship_name,
      victim_ship_group,
      victim_character_id,
      victim_character_name,
      victim_corporation_id,
      victim_corporation_name,
      victim_corporation_ticker,
      victim_alliance_id,
      victim_alliance_name,
      victim_alliance_ticker,
      attacker_character_id,
      attacker_character_name,
      attacker_corporation_id,
      attacker_corporation_name,
      attacker_corporation_ticker,
      attacker_alliance_id,
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
    ORDER BY killmail_time DESC
    LIMIT {limit:UInt32} OFFSET {offset:UInt32}
  `

  const result = await database.query<KilllistFrontpageRow>(sql, {
    limit,
    offset
  })

  return result
}

/**
 * Count total killmails (for pagination)
 * @returns Total count of killmails
 */
export async function getTotalKillmailCount(): Promise<number> {
  const sql = `SELECT count() as count FROM killlist_frontpage`
  const result = await database.queryValue<number>(sql)
  return result || 0
}

/**
 * Get killmails by solar system
 * @param systemId Solar system ID
 * @param limit Number of killmails to return
 * @param offset Offset for pagination
 */
export async function getKillmailsBySystem(
  systemId: number,
  limit: number = 30,
  offset: number = 0
): Promise<KilllistFrontpageRow[]> {
  const sql = `
    SELECT *
    FROM killlist_frontpage
    WHERE solar_system_id = {systemId:UInt32}
    ORDER BY killmail_time DESC
    LIMIT {limit:UInt32} OFFSET {offset:UInt32}
  `

  return await database.query<KilllistFrontpageRow>(sql, {
    systemId,
    limit,
    offset
  })
}

/**
 * Get killmails by character
 * @param characterId Character ID
 * @param limit Number of killmails to return
 * @param offset Offset for pagination
 */
export async function getKillmailsByCharacter(
  characterId: number,
  limit: number = 30,
  offset: number = 0
): Promise<KilllistFrontpageRow[]> {
  const sql = `
    SELECT *
    FROM killlist_frontpage
    WHERE victim_character_id = {characterId:UInt32}
       OR attacker_character_id = {characterId:UInt32}
    ORDER BY killmail_time DESC
    LIMIT {limit:UInt32} OFFSET {offset:UInt32}
  `

  return await database.query<KilllistFrontpageRow>(sql, {
    characterId,
    limit,
    offset
  })
}

/**
 * Get killmails by corporation
 * @param corporationId Corporation ID
 * @param limit Number of killmails to return
 * @param offset Offset for pagination
 */
export async function getKillmailsByCorporation(
  corporationId: number,
  limit: number = 30,
  offset: number = 0
): Promise<KilllistFrontpageRow[]> {
  const sql = `
    SELECT *
    FROM killlist_frontpage
    WHERE victim_corporation_id = {corporationId:UInt32}
       OR attacker_corporation_id = {corporationId:UInt32}
    ORDER BY killmail_time DESC
    LIMIT {limit:UInt32} OFFSET {offset:UInt32}
  `

  return await database.query<KilllistFrontpageRow>(sql, {
    corporationId,
    limit,
    offset
  })
}

/**
 * Get killmails by alliance
 * @param allianceId Alliance ID
 * @param limit Number of killmails to return
 * @param offset Offset for pagination
 */
export async function getKillmailsByAlliance(
  allianceId: number,
  limit: number = 30,
  offset: number = 0
): Promise<KilllistFrontpageRow[]> {
  const sql = `
    SELECT *
    FROM killlist_frontpage
    WHERE victim_alliance_id = {allianceId:UInt32}
       OR attacker_alliance_id = {allianceId:UInt32}
    ORDER BY killmail_time DESC
    LIMIT {limit:UInt32} OFFSET {offset:UInt32}
  `

  return await database.query<KilllistFrontpageRow>(sql, {
    allianceId,
    limit,
    offset
  })
}

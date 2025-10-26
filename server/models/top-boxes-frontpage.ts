/**
 * Top Boxes Frontpage Model
 *
 * Queries entity_killlist materialized view
 * Shows top 10 characters, corporations, alliances, systems, and regions by kill count (last 30 days)
 */

export interface TopEntity {
  id: number
  name: string
  kills: number
}

export interface TopBoxStats {
  characters: TopEntity[]
  corporations: TopEntity[]
  alliances: TopEntity[]
  systems: TopEntity[]
  regions: TopEntity[]
}

/**
 * Get top 10 characters by kills (last 30 days, attacker final blow)
 */
export async function getTopCharacters(limit: number = 10): Promise<TopEntity[]> {
  const sql = `
    SELECT
      attacker_character_id as id,
      attacker_character_name as name,
      count() as kills
    FROM entity_killlist
    WHERE attacker_character_id > 0
      AND killmail_time >= now() - INTERVAL 30 DAY
    GROUP BY attacker_character_id, attacker_character_name
    ORDER BY kills DESC
    LIMIT {limit:UInt32}
  `

  return await database.query<TopEntity>(sql, { limit })
}

/**
 * Get top 10 corporations by kills (last 30 days, attacker final blow)
 */
export async function getTopCorporations(limit: number = 10): Promise<TopEntity[]> {
  const sql = `
    SELECT
      attacker_corporation_id as id,
      attacker_corporation_name as name,
      count() as kills
    FROM entity_killlist
    WHERE attacker_corporation_id > 0
      AND killmail_time >= now() - INTERVAL 30 DAY
    GROUP BY attacker_corporation_id, attacker_corporation_name
    ORDER BY kills DESC
    LIMIT {limit:UInt32}
  `

  return await database.query<TopEntity>(sql, { limit })
}

/**
 * Get top 10 alliances by kills (last 30 days, attacker final blow)
 */
export async function getTopAlliances(limit: number = 10): Promise<TopEntity[]> {
  const sql = `
    SELECT
      attacker_alliance_id as id,
      attacker_alliance_name as name,
      count() as kills
    FROM entity_killlist
    WHERE attacker_alliance_id > 0
      AND killmail_time >= now() - INTERVAL 30 DAY
    GROUP BY attacker_alliance_id, attacker_alliance_name
    ORDER BY kills DESC
    LIMIT {limit:UInt32}
  `

  return await database.query<TopEntity>(sql, { limit })
}

/**
 * Get top 10 solar systems by kills (last 30 days)
 */
export async function getTopSystems(limit: number = 10): Promise<TopEntity[]> {
  const sql = `
    SELECT
      solar_system_id as id,
      solar_system_name as name,
      count() as kills
    FROM entity_killlist
    WHERE killmail_time >= now() - INTERVAL 30 DAY
    GROUP BY solar_system_id, solar_system_name
    ORDER BY kills DESC
    LIMIT {limit:UInt32}
  `

  return await database.query<TopEntity>(sql, { limit })
}

/**
 * Get top 10 regions by kills (last 30 days)
 */
export async function getTopRegions(limit: number = 10): Promise<TopEntity[]> {
  const sql = `
    SELECT
      region_id as id,
      region_name as name,
      count() as kills
    FROM entity_killlist
    WHERE killmail_time >= now() - INTERVAL 30 DAY
    GROUP BY region_id, region_name
    ORDER BY kills DESC
    LIMIT {limit:UInt32}
  `

  return await database.query<TopEntity>(sql, { limit })
}

/**
 * Get all top 10 stats at once
 */
export async function getTopBoxStats(): Promise<TopBoxStats> {
  const [characters, corporations, alliances, systems, regions] = await Promise.all([
    getTopCharacters(),
    getTopCorporations(),
    getTopAlliances(),
    getTopSystems(),
    getTopRegions()
  ])

  return {
    characters,
    corporations,
    alliances,
    systems,
    regions
  }
}

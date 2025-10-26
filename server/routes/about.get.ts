import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  // Page context
  const pageContext = {
    title: 'About - EVE-KILL',
    description: 'Killboard statistics and information about EVE-KILL',
    keywords: 'eve online, killboard, statistics, pvp'
  }

  try {
    // Fetch all statistics in parallel
    const [
      totalKillmails,
      totalISKDestroyed,
      uniqueCharacters,
      uniqueCorporations,
      uniqueAlliances,
      soloKills,
      avgAttackersPerKill,
      activity24h,
      activity7d,
      activity30d,
      topCharacters,
      topCorporations,
      topAlliances,
      mostDestroyedShips,
      mostDangerousSystems
    ] = await Promise.all([
      getTotalKillmailCount(),
      getTotalISKDestroyed(),
      getUniqueEntityCount('character'),
      getUniqueEntityCount('corporation'),
      getUniqueEntityCount('alliance'),
      getSoloKillsCount(),
      getAverageAttackersPerKill(),
      getActivityStats(24),
      getActivityStats(7 * 24),
      getActivityStats(30 * 24),
      getTopCharactersByKills(5),
      getTopCorporationsByKills(5),
      getTopAlliancesByKills(5),
      getMostDestroyedShips(5),
      getMostDangerousSystems(5)
    ])

    // Format the data for the template
    const statistics = {
      // Overall stats
      totalKillmails,
      totalISKDestroyed,
      uniqueCharacters,
      uniqueCorporations,
      uniqueAlliances,

      // Specific stats
      soloKills,
      averageAttackersPerKill: avgAttackersPerKill.toFixed(2),

      // Activity stats
      activePilotsLast24Hours: activity24h.pilots,
      killsLast24Hours: activity24h.kills,
      activePilotsLast7Days: activity7d.pilots,
      killsLast7Days: activity7d.kills,
      activePilotsLast30Days: activity30d.pilots,
      killsLast30Days: activity30d.kills,

      // Top entities
      topKiller: topCharacters[0] ? {
        id: topCharacters[0].id,
        name: topCharacters[0].name,
        kills: topCharacters[0].kills
      } : null,

      topCorporation: topCorporations[0] ? {
        id: topCorporations[0].id,
        name: topCorporations[0].name,
        kills: topCorporations[0].kills
      } : null,

      topAlliance: topAlliances[0] ? {
        id: topAlliances[0].id,
        name: topAlliances[0].name,
        kills: topAlliances[0].kills
      } : null,

      // Ships & systems
      mostDestroyedShip: mostDestroyedShips[0] ? {
        id: mostDestroyedShips[0].id,
        name: mostDestroyedShips[0].name,
        count: mostDestroyedShips[0].count
      } : null,

      mostDangerousSystem: mostDangerousSystems[0] ? {
        id: mostDangerousSystems[0].id,
        name: mostDangerousSystems[0].name,
        count: mostDangerousSystems[0].count
      } : null,

      // Additional data
      topCharactersAll: topCharacters.slice(0, 5),
      topCorporationsAll: topCorporations.slice(0, 5),
      topAlliancesAll: topAlliances.slice(0, 5),
      mostDestroyedShipsAll: mostDestroyedShips.slice(0, 5),
      mostDangerousSystemsAll: mostDangerousSystems.slice(0, 5)
    }

    const data = {
      statistics
    }

    // Render template
    return render('pages/about.hbs', pageContext, data, event)
  } catch (error) {
    logger.error('Error loading about page', {
      error: error instanceof Error ? error.message : String(error)
    })

    // Return minimal page on error
    const data = {
      error: 'Failed to load statistics'
    }

    return render('pages/about.hbs', pageContext, data, event)
  }
})

/**
 * Get total killmail count
 */
async function getTotalKillmailCount(): Promise<number> {
  const result = await database.queryValue<number>(
    'SELECT count() FROM edk.killmails'
  )
  return result || 0
}

/**
 * Get total ISK destroyed across all killmails
 */
async function getTotalISKDestroyed(): Promise<number> {
  const result = await database.queryValue<number>(
    'SELECT sum(total_value) FROM killlist_frontpage'
  )
  return result || 0
}

/**
 * Get count of unique entities (character, corporation, alliance)
 */
async function getUniqueEntityCount(type: 'character' | 'corporation' | 'alliance'): Promise<number> {
  let sql = ''

  if (type === 'character') {
    sql = 'SELECT count(DISTINCT victimCharacterId) FROM edk.killmails WHERE victimCharacterId > 0'
  } else if (type === 'corporation') {
    sql = 'SELECT count(DISTINCT victimCorporationId) FROM edk.killmails WHERE victimCorporationId > 0'
  } else {
    sql = 'SELECT count(DISTINCT victimAllianceId) FROM edk.killmails WHERE victimAllianceId > 0'
  }

  const result = await database.queryValue<number>(sql)
  return result || 0
}

/**
 * Get count of solo kills (killmails with only 1 attacker)
 */
async function getSoloKillsCount(): Promise<number> {
  const result = await database.queryValue<number>(
    'SELECT countIf(attacker_count = 1) FROM killlist_frontpage'
  )
  return result || 0
}

/**
 * Get average attackers per killmail
 */
async function getAverageAttackersPerKill(): Promise<number> {
  const result = await database.queryValue<number>(
    'SELECT avg(attacker_count) FROM killlist_frontpage'
  )
  return result || 0
}

/**
 * Get activity statistics for a given time period (in hours)
 */
async function getActivityStats(hours: number): Promise<{ pilots: number, kills: number }> {
  const cutoffTime = Math.floor(Date.now() / 1000) - (hours * 3600)

  const [pilotsResult, killsResult] = await Promise.all([
    database.queryValue<number>(
      `SELECT count(DISTINCT victimCharacterId) FROM edk.killmails
       WHERE toUnixTimestamp(killmailTime) >= {cutoff:UInt32}`,
      { cutoff: cutoffTime }
    ),
    database.queryValue<number>(
      `SELECT count() FROM edk.killmails
       WHERE toUnixTimestamp(killmailTime) >= {cutoff:UInt32}`,
      { cutoff: cutoffTime }
    )
  ])

  return {
    pilots: pilotsResult || 0,
    kills: killsResult || 0
  }
}

/**
 * Get top characters by kill count (as attacker with final blow)
 */
async function getTopCharactersByKills(limit: number = 5): Promise<Array<{id: number, name: string, kills: number}>> {
  // Using entity_killlist materialized view if available
  const result = await database.query<{id: number, name: string, kills: number}>(
    `SELECT
      attacker_character_id as id,
      attacker_character_name as name,
      count() as kills
    FROM entity_killlist
    WHERE attacker_character_id > 0
    GROUP BY attacker_character_id, attacker_character_name
    ORDER BY kills DESC
    LIMIT {limit:UInt32}`,
    { limit }
  )
  return result || []
}

/**
 * Get top corporations by kill count (as attacker with final blow)
 */
async function getTopCorporationsByKills(limit: number = 5): Promise<Array<{id: number, name: string, kills: number}>> {
  const result = await database.query<{id: number, name: string, kills: number}>(
    `SELECT
      attacker_corporation_id as id,
      attacker_corporation_name as name,
      count() as kills
    FROM entity_killlist
    WHERE attacker_corporation_id > 0
    GROUP BY attacker_corporation_id, attacker_corporation_name
    ORDER BY kills DESC
    LIMIT {limit:UInt32}`,
    { limit }
  )
  return result || []
}

/**
 * Get top alliances by kill count (as attacker with final blow)
 */
async function getTopAlliancesByKills(limit: number = 5): Promise<Array<{id: number, name: string, kills: number}>> {
  const result = await database.query<{id: number, name: string, kills: number}>(
    `SELECT
      attacker_alliance_id as id,
      attacker_alliance_name as name,
      count() as kills
    FROM entity_killlist
    WHERE attacker_alliance_id > 0
    GROUP BY attacker_alliance_id, attacker_alliance_name
    ORDER BY kills DESC
    LIMIT {limit:UInt32}`,
    { limit }
  )
  return result || []
}

/**
 * Get most destroyed ship types
 */
async function getMostDestroyedShips(limit: number = 5): Promise<Array<{id: number, name: string, count: number}>> {
  const result = await database.query<{id: number, name: string, count: number}>(
    `SELECT
      victim_ship_type_id as id,
      victim_ship_name as name,
      count() as count
    FROM killlist_frontpage
    GROUP BY victim_ship_type_id, victim_ship_name
    ORDER BY count DESC
    LIMIT {limit:UInt32}`,
    { limit }
  )
  return result || []
}

/**
 * Get most dangerous systems (by kill count)
 */
async function getMostDangerousSystems(limit: number = 5): Promise<Array<{id: number, name: string, count: number}>> {
  const result = await database.query<{id: number, name: string, count: number}>(
    `SELECT
      solar_system_id as id,
      solar_system_name as name,
      count() as count
    FROM killlist_frontpage
    GROUP BY solar_system_id, solar_system_name
    ORDER BY count DESC
    LIMIT {limit:UInt32}`,
    { limit }
  )
  return result || []
}

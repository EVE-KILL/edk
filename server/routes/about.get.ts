import { defineEventHandler } from 'h3'
import { database } from '../helpers/database'
import { logger } from '../helpers/logger'
import { render } from '../helpers/templates'
import { handleError } from '../utils/error'

export default defineEventHandler(async (event) => {
  try {
    const pageContext = {
      title: 'About - EVE Killboard',
      activeNav: 'about'
    }

    // Get stats sequentially to avoid connection issues
    const totalKills = await getTotalKillmailCount()
    logger.info('About page stats', { totalKills })
    const totalISK = await getTotalISKDestroyed()
    const characters = await getUniqueEntityCount('character')
    const corporations = await getUniqueEntityCount('corporation')
    const alliances = await getUniqueEntityCount('alliance')
    const soloKills = await getSoloKillsCount()
    const avgAttackers = await getAverageAttackersPerKill()
    const activity24h = await getActivityStats(24)
    const activity7d = await getActivityStats(168)
    const topCharacters = await getTopCharactersByKills(5)
    const topCorporations = await getTopCorporationsByKills(5)
    const topAlliances = await getTopAlliancesByKills(5)
    const mostDestroyedShips = await getMostDestroyedShips(5)
    const mostDangerousSystems = await getMostDangerousSystems(5)

    logger.info('About page all stats', { totalKills, characters, corporations, alliances, soloKills })

    const statistics = {
      totalKillmails: totalKills,
      totalISKDestroyed: totalISK,
      uniqueCharacters: characters,
      uniqueCorporations: corporations,
      uniqueAlliances: alliances,
      soloKills: soloKills,
      soloPercentage: totalKills > 0 ? ((soloKills / totalKills) * 100).toFixed(1) : '0.0',
      averageAttackersPerKill: avgAttackers.toFixed(1),
      activePilotsLast24Hours: activity24h.pilots,
      activePilotsLast7Days: activity7d.pilots,
      killsLast24Hours: activity24h.kills,
      killsLast7Days: activity7d.kills,
      killsLast30Days: 0, // TODO: Add 30 day tracking
      topKiller: topCharacters[0] || null,
      topCorporation: topCorporations[0] || null,
      topAlliance: topAlliances[0] || null,
      mostDestroyedShip: mostDestroyedShips[0] || null,
      mostDangerousSystem: mostDangerousSystems[0] || null,
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
    return handleError(event, error)
  }
})

/**
 * Get total killmail count
 */
async function getTotalKillmailCount(): Promise<number> {
  const [result] = await database.sql<{count: number}[]>`
    SELECT count(*) as count FROM killmails
  `
  return Number(result?.count) || 0
}

/**
 * Get total ISK destroyed across all killmails
 */
async function getTotalISKDestroyed(): Promise<number> {
  const [result] = await database.sql<{sum: number}[]>`
    SELECT sum("totalValue") as sum FROM killmails
  `
  return Number(result?.sum) || 0
}

/**
 * Get count of unique entities (character, corporation, alliance)
 */
async function getUniqueEntityCount(type: 'character' | 'corporation' | 'alliance'): Promise<number> {
  let result
  if (type === 'character') {
    [result] = await database.sql<{count: number}[]>`SELECT count(DISTINCT "victimCharacterId") as count FROM killmails WHERE "victimCharacterId" > 0`
  } else if (type === 'corporation') {
    [result] = await database.sql<{count: number}[]>`SELECT count(DISTINCT "victimCorporationId") as count FROM killmails WHERE "victimCorporationId" > 0`
  } else {
    [result] = await database.sql<{count: number}[]>`SELECT count(DISTINCT "victimAllianceId") as count FROM killmails WHERE "victimAllianceId" > 0`
  }

  return Number(result?.count) || 0
}

/**
 * Get count of solo kills (killmails with only 1 attacker)
 */
async function getSoloKillsCount(): Promise<number> {
  const [result] = await database.sql<{count: number}[]>`
    SELECT count(*) as count FROM killmails WHERE solo = true
  `
  return Number(result?.count) || 0
}

/**
 * Get average attackers per killmail
 */
async function getAverageAttackersPerKill(): Promise<number> {
  const [result] = await database.sql<{avg: number}[]>`
    SELECT avg("attackerCount") as avg FROM killmails
  `
  return Number(result?.avg) || 0
}

/**
 * Get activity statistics for a given time period (in hours)
 */
async function getActivityStats(hours: number): Promise<{ pilots: number, kills: number }> {
  const [pilotsResult] = await database.sql<{count: number}[]>`
      SELECT count(DISTINCT "victimCharacterId") as count FROM killmails
       WHERE "killmailTime" >= NOW() - (${hours} || ' hours')::interval
    `

  const [killsResult] = await database.sql<{count: number}[]>`
      SELECT count(*) as count FROM killmails
       WHERE "killmailTime" >= NOW() - (${hours} || ' hours')::interval
    `

  return {
    pilots: Number(pilotsResult?.count) || 0,
    kills: Number(killsResult?.count) || 0
  }
}

/**
 * Get top characters by kill count (as attacker with final blow)
 */
async function getTopCharactersByKills(limit: number = 5): Promise<Array<{id: number, name: string, kills: number}>> {
  return await database.sql<{id: number, name: string, kills: number}[]>`
    SELECT
      km."topAttackerCharacterId" as id,
      COALESCE(c.name, nc.name, 'Unknown') as name,
      count(*) as kills
    FROM killmails km
    LEFT JOIN characters c ON km."topAttackerCharacterId" = c."characterId"
    LEFT JOIN npcCharacters nc ON km."topAttackerCharacterId" = nc."characterId"
    WHERE km."topAttackerCharacterId" > 0
    GROUP BY km."topAttackerCharacterId", c.name, nc.name
    ORDER BY kills DESC
    LIMIT ${limit}
  `
}

/**
 * Get top corporations by kill count (as attacker with final blow)
 */
async function getTopCorporationsByKills(limit: number = 5): Promise<Array<{id: number, name: string, kills: number}>> {
  return await database.sql<{id: number, name: string, kills: number}[]>`
    SELECT
      km."topAttackerCorporationId" as id,
      COALESCE(c.name, nc.name, 'Unknown') as name,
      count(*) as kills
    FROM killmails km
    LEFT JOIN corporations c ON km."topAttackerCorporationId" = c."corporationId"
    LEFT JOIN npcCorporations nc ON km."topAttackerCorporationId" = nc."corporationId"
    WHERE km."topAttackerCorporationId" > 0
    GROUP BY km."topAttackerCorporationId", c.name, nc.name
    ORDER BY kills DESC
    LIMIT ${limit}
  `
}

/**
 * Get top alliances by kill count (as attacker with final blow)
 */
async function getTopAlliancesByKills(limit: number = 5): Promise<Array<{id: number, name: string, kills: number}>> {
  return await database.sql<{id: number, name: string, kills: number}[]>`
    SELECT
      km."topAttackerAllianceId" as id,
      COALESCE(a.name, 'Unknown') as name,
      count(*) as kills
    FROM killmails km
    LEFT JOIN alliances a ON km."topAttackerAllianceId" = a."allianceId"
    WHERE km."topAttackerAllianceId" > 0
    GROUP BY km."topAttackerAllianceId", a.name
    ORDER BY kills DESC
    LIMIT ${limit}
  `
}

/**
 * Get most destroyed ship types
 */
async function getMostDestroyedShips(limit: number = 5): Promise<Array<{id: number, name: string, count: number}>> {
  return await database.sql<{id: number, name: string, count: number}[]>`
    SELECT
      km."victimShipTypeId" as id,
      COALESCE(t.name, 'Unknown Ship') as name,
      count(*) as count
    FROM killmails km
    LEFT JOIN types t ON km."victimShipTypeId" = t."typeId"
    WHERE km."victimShipTypeId" > 0
    GROUP BY km."victimShipTypeId", t.name
    ORDER BY count DESC
    LIMIT ${limit}
  `
}

/**
 * Get most dangerous systems (by kill count)
 */
async function getMostDangerousSystems(limit: number = 5): Promise<Array<{id: number, name: string, count: number}>> {
  return await database.sql<{id: number, name: string, count: number}[]>`
    SELECT
      km."solarSystemId" as id,
      COALESCE(sys.name, 'Unknown') as name,
      count(*) as count
    FROM killmails km
    LEFT JOIN solarSystems sys ON km."solarSystemId" = sys."solarSystemId"
    WHERE km."solarSystemId" > 0
    GROUP BY km."solarSystemId", sys.name
    ORDER BY count DESC
    LIMIT ${limit}
  `
}

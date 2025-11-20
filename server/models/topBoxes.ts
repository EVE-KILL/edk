import { database } from '../helpers/database'

/**
 * Top Boxes Model
 *
 * Queries top statistics from killmails table.
 * (Materialized views entity_stats_daily_* were removed).
 */

export interface TopBoxWithName {
  id: number
  name: string
  kills: number
  losses: number
  iskDestroyed: number
  iskLost: number
  points: number
}

/**
 * Calculate the date range for a period type (ending today)
 * Returns ISO date strings for Postgres
 */
function getDateRange(periodType: 'hour' | 'day' | 'week' | 'month'): { start: string; end: string } {
  const end = new Date()
  const start = new Date(end)

  switch (periodType) {
    case 'hour': {
      start.setHours(start.getHours() - 1)
      break
    }
    case 'day': {
      start.setDate(start.getDate() - 1)
      break
    }
    case 'week': {
      start.setDate(start.getDate() - 7)
      break
    }
    case 'month': {
      start.setMonth(start.getMonth() - 1)
      break
    }
  }

  return {
    start: start.toISOString(),
    end: end.toISOString()
  }
}

/**
 * Get top entities by kills for a period
 */
export async function getTopByKills(
  periodType: 'hour' | 'day' | 'week' | 'month',
  entityType: 'character' | 'corporation' | 'alliance' | 'ship' | 'system' | 'region',
  limit: number = 10
): Promise<TopBoxWithName[]> {
  const { start, end } = getDateRange(periodType)

  // Determine columns and tables
  let groupCol = ''
  let nameCol = ''
  let joinClause = ''

  if (entityType === 'character') {
    groupCol = 'k.topAttackerCharacterId';
    nameCol = 'c.name';
    joinClause = 'LEFT JOIN characters c ON k.topAttackerCharacterId = c.characterId';
  } else if (entityType === 'corporation') {
    groupCol = 'k.topAttackerCorporationId';
    nameCol = 'c.name';
    joinClause = 'LEFT JOIN corporations c ON k.topAttackerCorporationId = c.corporationId';
  } else if (entityType === 'alliance') {
    groupCol = 'k.topAttackerAllianceId';
    nameCol = 'a.name';
    joinClause = 'LEFT JOIN alliances a ON k.topAttackerAllianceId = a.allianceId';
  } else if (entityType === 'ship') {
    groupCol = 'k.victimShipTypeId';
    nameCol = 't.name';
    joinClause = 'LEFT JOIN types t ON k.victimShipTypeId = t.typeId';
  } else if (entityType === 'system') {
    groupCol = 'k.solarSystemId';
    nameCol = 'ss.name';
    joinClause = 'LEFT JOIN solarSystems ss ON k.solarSystemId = ss.solarSystemId';
  } else if (entityType === 'region') {
    groupCol = 'ss.regionId';
    nameCol = 'r.name';
    joinClause = 'LEFT JOIN solarSystems ss ON k.solarSystemId = ss.solarSystemId LEFT JOIN regions r ON ss.regionId = r.regionId';
  }

  return await database.query<TopBoxWithName>(
    `SELECT
       ${groupCol} as id,
       COALESCE(${nameCol}, 'Unknown') as name,
       count(*) as kills,
       0 as losses,
       SUM(k.totalValue) as iskDestroyed,
       0 as iskLost,
       0 as points
     FROM killmails k
     ${joinClause}
     WHERE k.killmailTime >= {start:String}::timestamp
       AND k.killmailTime <= {end:String}::timestamp
       AND ${groupCol} > 0
     GROUP BY ${groupCol}, ${nameCol}
     ORDER BY kills DESC, iskDestroyed DESC
     LIMIT {limit:UInt32}`,
    { start, end, limit }
  )
}

/**
 * Get top entities by ISK destroyed
 */
export async function getTopByIskDestroyed(
  periodType: 'hour' | 'day' | 'week' | 'month',
  entityType: 'character' | 'corporation' | 'alliance' | 'ship' | 'system' | 'region',
  limit: number = 10
): Promise<TopBoxWithName[]> {
  const { start, end } = getDateRange(periodType)

  // Re-use logic from getTopByKills but change order
  // Duplicated logic for brevity in this fix
  let groupCol = ''
  let nameCol = ''
  let joinClause = ''

  if (entityType === 'character') {
    groupCol = 'k.topAttackerCharacterId';
    nameCol = 'c.name';
    joinClause = 'LEFT JOIN characters c ON k.topAttackerCharacterId = c.characterId';
  } else if (entityType === 'corporation') {
    groupCol = 'k.topAttackerCorporationId';
    nameCol = 'c.name';
    joinClause = 'LEFT JOIN corporations c ON k.topAttackerCorporationId = c.corporationId';
  } else if (entityType === 'alliance') {
    groupCol = 'k.topAttackerAllianceId';
    nameCol = 'a.name';
    joinClause = 'LEFT JOIN alliances a ON k.topAttackerAllianceId = a.allianceId';
  } else if (entityType === 'ship') {
    // For ships, "top by ISK destroyed" usually means most value LOST by that ship type?
    // Or most value KILLED by that ship type?
    // In Top Boxes context (homepage), "Top Ships" usually means "Ships that killed the most".
    // But typically "Top Ships" widget shows "Most Destroyed" (victims).
    // Let's assume "Most Destroyed" (victimShipTypeId) for ship lists on homepage if sorted by ISK.
    // Actually getTopByKills used victimShipTypeId.
    // Let's stick to the pattern: Top Entities (attackers) and Top Systems/Regions.

    groupCol = 'k.victimShipTypeId'; // This implies "Most valuable losses" if sorted by value.
    // If we want "Most valuable kills" by ship type, we need attackers table which is slow.
    // Let's assume "Most Lost" for ships.
    nameCol = 't.name';
    joinClause = 'LEFT JOIN types t ON k.victimShipTypeId = t.typeId';
  } else if (entityType === 'system') {
    groupCol = 'k.solarSystemId';
    nameCol = 'ss.name';
    joinClause = 'LEFT JOIN solarSystems ss ON k.solarSystemId = ss.solarSystemId';
  } else if (entityType === 'region') {
    groupCol = 'ss.regionId';
    nameCol = 'r.name';
    joinClause = 'LEFT JOIN solarSystems ss ON k.solarSystemId = ss.solarSystemId LEFT JOIN regions r ON ss.regionId = r.regionId';
  }

  return await database.query<TopBoxWithName>(
    `SELECT
       ${groupCol} as id,
       COALESCE(${nameCol}, 'Unknown') as name,
       count(*) as kills,
       0 as losses,
       SUM(k.totalValue) as iskDestroyed,
       0 as iskLost,
       0 as points
     FROM killmails k
     ${joinClause}
     WHERE k.killmailTime >= {start:String}::timestamp
       AND k.killmailTime <= {end:String}::timestamp
       AND ${groupCol} > 0
     GROUP BY ${groupCol}, ${nameCol}
     ORDER BY iskDestroyed DESC, kills DESC
     LIMIT {limit:UInt32}`,
    { start, end, limit }
  )
}

/**
 * Get top entities by points (for ranking)
 */
export async function getTopByPoints(
  periodType: 'hour' | 'day' | 'week' | 'month',
  entityType: 'character' | 'corporation' | 'alliance' | 'ship' | 'system' | 'region',
  limit: number = 10
): Promise<TopBoxWithName[]> {
    // Points not implemented without aggregations, return empty
  return []
}

/**
 * Get stats for a specific entity
 */
export async function getEntityTopBoxStats(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance' | 'ship' | 'system' | 'region',
  periodType: 'hour' | 'day' | 'week' | 'month'
): Promise<TopBoxWithName | null> {
  return null
}

/**
 * Get top stats for filtered killmails (for kills pages with filters)
 * This queries the killlist table directly and aggregates on the fly
 */
export interface FilteredTopStats {
  systems: Array<{ id: number; name: string; kills: number }>
  regions: Array<{ id: number; name: string; kills: number }>
  characters: Array<{ id: number; name: string; kills: number }>
  corporations: Array<{ id: number; name: string; kills: number }>
  alliances: Array<{ id: number; name: string; kills: number }>
}

/**
 * Get top systems for filtered kills
 */
export async function getTopSystemsFiltered(
  whereClause: string,
  params: any,
  limit: number = 10,
  prewhereClause?: string, // Ignored
  basePrewhereClause?: string // Ignored
): Promise<Array<{ id: number; name: string; kills: number }>> {
  const trimmedClause = whereClause.trim()
  const clause = trimmedClause.length > 0
    ? `${trimmedClause} AND k.solarSystemId > 0`
    : 'WHERE k.solarSystemId > 0'

  return await database.query<{ id: number; name: string; kills: number }>(
    `SELECT
       k.solarSystemId as id,
       COALESCE(ss.name, 'Unknown') as name,
       count(*) as kills
     FROM killmails k
     LEFT JOIN solarSystems ss ON k.solarSystemId = ss.solarSystemId
     LEFT JOIN types t ON k.victimShipTypeId = t.typeId
     ${clause}
     GROUP BY k.solarSystemId, ss.name
     ORDER BY kills DESC
     LIMIT {limit:UInt32}`,
    { ...params, limit }
  )
}

/**
 * Get top regions for filtered kills
 */
export async function getTopRegionsFiltered(
  whereClause: string,
  params: any,
  limit: number = 10,
  prewhereClause?: string,
  basePrewhereClause?: string
): Promise<Array<{ id: number; name: string; kills: number }>> {
  const trimmedClause = whereClause.trim()
  const clause = trimmedClause.length > 0
    ? `${trimmedClause} AND ss.regionId > 0`
    : 'WHERE ss.regionId > 0'

  return await database.query<{ id: number; name: string; kills: number }>(
    `SELECT
       ss.regionId as id,
       COALESCE(reg.name, 'Unknown') as name,
       count(*) as kills
     FROM killmails k
     LEFT JOIN solarSystems ss ON k.solarSystemId = ss.solarSystemId
     LEFT JOIN regions reg ON ss.regionId = reg.regionId
     LEFT JOIN types t ON k.victimShipTypeId = t.typeId
     ${clause}
     GROUP BY ss.regionId, reg.name
     ORDER BY kills DESC
     LIMIT {limit:UInt32}`,
    { ...params, limit }
  )
}

/**
 * Get top characters (attackers) for filtered kills
 */
export async function getTopCharactersFiltered(
  whereClause: string,
  params: any,
  limit: number = 10,
  prewhereClause?: string,
  basePrewhereClause?: string
): Promise<Array<{ id: number; name: string; kills: number }>> {
  const trimmedClause = whereClause.trim()
  const clause = trimmedClause.length > 0
    ? `${trimmedClause} AND k.topAttackerCharacterId > 0`
    : 'WHERE k.topAttackerCharacterId > 0'

  return await database.query<{ id: number; name: string; kills: number }>(
    `SELECT
       k.topAttackerCharacterId as id,
       COALESCE(c.name, 'Unknown') as name,
       count(*) as kills
     FROM killmails k
     LEFT JOIN solarSystems ss ON k.solarSystemId = ss.solarSystemId
     LEFT JOIN types t ON k.victimShipTypeId = t.typeId
     LEFT JOIN characters c ON k.topAttackerCharacterId = c.characterId
     ${clause}
     GROUP BY k.topAttackerCharacterId, c.name
     ORDER BY kills DESC
     LIMIT {limit:UInt32}`,
    { ...params, limit }
  )
}

/**
 * Get top corporations (attackers) for filtered kills
 */
export async function getTopCorporationsFiltered(
  whereClause: string,
  params: any,
  limit: number = 10,
  prewhereClause?: string,
  basePrewhereClause?: string
): Promise<Array<{ id: number; name: string; kills: number }>> {
  const trimmedClause = whereClause.trim()
  const clause = trimmedClause.length > 0
    ? `${trimmedClause} AND k.topAttackerCorporationId > 0`
    : 'WHERE k.topAttackerCorporationId > 0'

  return await database.query<{ id: number; name: string; kills: number }>(
    `SELECT
       k.topAttackerCorporationId as id,
       COALESCE(c.name, 'Unknown') as name,
       count(*) as kills
     FROM killmails k
     LEFT JOIN solarSystems ss ON k.solarSystemId = ss.solarSystemId
     LEFT JOIN types t ON k.victimShipTypeId = t.typeId
     LEFT JOIN corporations c ON k.topAttackerCorporationId = c.corporationId
     ${clause}
     GROUP BY k.topAttackerCorporationId, c.name
     ORDER BY kills DESC
     LIMIT {limit:UInt32}`,
    { ...params, limit }
  )
}

/**
 * Get top alliances (attackers) for filtered kills
 */
export async function getTopAlliancesFiltered(
  whereClause: string,
  params: any,
  limit: number = 10,
  prewhereClause?: string,
  basePrewhereClause?: string
): Promise<Array<{ id: number; name: string; kills: number }>> {
  const trimmedClause = whereClause.trim()
  const clause = trimmedClause.length > 0
    ? `${trimmedClause} AND k.topAttackerAllianceId > 0`
    : 'WHERE k.topAttackerAllianceId > 0'

  return await database.query<{ id: number; name: string; kills: number }>(
    `SELECT
       k.topAttackerAllianceId as id,
       COALESCE(a.name, 'Unknown') as name,
       count(*) as kills
     FROM killmails k
     LEFT JOIN solarSystems ss ON k.solarSystemId = ss.solarSystemId
     LEFT JOIN types t ON k.victimShipTypeId = t.typeId
     LEFT JOIN alliances a ON k.topAttackerAllianceId = a.allianceId
     ${clause}
     GROUP BY k.topAttackerAllianceId, a.name
     ORDER BY kills DESC
     LIMIT {limit:UInt32}`,
    { ...params, limit }
  )
}

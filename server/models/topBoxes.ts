import { database } from '../helpers/database'

/**
 * Top Boxes Model - Daily Aggregation
 *
 * Queries entity_stats_daily_* tables which store one row per entity per day.
 * Sums across date ranges to provide hour/day/week/month views.
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
 * Returns ISO date strings for ClickHouse
 */
function getDateRange(periodType: 'hour' | 'day' | 'week' | 'month'): { start: string; end: string } {
  const end = new Date()
  end.setHours(23, 59, 59, 999)

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

  start.setHours(0, 0, 0, 0)

  // Format as ISO date strings for ClickHouse
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  }
}

/**
 * Map entity type to table name
 */
function getTableName(
  entityType: 'character' | 'corporation' | 'alliance' | 'ship' | 'system' | 'region'
): string {
  const tableMap = {
    character: 'entity_stats_daily_character',
    corporation: 'entity_stats_daily_corporation',
    alliance: 'entity_stats_daily_alliance',
    ship: 'entity_stats_daily_ship',
    system: 'entity_stats_daily_system',
    region: 'entity_stats_daily_region',
  }
  return tableMap[entityType]
}

/**
 * Map entity type to ID column name
 */
function getIdColumn(
  entityType: 'character' | 'corporation' | 'alliance' | 'ship' | 'system' | 'region'
): string {
  const columnMap = {
    character: 'characterId',
    corporation: 'corporationId',
    alliance: 'allianceId',
    ship: 'shipTypeId',
    system: 'systemId',
    region: 'regionId',
  }
  return columnMap[entityType]
}

/**
 * Map entity type to name column name
 */
function getNameColumn(
  entityType: 'character' | 'corporation' | 'alliance' | 'ship' | 'system' | 'region'
): string {
  const columnMap = {
    character: 'characterName',
    corporation: 'corporationName',
    alliance: 'allianceName',
    ship: 'shipName',
    system: 'systemName',
    region: 'regionName',
  }
  return columnMap[entityType]
}

/**
 * Get top entities by kills for a period
 */
export async function getTopByKills(
  periodType: 'hour' | 'day' | 'week' | 'month',
  entityType: 'character' | 'corporation' | 'alliance' | 'ship' | 'system' | 'region',
  limit: number = 10
): Promise<TopBoxWithName[]> {
  const table = getTableName(entityType)
  const idCol = getIdColumn(entityType)
  const nameCol = getNameColumn(entityType)
  const { start, end } = getDateRange(periodType)

  return await database.query<TopBoxWithName>(
    `SELECT
       ${idCol} as id,
       ${nameCol} as name,
       SUM(kills) as kills,
       SUM(losses) as losses,
       SUM(iskDestroyed) as iskDestroyed,
       SUM(iskLost) as iskLost,
       SUM(points) as points
     FROM ${table}
     WHERE date >= {start:String}
       AND date <= {end:String}
       AND ${idCol} != 0
     GROUP BY id, name
     HAVING kills > 0
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
  const table = getTableName(entityType)
  const idCol = getIdColumn(entityType)
  const nameCol = getNameColumn(entityType)
  const { start, end } = getDateRange(periodType)

  return await database.query<TopBoxWithName>(
    `SELECT
       ${idCol} as id,
       ${nameCol} as name,
       SUM(kills) as kills,
       SUM(losses) as losses,
       SUM(iskDestroyed) as iskDestroyed,
       SUM(iskLost) as iskLost,
       SUM(points) as points
     FROM ${table}
     WHERE date >= {start:String}
       AND date <= {end:String}
       AND ${idCol} != 0
     GROUP BY id, name
     HAVING iskDestroyed > 0
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
  const table = getTableName(entityType)
  const idCol = getIdColumn(entityType)
  const nameCol = getNameColumn(entityType)
  const { start, end } = getDateRange(periodType)

  return await database.query<TopBoxWithName>(
    `SELECT
       ${idCol} as id,
       ${nameCol} as name,
       SUM(kills) as kills,
       SUM(losses) as losses,
       SUM(iskDestroyed) as iskDestroyed,
       SUM(iskLost) as iskLost,
       SUM(points) as points
     FROM ${table}
     WHERE date >= {start:String}
       AND date <= {end:String}
       AND ${idCol} != 0
     GROUP BY id, name
     HAVING points > 0
     ORDER BY points DESC, iskDestroyed DESC
     LIMIT {limit:UInt32}`,
    { start, end, limit }
  )
}

/**
 * Get stats for a specific entity
 */
export async function getEntityTopBoxStats(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance' | 'ship' | 'system' | 'region',
  periodType: 'hour' | 'day' | 'week' | 'month'
): Promise<TopBoxWithName | null> {
  const table = getTableName(entityType)
  const idCol = getIdColumn(entityType)
  const nameCol = getNameColumn(entityType)
  const { start, end } = getDateRange(periodType)

  return await database.queryOne<TopBoxWithName>(
    `SELECT
       ${idCol} as id,
       ${nameCol} as name,
       SUM(kills) as kills,
       SUM(losses) as losses,
       SUM(iskDestroyed) as iskDestroyed,
       SUM(iskLost) as iskLost,
       SUM(points) as points
     FROM ${table}
     WHERE ${idCol} = {entityId:UInt32}
       AND date >= {start:String}
       AND date <= {end:String}
     GROUP BY id, name`,
    { entityId, start, end }
  ) || null
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
  prewhereClause?: string,
  basePrewhereClause?: string
): Promise<Array<{ id: number; name: string; kills: number }>> {
  const trimmedClause = whereClause.trim()
  const clause = trimmedClause.length > 0
    ? `${trimmedClause} AND kl.solarSystemId > 0`
    : 'WHERE kl.solarSystemId > 0'
  const sourceTable = basePrewhereClause
    ? `(SELECT * FROM killlist PREWHERE ${basePrewhereClause}) kl`
    : 'killlist kl'
  const prewhere = prewhereClause && !basePrewhereClause ? `PREWHERE ${prewhereClause}` : ''

  return await database.query<{ id: number; name: string; kills: number }>(
    `SELECT
       kl.solarSystemId as id,
       COALESCE(kl.solarSystemName, 'Unknown') as name,
       count() as kills
     FROM ${sourceTable}
     ${prewhere}
     ${clause}
     GROUP BY kl.solarSystemId, kl.solarSystemName
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
    ? `${trimmedClause} AND kl.regionId > 0`
    : 'WHERE kl.regionId > 0'
  const sourceTable = basePrewhereClause
    ? `(SELECT * FROM killlist PREWHERE ${basePrewhereClause}) kl`
    : 'killlist kl'
  const prewhere = prewhereClause && !basePrewhereClause ? `PREWHERE ${prewhereClause}` : ''

  return await database.query<{ id: number; name: string; kills: number }>(
    `SELECT
       kl.regionId as id,
       COALESCE(kl.regionName, 'Unknown') as name,
       count() as kills
     FROM ${sourceTable}
     ${prewhere}
     ${clause}
     GROUP BY kl.regionId, kl.regionName
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
    ? `${trimmedClause} AND kl.topAttackerCharacterId > 0`
    : 'WHERE kl.topAttackerCharacterId > 0'
  const sourceTable = basePrewhereClause
    ? `(SELECT * FROM killlist PREWHERE ${basePrewhereClause}) kl`
    : 'killlist kl'
  const prewhere = prewhereClause && !basePrewhereClause ? `PREWHERE ${prewhereClause}` : ''

  return await database.query<{ id: number; name: string; kills: number }>(
    `SELECT
       kl.topAttackerCharacterId as id,
       COALESCE(kl.topAttackerCharacterName, 'Unknown') as name,
       count() as kills
     FROM ${sourceTable}
     ${prewhere}
     ${clause}
     GROUP BY kl.topAttackerCharacterId, kl.topAttackerCharacterName
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
    ? `${trimmedClause} AND kl.topAttackerCorporationId > 0`
    : 'WHERE kl.topAttackerCorporationId > 0'
  const sourceTable = basePrewhereClause
    ? `(SELECT * FROM killlist PREWHERE ${basePrewhereClause}) kl`
    : 'killlist kl'
  const prewhere = prewhereClause && !basePrewhereClause ? `PREWHERE ${prewhereClause}` : ''

  return await database.query<{ id: number; name: string; kills: number }>(
    `SELECT
       kl.topAttackerCorporationId as id,
       COALESCE(kl.topAttackerCorporationName, 'Unknown') as name,
       count() as kills
     FROM ${sourceTable}
     ${prewhere}
     ${clause}
     GROUP BY kl.topAttackerCorporationId, kl.topAttackerCorporationName
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
    ? `${trimmedClause} AND kl.topAttackerAllianceId > 0`
    : 'WHERE kl.topAttackerAllianceId > 0'
  const sourceTable = basePrewhereClause
    ? `(SELECT * FROM killlist PREWHERE ${basePrewhereClause}) kl`
    : 'killlist kl'
  const prewhere = prewhereClause && !basePrewhereClause ? `PREWHERE ${prewhereClause}` : ''

  return await database.query<{ id: number; name: string; kills: number }>(
    `SELECT
       kl.topAttackerAllianceId as id,
       COALESCE(kl.topAttackerAllianceName, 'Unknown') as name,
       count() as kills
     FROM ${sourceTable}
     ${prewhere}
     ${clause}
     GROUP BY kl.topAttackerAllianceId, kl.topAttackerAllianceName
     ORDER BY kills DESC
     LIMIT {limit:UInt32}`,
    { ...params, limit }
  )
}

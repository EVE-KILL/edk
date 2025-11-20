import { database } from '../helpers/database'

/**
 * Entity Stats Model
 *
 * Queries the entity_stats_daily_* materialized views
 * Aggregates daily data across time periods (hour/day/week/month/all)
 */

export interface EntityStats {
  entityId: number
  entityType: 'character' | 'corporation' | 'alliance'
  periodType: 'hour' | 'day' | 'week' | 'month' | 'all'

  // Kill/Loss counts
  kills: number
  losses: number

  // ISK statistics
  iskDestroyed: number
  iskLost: number

  // Efficiency metrics
  efficiency: number // (iskDestroyed / (iskDestroyed + iskLost)) * 100
  iskEfficiency: number // (iskDestroyed / (iskDestroyed + iskLost)) * 100
  killLossRatio: number // kills / losses (0 if no losses)

  // Points (for rankings)
  points: number

  // Combat metrics
  soloKills: number
  soloLosses: number
  npcKills: number
  npcLosses: number

  // Ship stats (most used ship in losses)
  topShipTypeId: number
  topShipKills: number

  // Location stats (most active system)
  topSystemId: number
  topSystemKills: number

  // Last activity
  lastKillTime: Date
  lastLossTime: Date
}

/**
 * Get the table name for an entity type
 */
function getTableName(entityType: 'character' | 'corporation' | 'alliance'): string {
  const tableMap = {
    character: 'entity_stats_daily_character',
    corporation: 'entity_stats_daily_corporation',
    alliance: 'entity_stats_daily_alliance',
  }
  return tableMap[entityType]
}

/**
 * Get the ID column name for an entity type
 */
function getIdColumn(entityType: 'character' | 'corporation' | 'alliance'): string {
  const columnMap = {
    character: 'characterId',
    corporation: 'corporationId',
    alliance: 'allianceId',
  }
  return columnMap[entityType]
}

/**
 * Calculate the date range for a period type
 */
function getDateRange(periodType: 'hour' | 'day' | 'week' | 'month' | 'all'): { start: string; end: string } {
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
    case 'all': {
      start.setFullYear(1970, 0, 1)
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
 * Calculate derived stats from raw data
 */
function calculateDerivedStats(stats: any): any {
  const efficiency = (stats.iskDestroyed + stats.iskLost) > 0
    ? (stats.iskDestroyed / (stats.iskDestroyed + stats.iskLost)) * 100
    : 0

  const killLossRatio = stats.losses > 0 ? stats.kills / stats.losses : 0

  return {
    ...stats,
    efficiency,
    iskEfficiency: efficiency,
    killLossRatio
  }
}

/**
 * Get stats for a specific entity
 */
export async function getEntityStats(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  periodType: 'hour' | 'day' | 'week' | 'month' | 'all' = 'all'
): Promise<EntityStats | null> {
  const table = getTableName(entityType)
  const idCol = getIdColumn(entityType)
  const { start, end } = getDateRange(periodType)

  const result = await database.queryOne<any>(
    `SELECT
       {entityId:UInt32} as entityId,
       '{entityType:String}' as entityType,
       '{periodType:String}' as periodType,
       SUM(kills) as kills,
       SUM(losses) as losses,
       SUM(iskDestroyed) as iskDestroyed,
       SUM(iskLost) as iskLost,
       SUM(points) as points,
       SUM(soloKills) as soloKills,
       SUM(soloLosses) as soloLosses,
       SUM(npcKills) as npcKills,
       SUM(npcLosses) as npcLosses,
       max(topShipTypeId) as topShipTypeId,
       max(topShipKills) as topShipKills,
       max(topSystemId) as topSystemId,
       max(topSystemKills) as topSystemKills,
       max(lastKillTime) as lastKillTime,
       max(lastLossTime) as lastLossTime
     FROM ${table}
     WHERE ${idCol} = {entityId:UInt32}
       AND date >= {start:String}
       AND date <= {end:String}
     GROUP BY ${idCol}`,
    { entityId, start, end }
  )

  return result ? calculateDerivedStats(result) : null
}

/**
 * Get stats for multiple entities
 */
export async function getMultipleEntityStats(
  entityIds: number[],
  entityType: 'character' | 'corporation' | 'alliance',
  periodType: 'hour' | 'day' | 'week' | 'month' | 'all' = 'all'
): Promise<EntityStats[]> {
  if (entityIds.length === 0) return []

  const table = getTableName(entityType)
  const idCol = getIdColumn(entityType)
  const { start, end } = getDateRange(periodType)

  const results = await database.query<any>(
    `SELECT
       ${idCol} as entityId,
       '{entityType:String}' as entityType,
       '{periodType:String}' as periodType,
       SUM(kills) as kills,
       SUM(losses) as losses,
       SUM(iskDestroyed) as iskDestroyed,
       SUM(iskLost) as iskLost,
       SUM(points) as points,
       SUM(soloKills) as soloKills,
       SUM(soloLosses) as soloLosses,
       SUM(npcKills) as npcKills,
       SUM(npcLosses) as npcLosses,
       max(topShipTypeId) as topShipTypeId,
       max(topShipKills) as topShipKills,
       max(topSystemId) as topSystemId,
       max(topSystemKills) as topSystemKills,
       max(lastKillTime) as lastKillTime,
       max(lastLossTime) as lastLossTime
     FROM ${table}
     WHERE ${idCol} IN ({ids:Array(UInt32)})
       AND date >= {start:String}
       AND date <= {end:String}
     GROUP BY ${idCol}`,
    { ids: entityIds, start, end }
  )

  return results.map(r => calculateDerivedStats(r))
}

/**
 * Get all period stats for an entity
 */
export async function getAllPeriodStats(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance'
): Promise<EntityStats[]> {
  const periods: Array<'hour' | 'day' | 'week' | 'month' | 'all'> = ['hour', 'day', 'week', 'month', 'all']
  const results: EntityStats[] = []

  for (const period of periods) {
    const stat = await getEntityStats(entityId, entityType, period)
    if (stat) {
      results.push(stat)
    }
  }

  return results
}

/**
 * Get top entities by kills for a period
 */
export async function getTopEntitiesByKills(
  entityType: 'character' | 'corporation' | 'alliance',
  periodType: 'hour' | 'day' | 'week' | 'month' | 'all',
  limit: number = 100
): Promise<EntityStats[]> {
  const table = getTableName(entityType)
  const idCol = getIdColumn(entityType)
  const { start, end } = getDateRange(periodType)

  const results = await database.query<any>(
    `SELECT
       ${idCol} as entityId,
       '{entityType:String}' as entityType,
       '{periodType:String}' as periodType,
       SUM(kills) as kills,
       SUM(losses) as losses,
       SUM(iskDestroyed) as iskDestroyed,
       SUM(iskLost) as iskLost,
       SUM(points) as points,
       SUM(soloKills) as soloKills,
       SUM(soloLosses) as soloLosses,
       SUM(npcKills) as npcKills,
       SUM(npcLosses) as npcLosses,
       max(topShipTypeId) as topShipTypeId,
       max(topShipKills) as topShipKills,
       max(topSystemId) as topSystemId,
       max(topSystemKills) as topSystemKills,
       max(lastKillTime) as lastKillTime,
       max(lastLossTime) as lastLossTime
     FROM ${table}
     WHERE date >= {start:String}
       AND date <= {end:String}
       AND ${idCol} > 0
     GROUP BY ${idCol}
     HAVING kills > 0
     ORDER BY kills DESC
     LIMIT {limit:UInt32}`,
    { start, end, limit }
  )

  return results.map(r => calculateDerivedStats(r))
}

/**
 * Get top entities by efficiency
 */
export async function getTopEntitiesByEfficiency(
  entityType: 'character' | 'corporation' | 'alliance',
  periodType: 'hour' | 'day' | 'week' | 'month' | 'all',
  minKills: number = 10,
  limit: number = 100
): Promise<EntityStats[]> {
  const table = getTableName(entityType)
  const idCol = getIdColumn(entityType)
  const { start, end } = getDateRange(periodType)

  const results = await database.query<any>(
    `SELECT
       ${idCol} as entityId,
       '{entityType:String}' as entityType,
       '{periodType:String}' as periodType,
       SUM(kills) as kills,
       SUM(losses) as losses,
       SUM(iskDestroyed) as iskDestroyed,
       SUM(iskLost) as iskLost,
       SUM(points) as points,
       SUM(soloKills) as soloKills,
       SUM(soloLosses) as soloLosses,
       SUM(npcKills) as npcKills,
       SUM(npcLosses) as npcLosses,
       max(topShipTypeId) as topShipTypeId,
       max(topShipKills) as topShipKills,
       max(topSystemId) as topSystemId,
       max(topSystemKills) as topSystemKills,
       max(lastKillTime) as lastKillTime,
       max(lastLossTime) as lastLossTime
     FROM ${table}
     WHERE date >= {start:String}
       AND date <= {end:String}
       AND ${idCol} > 0
     GROUP BY ${idCol}
     HAVING kills >= {minKills:UInt32}
     ORDER BY efficiency DESC
     LIMIT {limit:UInt32}`,
    { start, end, minKills, limit }
  )

  return results
    .map(r => calculateDerivedStats(r))
    .sort((a, b) => b.efficiency - a.efficiency)
}


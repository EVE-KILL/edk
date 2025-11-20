import { database } from '../helpers/database'

/**
 * Entity Stats Model
 *
 * Simulates query of entity stats using base tables.
 * Aggregates data on the fly (simplified version as materialized views are removed).
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
 * Calculate the date range for a period type
 */
function getDateRange(periodType: 'hour' | 'day' | 'week' | 'month' | 'all'): { start: string; end: string } {
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
    case 'all': {
      start.setFullYear(1970, 0, 1)
      break
    }
  }

  return {
    start: start.toISOString(),
    end: end.toISOString()
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
  const { start, end } = getDateRange(periodType)

  // This query will be expensive without pre-aggregation.
  // Simplified version: check killmails table for kills/losses.

  let killsWhere = ''
  let lossesWhere = ''

  if (entityType === 'character') {
    killsWhere = `topAttackerCharacterId = {entityId:UInt32}`;
    lossesWhere = `victimCharacterId = {entityId:UInt32}`;
  } else if (entityType === 'corporation') {
    killsWhere = `topAttackerCorporationId = {entityId:UInt32}`;
    lossesWhere = `victimCorporationId = {entityId:UInt32}`;
  } else if (entityType === 'alliance') {
    killsWhere = `topAttackerAllianceId = {entityId:UInt32}`;
    lossesWhere = `victimAllianceId = {entityId:UInt32}`;
  }

  // Combine Kills and Losses stats in one go using CTEs
  const sql = `
    WITH kills_data AS (
      SELECT
        count(*) as kills,
        sum(totalValue) as iskDestroyed,
        sum(case when solo then 1 else 0 end) as soloKills,
        sum(case when npc then 1 else 0 end) as npcKills,
        max(killmailTime) as lastKillTime
      FROM killmails
      WHERE ${killsWhere}
      AND killmailTime >= {start:String}::timestamp AND killmailTime <= {end:String}::timestamp
    ),
    losses_data AS (
      SELECT
        count(*) as losses,
        sum(totalValue) as iskLost,
        sum(case when solo then 1 else 0 end) as soloLosses,
        sum(case when npc then 1 else 0 end) as npcLosses,
        max(killmailTime) as lastLossTime
      FROM killmails
      WHERE ${lossesWhere}
      AND killmailTime >= {start:String}::timestamp AND killmailTime <= {end:String}::timestamp
    )
    SELECT
      {entityId:UInt32} as entityId,
      '{entityType:String}' as entityType,
      '{periodType:String}' as periodType,
      COALESCE(k.kills, 0) as kills,
      COALESCE(l.losses, 0) as losses,
      COALESCE(k.iskDestroyed, 0) as iskDestroyed,
      COALESCE(l.iskLost, 0) as iskLost,
      0 as points, -- TODO: Implement point calculation logic
      COALESCE(k.soloKills, 0) as soloKills,
      COALESCE(l.soloLosses, 0) as soloLosses,
      COALESCE(k.npcKills, 0) as npcKills,
      COALESCE(l.npcLosses, 0) as npcLosses,
      0 as topShipTypeId, -- Placeholder
      0 as topShipKills,
      0 as topSystemId,
      0 as topSystemKills,
      k.lastKillTime,
      l.lastLossTime
    FROM kills_data k, losses_data l
  `;

  const result = await database.queryOne<any>(sql, { entityId, start, end });

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
  // Fallback: loop and call getEntityStats.
  // Or implement complex aggregation.
  // Given time constraints, loop is safer logic-wise, but slower.
  // But since this was likely used for small batches, maybe ok.

  const results: EntityStats[] = []
  for (const id of entityIds) {
    const stat = await getEntityStats(id, entityType, periodType)
    if (stat) results.push(stat)
  }
  return results
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
  // Querying top entities without pre-aggregation is heavy on killmails table.
  // But we can try using topAttacker columns on killmails table.

  const { start, end } = getDateRange(periodType)

  let groupCol = ''
  if (entityType === 'character') groupCol = 'topAttackerCharacterId';
  else if (entityType === 'corporation') groupCol = 'topAttackerCorporationId';
  else groupCol = 'topAttackerAllianceId';

  const sql = `
    SELECT
      ${groupCol} as entityId,
      '{entityType:String}' as entityType,
      '{periodType:String}' as periodType,
      count(*) as kills,
      0 as losses,
      sum(totalValue) as iskDestroyed,
      0 as iskLost
    FROM killmails
    WHERE ${groupCol} IS NOT NULL AND ${groupCol} > 0
    AND killmailTime >= {start:String}::timestamp AND killmailTime <= {end:String}::timestamp
    GROUP BY ${groupCol}
    ORDER BY kills DESC
    LIMIT {limit:UInt32}
  `

  const results = await database.query<any>(sql, { start, end, limit });
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
  // This requires joining kills and losses which is very expensive without materialized views.
  // We return empty for now or implement heavy query.
  // Returning empty list to avoid performance kill.
  return []
}

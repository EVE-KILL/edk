import { database } from '../helpers/database'

/**
 * Entity Activity Daily Model
 *
 * Queries the entity_activity_daily materialized view
 * Tracks daily activity patterns for characters, corporations, and alliances
 */

export interface EntityActivityDaily {
  entityId: number
  entityType: 'character' | 'corporation' | 'alliance'
  activityDate: Date

  // Activity counts
  kills: number
  losses: number

  // ISK values
  iskDestroyed: number
  iskLost: number

  // Active hours bitmap (24 bits for 24 hours)
  activeHours: number

  // Unique opponents
  uniqueVictims: number
  uniqueAttackers: number

  // Combat style
  soloKills: number
  gangKills: number
}

/**
 * Get activity for a specific entity and date
 */
export async function getEntityActivity(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  activityDate: Date
): Promise<EntityActivityDaily | null> {
  return await database.queryOne<EntityActivityDaily>(
    `SELECT * FROM entity_activity_daily
     WHERE entityId = {entityId:UInt32}
       AND entityType = {entityType:String}
       AND activityDate = {activityDate:Date}`,
    { entityId, entityType, activityDate: activityDate.toISOString().split('T')[0] }
  )
}

/**
 * Get activity timeline for an entity within a date range
 */
export async function getEntityActivityRange(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  startDate: Date,
  endDate: Date
): Promise<EntityActivityDaily[]> {
  return await database.query<EntityActivityDaily>(
    `SELECT * FROM entity_activity_daily
     WHERE entityId = {entityId:UInt32}
       AND entityType = {entityType:String}
       AND activityDate BETWEEN {startDate:Date} AND {endDate:Date}
     ORDER BY activityDate ASC`,
    {
      entityId,
      entityType,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    }
  )
}

/**
 * Get recent activity for an entity (last N days)
 */
export async function getRecentEntityActivity(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  days: number = 30
): Promise<EntityActivityDaily[]> {
  return await database.query<EntityActivityDaily>(
    `SELECT * FROM entity_activity_daily
     WHERE entityId = {entityId:UInt32}
       AND entityType = {entityType:String}
       AND activityDate >= today() - {days:UInt32}
     ORDER BY activityDate DESC`,
    { entityId, entityType, days }
  )
}

/**
 * Get monthly activity timeline for an entity
 */
export async function getEntityMonthlyActivity(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  year: number,
  month: number
): Promise<EntityActivityDaily[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endOfMonth = new Date(year, month, 0) // Day 0 = last day of previous month
  const endDate = `${year}-${String(month).padStart(2, '0')}-${endOfMonth.getDate()}`

  return await database.query<EntityActivityDaily>(
    `SELECT * FROM entity_activity_daily
     WHERE entityId = {entityId:UInt32}
       AND entityType = {entityType:String}
       AND activityDate BETWEEN {startDate:Date} AND {endDate:Date}
     ORDER BY activityDate ASC`,
    { entityId, entityType, startDate, endDate }
  )
}

/**
 * Get aggregated activity statistics across a date range
 */
export async function getEntityActivitySummary(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  startDate: Date,
  endDate: Date
) {
  return await database.queryOne<{
    totalKills: number
    totalLosses: number
    totalIskDestroyed: number
    totalIskLost: number
    activeDays: number
    totalSoloKills: number
    totalGangKills: number
  }>(
    `SELECT
       sum(kills) as totalKills,
       sum(losses) as totalLosses,
       sum(iskDestroyed) as totalIskDestroyed,
       sum(iskLost) as totalIskLost,
       count() as activeDays,
       sum(soloKills) as totalSoloKills,
       sum(gangKills) as totalGangKills
     FROM entity_activity_daily
     WHERE entityId = {entityId:UInt32}
       AND entityType = {entityType:String}
       AND activityDate BETWEEN {startDate:Date} AND {endDate:Date}`,
    {
      entityId,
      entityType,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    }
  )
}

/**
 * Get entities with activity on a specific date
 */
export async function getActiveEntitiesOnDate(
  entityType: 'character' | 'corporation' | 'alliance',
  activityDate: Date,
  limit: number = 100
): Promise<EntityActivityDaily[]> {
  return await database.query<EntityActivityDaily>(
    `SELECT * FROM entity_activity_daily
     WHERE entityType = {entityType:String}
       AND activityDate = {activityDate:Date}
       AND (kills > 0 OR losses > 0)
     ORDER BY (kills + losses) DESC
     LIMIT {limit:UInt32}`,
    { entityType, activityDate: activityDate.toISOString().split('T')[0], limit }
  )
}

/**
 * Parse active hours bitmap into array of active hours (0-23)
 */
export function parseActiveHours(activeHours: number): number[] {
  const hours: number[] = []
  for (let i = 0; i < 24; i++) {
    if ((activeHours & (1 << i)) !== 0) {
      hours.push(i)
    }
  }
  return hours
}

/**
 * Get most active hours for an entity across date range
 */
export async function getEntityMostActiveHours(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  startDate: Date,
  endDate: Date
): Promise<{ hour: number; activityCount: number }[]> {
  // Query to count which hours have the most activity
  const result = await database.query<{ hour: number; activityCount: number }>(
    `SELECT
       arrayJoin(range(24)) as hour,
       sumIf(1, bitAnd(activeHours, bitShiftLeft(1, hour)) != 0) as activityCount
     FROM entity_activity_daily
     WHERE entityId = {entityId:UInt32}
       AND entityType = {entityType:String}
       AND activityDate BETWEEN {startDate:Date} AND {endDate:Date}
     GROUP BY hour
     ORDER BY activityCount DESC`,
    {
      entityId,
      entityType,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    }
  )

  return result
}

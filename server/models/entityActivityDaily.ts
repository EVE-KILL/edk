import { database } from '../helpers/database'

/**
 * Entity Activity Daily Model
 *
 * Simulates query of entity activity daily view using base tables.
 * (Materialized view entity_activity_daily removed)
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
  // Return null for now to avoid heavy queries on base tables
  return null
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
    // Calculating daily stats from raw killmails on the fly is too heavy for this task scope without materialized views.
    // If needed, we would aggregate killmails GROUP BY date.

    // Attempting a simplified aggregation for kills only (ignoring hours/unique opponents for perf)

    let entityCol = ''
    if (entityType === 'character') entityCol = 'topAttackerCharacterId';
    else if (entityType === 'corporation') entityCol = 'topAttackerCorporationId';
    else entityCol = 'topAttackerAllianceId';

    // Use Postgres date_trunc
    return await database.sql<EntityActivityDaily[]>`
        SELECT
          ${entityId} as "entityId",
          ${entityType} as "entityType",
          date_trunc('day', "killmailTime") as "activityDate",
          count(*) as kills,
          0 as losses,
          sum("totalValue") as "iskDestroyed",
          0 as "iskLost",
          0 as "activeHours",
          0 as "uniqueVictims",
          0 as "uniqueAttackers",
          sum(case when solo then 1 else 0 end) as "soloKills",
          0 as "gangKills"
        FROM killmails
        WHERE ${database.sql(entityCol)} = ${entityId}
          AND "killmailTime" >= ${startDate} AND "killmailTime" <= ${endDate}
        GROUP BY 3
        ORDER BY 3 ASC
    `
}

/**
 * Get recent activity for an entity (last N days)
 */
export async function getRecentEntityActivity(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  days: number = 30
): Promise<EntityActivityDaily[]> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  const endDate = new Date()

  return getEntityActivityRange(entityId, entityType, startDate, endDate)
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
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0)

  return getEntityActivityRange(entityId, entityType, startDate, endDate)
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
    // Simplified summary from killmails table (kills only for now)
    let entityCol = ''
    if (entityType === 'character') entityCol = 'topAttackerCharacterId';
    else if (entityType === 'corporation') entityCol = 'topAttackerCorporationId';
    else entityCol = 'topAttackerAllianceId';

  const [result] = await database.sql<{
    totalKills: number
    totalLosses: number
    totalIskDestroyed: number
    totalIskLost: number
    activeDays: number
    totalSoloKills: number
    totalGangKills: number
  }[]>`
    SELECT
       count(*) as "totalKills",
       0 as "totalLosses",
       coalesce(sum("totalValue"), 0) as "totalIskDestroyed",
       0 as "totalIskLost",
       count(DISTINCT date_trunc('day', "killmailTime")) as "activeDays",
       sum(case when solo then 1 else 0 end) as "totalSoloKills",
       0 as "totalGangKills"
     FROM killmails
     WHERE ${database.sql(entityCol)} = ${entityId}
       AND "killmailTime" >= ${startDate} AND "killmailTime" <= ${endDate}
  `
  return result
}

/**
 * Get entities with activity on a specific date
 */
export async function getActiveEntitiesOnDate(
  entityType: 'character' | 'corporation' | 'alliance',
  activityDate: Date,
  limit: number = 100
): Promise<EntityActivityDaily[]> {
  return []
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
    let entityCol = ''
    if (entityType === 'character') entityCol = 'topAttackerCharacterId';
    else if (entityType === 'corporation') entityCol = 'topAttackerCorporationId';
    else entityCol = 'topAttackerAllianceId';

  // Query to count which hours have the most activity using EXTRACT(HOUR FROM ...)
  const result = await database.sql<{ hour: number; activityCount: number }[]>`
    SELECT
       EXTRACT(HOUR FROM "killmailTime") as hour,
       count(*) as "activityCount"
     FROM killmails
     WHERE ${database.sql(entityCol)} = ${entityId}
       AND "killmailTime" >= ${startDate} AND "killmailTime" <= ${endDate}
     GROUP BY hour
     ORDER BY "activityCount" DESC
  `

  return result
}

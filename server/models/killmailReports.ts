import { database } from '../helpers/database'

/**
 * Killmail Reports Model
 *
 * Queries the killmail_reports materialized view
 * Contains daily aggregated statistics for entity kill reports
 */

export interface KillmailReport {
  entityId: number
  entityType: 'character' | 'corporation' | 'alliance'
  reportDate: Date

  // Basic counts
  kills: number
  losses: number

  // ISK values
  iskDestroyed: number
  iskLost: number
  efficiency: number

  // Ship breakdown (JSON strings - need to parse)
  shipStats: string // [{shipTypeId, kills, losses, iskDestroyed, iskLost}]
  systemStats: string // [{solarSystemId, kills, losses}]

  // Hourly activity arrays (0-23)
  hourlyKills: number[]
  hourlyLosses: number[]

  // Combat style metrics
  soloKills: number
  soloLosses: number
  gangKills: number
  gangLosses: number

  // Weapon breakdown (JSON string)
  weaponStats: string // [{weaponTypeId, kills}]
}

export interface ShipStat {
  shipTypeId: number
  kills: number
  losses: number
  iskDestroyed: number
  iskLost: number
}

export interface SystemStat {
  solarSystemId: number
  kills: number
  losses: number
}

export interface WeaponStat {
  weaponTypeId: number
  kills: number
}

/**
 * Get report for a specific entity and date
 */
export async function getEntityReport(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  reportDate: Date
): Promise<KillmailReport | null> {
  const [row] = await database.sql<KillmailReport[]>`
    SELECT * FROM killmail_reports
     WHERE "entityId" = ${entityId}
       AND "entityType" = ${entityType}
       AND "reportDate" = ${reportDate.toISOString().split('T')[0]}
  `
  return row || null
}

/**
 * Get reports for an entity within a date range
 */
export async function getEntityReportRange(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  startDate: Date,
  endDate: Date
): Promise<KillmailReport[]> {
  return await database.sql<KillmailReport[]>`
    SELECT * FROM killmail_reports
     WHERE "entityId" = ${entityId}
       AND "entityType" = ${entityType}
       AND "reportDate" BETWEEN ${startDate.toISOString().split('T')[0]} AND ${endDate.toISOString().split('T')[0]}
     ORDER BY "reportDate" DESC
  `
}

/**
 * Get recent reports for an entity (last N days)
 */
export async function getRecentEntityReports(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  days: number = 7
): Promise<KillmailReport[]> {
  return await database.sql<KillmailReport[]>`
    SELECT * FROM killmail_reports
     WHERE "entityId" = ${entityId}
       AND "entityType" = ${entityType}
       AND "reportDate" >= CURRENT_DATE - (${days} || ' days')::interval
     ORDER BY "reportDate" DESC
  `
}

/**
 * Get monthly summary for an entity
 */
export async function getEntityMonthlyReports(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  year: number,
  month: number
): Promise<KillmailReport[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endOfMonth = new Date(year, month, 0) // Day 0 = last day of previous month
  const endDate = `${year}-${String(month).padStart(2, '0')}-${endOfMonth.getDate()}`

  return await database.sql<KillmailReport[]>`
    SELECT * FROM killmail_reports
     WHERE "entityId" = ${entityId}
       AND "entityType" = ${entityType}
       AND "reportDate" BETWEEN ${startDate} AND ${endDate}
     ORDER BY "reportDate" ASC
  `
}

/**
 * Get aggregated statistics for an entity across a date range
 */
export async function getEntityAggregatedStats(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  startDate: Date,
  endDate: Date
) {
  const [result] = await database.sql<{
    kills: number
    losses: number
    iskDestroyed: number
    iskLost: number
    efficiency: number
    soloKills: number
    soloLosses: number
  }[]>`
    SELECT
       sum(kills) as kills,
       sum(losses) as losses,
       sum("iskDestroyed") as "iskDestroyed",
       sum("iskLost") as "iskLost",
       (sum("iskDestroyed") / (sum("iskDestroyed") + sum("iskLost"))) * 100 as efficiency,
       sum("soloKills") as "soloKills",
       sum("soloLosses") as "soloLosses"
     FROM killmail_reports
     WHERE "entityId" = ${entityId}
       AND "entityType" = ${entityType}
       AND "reportDate" BETWEEN ${startDate.toISOString().split('T')[0]} AND ${endDate.toISOString().split('T')[0]}
  `
  return result
}

/**
 * Parse ship stats JSON
 */
export function parseShipStats(shipStats: string): ShipStat[] {
  try {
    return JSON.parse(shipStats) as ShipStat[]
  } catch {
    return []
  }
}

/**
 * Parse system stats JSON
 */
export function parseSystemStats(systemStats: string): SystemStat[] {
  try {
    return JSON.parse(systemStats) as SystemStat[]
  } catch {
    return []
  }
}

/**
 * Parse weapon stats JSON
 */
export function parseWeaponStats(weaponStats: string): WeaponStat[] {
  try {
    return JSON.parse(weaponStats) as WeaponStat[]
  } catch {
    return []
  }
}

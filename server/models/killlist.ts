import { database } from '../helpers/database'

/**
 * Killlist Model
 *
 * Queries killmail data from the `kill_list` materialized view.
 */

// This interface matches the raw, un-named columns from the old queries.
// It can be phased out, but is kept for compatibility during refactoring.
export interface KilllistRow {
  killmailId: number
  killmailTime: Date
  solarSystemId: number
  regionId: number
  security: number
  victimCharacterId: number | null
  victimCorporationId: number
  victimAllianceId: number | null
  victimShipTypeId: number
  victimShipGroupId: number
  victimDamageTaken: number
  topAttackerCharacterId: number | null
  topAttackerCorporationId: number | null
  topAttackerAllianceId: number | null
  topAttackerShipTypeId: number | null
  totalValue: number
  attackerCount: number
  npc: boolean
  solo: boolean
  awox: boolean
}

// This interface matches the columns from the `kill_list` materialized view
export interface EntityKillmail {
  killmailId: number
  killmailTime: string
  victimCharacterId: number | null
  victimCharacterName: string
  victimCorporationId: number
  victimCorporationName: string
  victimCorporationTicker: string
  victimAllianceId: number | null
  victimAllianceName: string | null
  victimAllianceTicker: string | null
  victimShipTypeId: number
  victimShipName: string
  victimShipGroup: string
  victimShipGroupId: number

  attackerCharacterId: number | null
  attackerCharacterName: string
  attackerCorporationId: number | null
  attackerCorporationName: string
  attackerCorporationTicker: string
  attackerAllianceId: number | null
  attackerAllianceName: string | null
  attackerAllianceTicker: string | null
  attackerShipTypeId: number | null
  attackerShipName: string | null

  solarSystemId: number
  regionId: number
  security: number
  solarSystemName: string
  regionName: string

  totalValue: number
  attackerCount: number
  npc: boolean
  solo: boolean
  awox: boolean
}

const BIG_SHIP_GROUP_IDS = [547, 485, 513, 902, 941, 30, 659]
const WORMHOLE_REGION_MIN = 11000001
const WORMHOLE_REGION_MAX = 11000033
const ABYSSAL_REGION_MIN = 12000000
const ABYSSAL_REGION_MAX = 13000000
const POCHVEN_REGION_ID = 10000070

function buildSpaceTypeCondition(spaceType: string, alias: string = 'k'): any {
  const securityColumn = database.sql`${database.sql(alias)}.security`
  const regionColumn = database.sql`${database.sql(alias)}."regionId"`

  switch (spaceType) {
    case 'highsec':
      return database.sql`${securityColumn} >= 0.45`
    case 'lowsec':
      return database.sql`${securityColumn} >= 0.0 AND ${securityColumn} < 0.45`
    case 'nullsec':
      return database.sql`${securityColumn} < 0.0 AND (${regionColumn} < ${WORMHOLE_REGION_MIN} OR ${regionColumn} > ${WORMHOLE_REGION_MAX})`
    case 'w-space':
    case 'wormhole':
      return database.sql`${regionColumn} BETWEEN ${WORMHOLE_REGION_MIN} AND ${WORMHOLE_REGION_MAX}`
    case 'abyssal':
      return database.sql`${regionColumn} BETWEEN ${ABYSSAL_REGION_MIN} AND ${ABYSSAL_REGION_MAX}`
    case 'pochven':
      return database.sql`${regionColumn} = ${POCHVEN_REGION_ID}`
    default:
      return null
  }
}

export function buildKilllistConditions(
  filters: KilllistFilters,
  alias: string = 'k'
): any[] {
  const conditions: any[] = []
  const prefix = database.sql(alias)

  if (filters.spaceType) {
    const spaceTypeCondition = buildSpaceTypeCondition(filters.spaceType, alias)
    if (spaceTypeCondition) {
      conditions.push(spaceTypeCondition)
    }
  }

  if (filters.isSolo !== undefined) {
    conditions.push(database.sql`${prefix}.solo = ${filters.isSolo}`)
  }

  if (filters.isBig !== undefined) {
    const column = database.sql`${prefix}."victimShipGroupId"`
    if (filters.isBig) {
      conditions.push(database.sql`${column} = ANY(${BIG_SHIP_GROUP_IDS})`)
    } else {
      conditions.push(database.sql`${column} != ALL(${BIG_SHIP_GROUP_IDS})`)
    }
  }

  if (filters.isNpc !== undefined) {
    conditions.push(database.sql`${prefix}.npc = ${filters.isNpc}`)
  }

  if (filters.minValue !== undefined) {
    conditions.push(database.sql`${prefix}."totalValue" >= ${filters.minValue}`)
  }

  if (filters.shipGroupIds && filters.shipGroupIds.length > 0) {
    conditions.push(database.sql`${prefix}."victimShipGroupId" = ANY(${filters.shipGroupIds})`)
  }

  if (filters.minSecurityStatus !== undefined) {
    conditions.push(database.sql`${prefix}.security >= ${filters.minSecurityStatus}`)
  }

  if (filters.maxSecurityStatus !== undefined) {
    conditions.push(database.sql`${prefix}.security <= ${filters.maxSecurityStatus}`)

    if (filters.maxSecurityStatus <= 0) {
      conditions.push(database.sql`(${prefix}."regionId" < ${WORMHOLE_REGION_MIN} OR ${prefix}."regionId" > ${WORMHOLE_REGION_MAX})`)
    }
  }

  if (filters.regionId !== undefined) {
    conditions.push(database.sql`${prefix}."regionId" = ${filters.regionId}`)
  }

  if (filters.solarSystemId !== undefined) {
    conditions.push(database.sql`${prefix}."solarSystemId" = ${filters.solarSystemId}`)
  }

  return conditions
}

/**
 * Filter options for killlist queries
 */
export interface KilllistFilters {
  spaceType?: string
  isSolo?: boolean
  isBig?: boolean
  isNpc?: boolean
  minValue?: number
  shipGroupIds?: number[]
  minSecurityStatus?: number
  maxSecurityStatus?: number
  regionId?: number
  solarSystemId?: number
}

/**
 * Helper to combine conditions into a WHERE clause
 */
function conditionsToWhere(conditions: any[]): any {
  return conditions.length > 0
    ? database.sql`WHERE ${database.sql(conditions, ' AND ')}`
    : database.sql``
}

/**
 * Get filtered kills with pagination from the materialized view
 */
export async function getFilteredKills(
  filters: KilllistFilters,
  page: number = 1,
  perPage: number = 50
): Promise<KilllistRow[]> {
  const offset = (page - 1) * perPage
  const conditions = buildKilllistConditions(filters, 'k')
  const where = conditionsToWhere(conditions)

  // Note: This still returns the old `KilllistRow` for compatibility.
  // The new `getFilteredKillsWithNames` is preferred.
  return await database.sql<KilllistRow[]>`
    SELECT *
     FROM kill_list k
     ${where}
     ORDER BY k."killmailTime" DESC, k."killmailId" DESC
     LIMIT ${perPage} OFFSET ${offset}
  `
}

/**
 * Get filtered kills with all names joined from the materialized view
 */
export async function getFilteredKillsWithNames(
  filters: KilllistFilters,
  page: number = 1,
  perPage: number = 50
): Promise<EntityKillmail[]> {
  const offset = (page - 1) * perPage
  const conditions = buildKilllistConditions(filters, 'k')
  const where = conditionsToWhere(conditions)

  return await database.sql<EntityKillmail[]>`
    SELECT *
    FROM kill_list k
    ${where}
    ORDER BY k."killmailTime" DESC, k."killmailId" DESC
    LIMIT ${perPage} OFFSET ${offset}
  `
}

/**
 * Count filtered kills from the materialized view
 */
export async function countFilteredKills(filters: KilllistFilters): Promise<number> {
  const conditions = buildKilllistConditions(filters, 'k')
  const where = conditionsToWhere(conditions)

  const [result] = await database.sql<{count: string}[]>`
    SELECT count(*) as count
     FROM kill_list k
     ${where}
  `
  return Number(result?.count || 0)
}

/**
 * Get killmails where entity was attacker (kills) or victim (losses) or both (all)
 * Detailed view with names, from the materialized view.
 */
export async function getEntityKillmails(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  mode: 'kills' | 'losses' | 'all',
  page: number = 1,
  perPage: number = 30
): Promise<EntityKillmail[]> {
  const offset = (page - 1) * perPage
  const conditions: any[] = []

  if (mode === 'kills') {
    if (entityType === 'character') {
      conditions.push(database.sql`"attackerCharacterId" = ${entityId}`)
    } else if (entityType === 'corporation') {
      conditions.push(database.sql`"attackerCorporationId" = ${entityId}`)
    } else if (entityType === 'alliance') {
      conditions.push(database.sql`"attackerAllianceId" = ${entityId}`)
    }
  } else if (mode === 'losses') {
    if (entityType === 'character') {
      conditions.push(database.sql`"victimCharacterId" = ${entityId}`)
    } else if (entityType === 'corporation') {
      conditions.push(database.sql`"victimCorporationId" = ${entityId}`)
    } else if (entityType === 'alliance') {
      conditions.push(database.sql`"victimAllianceId" = ${entityId}`)
    }
  } else { // all
    if (entityType === 'character') {
      conditions.push(database.sql`("victimCharacterId" = ${entityId} OR "attackerCharacterId" = ${entityId})`)
    } else if (entityType === 'corporation') {
      conditions.push(database.sql`("victimCorporationId" = ${entityId} OR "attackerCorporationId" = ${entityId})`)
    } else if (entityType === 'alliance') {
      conditions.push(database.sql`("victimAllianceId" = ${entityId} OR "attackerAllianceId" = ${entityId})`)
    }
  }

  const where = conditionsToWhere(conditions)

  return await database.sql<EntityKillmail[]>`
    SELECT *
    FROM kill_list
    ${where}
    ORDER BY "killmailTime" DESC, "killmailId" DESC
    LIMIT ${perPage} OFFSET ${offset}
  `
}

/**
 * Count entity killmails from the materialized view
 */
export async function countEntityKillmails(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  mode: 'kills' | 'losses' | 'all'
): Promise<number> {
    const conditions: any[] = []

  if (mode === 'kills') {
    if (entityType === 'character') {
      conditions.push(database.sql`"attackerCharacterId" = ${entityId}`)
    } else if (entityType === 'corporation') {
      conditions.push(database.sql`"attackerCorporationId" = ${entityId}`)
    } else if (entityType === 'alliance') {
      conditions.push(database.sql`"attackerAllianceId" = ${entityId}`)
    }
  } else if (mode === 'losses') {
    if (entityType === 'character') {
      conditions.push(database.sql`"victimCharacterId" = ${entityId}`)
    } else if (entityType === 'corporation') {
      conditions.push(database.sql`"victimCorporationId" = ${entityId}`)
    } else if (entityType === 'alliance') {
      conditions.push(database.sql`"victimAllianceId" = ${entityId}`)
    }
  } else { // all
    if (entityType === 'character') {
      conditions.push(database.sql`("victimCharacterId" = ${entityId} OR "attackerCharacterId" = ${entityId})`)
    } else if (entityType === 'corporation') {
      conditions.push(database.sql`("victimCorporationId" = ${entityId} OR "attackerCorporationId" = ${entityId})`)
    } else if (entityType === 'alliance') {
      conditions.push(database.sql`("victimAllianceId" = ${entityId} OR "attackerAllianceId" = ${entityId})`)
    }
  }

  const where = conditionsToWhere(conditions)

  const [result] = await database.sql<{count: string}[]>`
    SELECT count(*) as count
    FROM kill_list
    ${where}
  `
  return Number(result?.count || 0)
}

/**
 * Get most valuable kills
 */
export async function getMostValuableKills(
  limit: number = 50,
  hoursAgo: number = 168 // 7 days default
): Promise<EntityKillmail[]> {
  return await database.sql<EntityKillmail[]>`
    SELECT *
     FROM kill_list
     WHERE "killmailTime" >= NOW() - (${hoursAgo} || ' hours')::interval
     ORDER BY "totalValue" DESC, "killmailTime" DESC
     LIMIT ${limit}
  `
}

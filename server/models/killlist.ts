import { database } from '../helpers/database'

/**
 * Killlist Model
 *
 * Queries the killlist materialized view for killmail list displays
 * This table contains pre-joined and denormalized killmail data
 */

export interface KilllistRow {
  killmailId: number
  killmailTime: Date

  // Location
  solarSystemId: number
  regionId: number
  security: number

  // Victim info
  victimCharacterId: number | null
  victimCorporationId: number
  victimAllianceId: number | null
  victimShipTypeId: number
  victimShipGroupId: number
  victimDamageTaken: number

  // Attacker info (top attacker)
  topAttackerCharacterId: number | null
  topAttackerCorporationId: number | null
  topAttackerAllianceId: number | null
  topAttackerShipTypeId: number | null

  // Value and counts
  totalValue: number
  attackerCount: number

  // Flags
  npc: boolean
  solo: boolean
  awox: boolean

  // Entity tracking
  entityId: number
  entityType: 'none' | 'character' | 'corporation' | 'alliance'
  isVictim: boolean
}

const BIG_SHIP_GROUP_IDS = [547, 485, 513, 902, 941, 30, 659]
const WORMHOLE_REGION_MIN = 11000001
const WORMHOLE_REGION_MAX = 11000033
const ABYSSAL_REGION_MIN = 12000000
const ABYSSAL_REGION_MAX = 13000000
const POCHVEN_REGION_ID = 10000070

function buildSpaceTypeCondition(spaceType: string, prefix: string): string | null {
  const securityColumn = `${prefix}security`
  const regionColumn = `${prefix}regionId`

  switch (spaceType) {
    case 'highsec':
      return `${securityColumn} >= 0.45`
    case 'lowsec':
      return `${securityColumn} >= 0.0 AND ${securityColumn} < 0.45`
    case 'nullsec':
      return `${securityColumn} < 0.0 AND (${regionColumn} < ${WORMHOLE_REGION_MIN} OR ${regionColumn} > ${WORMHOLE_REGION_MAX})`
    case 'w-space':
    case 'wormhole':
      return `${regionColumn} BETWEEN ${WORMHOLE_REGION_MIN} AND ${WORMHOLE_REGION_MAX}`
    case 'abyssal':
      return `${regionColumn} BETWEEN ${ABYSSAL_REGION_MIN} AND ${ABYSSAL_REGION_MAX}`
    case 'pochven':
      return `${regionColumn} = ${POCHVEN_REGION_ID}`
    default:
      return null
  }
}

export function buildKilllistWhereClause(
  filters: KilllistFilters,
  alias: string = '',
  includeEntityTypeFilter: boolean = true
): {
  clause: string
  params: Record<string, unknown>
  prewhereClause?: string
  basePrewhereClause?: string
} {
  const prefix = alias ? `${alias}.` : ''
  const conditions: string[] = []
  const params: Record<string, unknown> = {}
  let prewhereClause: string | undefined
  let basePrewhereClause: string | undefined

  if (includeEntityTypeFilter) {
    basePrewhereClause = 'entityType = {entityType:String} AND isVictim = 0'
    prewhereClause = `${prefix}entityType = {entityType:String} AND ${prefix}isVictim = 0`
    params.entityType = 'none'
  }

  if (filters.spaceType) {
    const spaceTypeCondition = buildSpaceTypeCondition(filters.spaceType, prefix)
    if (spaceTypeCondition) {
      conditions.push(spaceTypeCondition)
    }
  }

  if (filters.isSolo !== undefined) {
    conditions.push(`${prefix}solo = {isSolo:UInt8}`)
    params.isSolo = filters.isSolo ? 1 : 0
  }

  if (filters.isBig !== undefined) {
    params.bigShipGroupIds = BIG_SHIP_GROUP_IDS
    const column = `${prefix}victimShipGroupId`
    if (filters.isBig) {
      conditions.push(`${column} IN {bigShipGroupIds:Array(UInt32)}`)
    } else {
      conditions.push(`${column} NOT IN {bigShipGroupIds:Array(UInt32)}`)
    }
  }

  if (filters.isNpc !== undefined) {
    conditions.push(`${prefix}npc = {isNpc:UInt8}`)
    params.isNpc = filters.isNpc ? 1 : 0
  }

  if (filters.minValue !== undefined) {
    conditions.push(`${prefix}totalValue >= {minValue:Float64}`)
    params.minValue = filters.minValue
  }

  if (filters.shipGroupIds && filters.shipGroupIds.length > 0) {
    conditions.push(`${prefix}victimShipGroupId IN ({shipGroupIds:Array(UInt32)})`)
    params.shipGroupIds = filters.shipGroupIds
  }

  if (filters.minSecurityStatus !== undefined) {
    conditions.push(`${prefix}security >= {minSec:Float32}`)
    params.minSec = filters.minSecurityStatus
  }

  if (filters.maxSecurityStatus !== undefined) {
    conditions.push(`${prefix}security <= {maxSec:Float32}`)
    params.maxSec = filters.maxSecurityStatus

    if (filters.maxSecurityStatus <= 0) {
      conditions.push(`(${prefix}regionId < {wormholeRegionMin:UInt32} OR ${prefix}regionId > {wormholeRegionMax:UInt32})`)
      params.wormholeRegionMin = WORMHOLE_REGION_MIN
      params.wormholeRegionMax = WORMHOLE_REGION_MAX
    }
  }

  if (filters.regionId !== undefined) {
    conditions.push(`${prefix}regionId = {regionId:UInt32}`)
    params.regionId = filters.regionId
  }

  if (filters.regionIdMin !== undefined && filters.regionIdMax !== undefined) {
    conditions.push(`${prefix}regionId >= {regionIdMin:UInt32} AND ${prefix}regionId <= {regionIdMax:UInt32}`)
    params.regionIdMin = filters.regionIdMin
    params.regionIdMax = filters.regionIdMax
  }

  const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  return { clause, params, prewhereClause, basePrewhereClause }
}

/**
 * Get recent killmails for frontpage (all kills)
 */
export async function getRecentKills(limit: number = 50): Promise<KilllistRow[]> {
  return await database.query<KilllistRow>(
    `SELECT * FROM killlist
     PREWHERE entityType = 'none'
     ORDER BY killmailTime DESC, killmailId DESC
     LIMIT {limit:UInt32}`,
    { limit }
  )
}

/**
 * Get killmails for a specific entity (character/corp/alliance)
 */
export async function getEntityKills(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  limit: number = 100
): Promise<KilllistRow[]> {
  return await database.query<KilllistRow>(
    `SELECT * FROM killlist
     PREWHERE entityId = {entityId:UInt32} AND entityType = {entityType:String}
     ORDER BY killmailTime DESC, killmailId DESC
     LIMIT {limit:UInt32}`,
    { entityId, entityType, limit }
  )
}

/**
 * Get kills where entity was the victim
 */
export async function getEntityLosses(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  limit: number = 100
): Promise<KilllistRow[]> {
  return await database.query<KilllistRow>(
    `SELECT * FROM killlist
     PREWHERE entityId = {entityId:UInt32} AND entityType = {entityType:String}
     WHERE isVictim = true
     ORDER BY killmailTime DESC, killmailId DESC
     LIMIT {limit:UInt32}`,
    { entityId, entityType, limit }
  )
}

/**
 * Get most valuable kills (using projection)
 */
export async function getMostValuableKills(
  limit: number = 50,
  hoursAgo: number = 168 // 7 days default
): Promise<KilllistRow[]> {
  return await database.query<KilllistRow>(
    `SELECT * FROM killlist
     PREWHERE entityType = 'none'
     WHERE killmailTime >= now() - INTERVAL {hours:UInt32} HOUR
     ORDER BY totalValue DESC, killmailTime DESC
     LIMIT {limit:UInt32}`,
    { hours: hoursAgo, limit }
  )
}

/**
 * Count total kills for an entity
 */
export async function countEntityKills(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance'
): Promise<number> {
  const result = await database.queryValue<number>(
    `SELECT count() FROM killlist
     PREWHERE entityId = {entityId:UInt32} AND entityType = {entityType:String}`,
    { entityId, entityType }
  )
  return result || 0
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
  regionIdMin?: number
  regionIdMax?: number
}

/**
 * Get filtered kills with pagination
 */
export async function getFilteredKills(
  filters: KilllistFilters,
  page: number = 1,
  perPage: number = 50
): Promise<KilllistRow[]> {
  const offset = (page - 1) * perPage
  const { clause, params: filterParams, prewhereClause } = buildKilllistWhereClause(filters)
  const params: Record<string, unknown> = { ...filterParams, limit: perPage, offset }
  const prewhere = prewhereClause ? `PREWHERE ${prewhereClause}` : ''

  return await database.query<KilllistRow>(
    `SELECT * FROM killlist
     ${prewhere}
     ${clause}
     ORDER BY killmailTime DESC, killmailId DESC
     LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
    params
  )
}

/**
 * Count filtered kills
 */
export async function countFilteredKills(filters: KilllistFilters): Promise<number> {
  const { clause, params, prewhereClause } = buildKilllistWhereClause(filters)
  const prewhere = prewhereClause ? `PREWHERE ${prewhereClause}` : ''

  const result = await database.queryValue<number>(
    `SELECT count() FROM killlist
     ${prewhere}
     ${clause}`,
    params
  )
  return result || 0
}

/**
 * Get filtered kills with all names joined from SDE tables
 * Similar to getEntityKillmails but applies KilllistFilters instead of entity ID
 */
export async function getFilteredKillsWithNames(
  filters: KilllistFilters,
  page: number = 1,
  perPage: number = 50
): Promise<EntityKillmail[]> {
  const offset = (page - 1) * perPage
  const { clause, params: filterParams, prewhereClause, basePrewhereClause } = buildKilllistWhereClause(filters, 'k')
  const params: Record<string, unknown> = { ...filterParams, perPage, offset }
  const fromClause = basePrewhereClause
    ? `(SELECT * FROM killlist PREWHERE ${basePrewhereClause}) k`
    : 'killlist k'
  const prewhere = prewhereClause && !basePrewhereClause ? `PREWHERE ${prewhereClause}` : ''

  return await database.query<EntityKillmail>(
    `SELECT
      k.killmailId as killmailId,
      k.killmailTime as killmailTime,

      -- Victim info
      k.victimCharacterId as victimCharacterId,
      coalesce(vc.name, vnpc.name, 'Unknown') as victimCharacterName,
      k.victimCorporationId as victimCorporationId,
      coalesce(vcorp.name, vnpc_corp.name, 'Unknown') as victimCorporationName,
      coalesce(vcorp.ticker, vnpc_corp.tickerName, '???') as victimCorporationTicker,
      k.victimAllianceId as victimAllianceId,
      valliance.name as victimAllianceName,
      valliance.ticker as victimAllianceTicker,
      k.victimShipTypeId as victimShipTypeId,
      coalesce(vship.name, 'Unknown') as victimShipName,
      coalesce(vshipgroup.name, 'Unknown') as victimShipGroup,

      -- Attacker info (top attacker)
      k.topAttackerCharacterId as attackerCharacterId,
      coalesce(ac.name, anpc.name, 'Unknown') as attackerCharacterName,
      k.topAttackerCorporationId as attackerCorporationId,
      coalesce(acorp.name, anpc_corp.name, 'Unknown') as attackerCorporationName,
      coalesce(acorp.ticker, anpc_corp.tickerName, '???') as attackerCorporationTicker,
      k.topAttackerAllianceId as attackerAllianceId,
      aalliance.name as attackerAllianceName,
      aalliance.ticker as attackerAllianceTicker,

      -- Location
      k.solarSystemId as solarSystemId,
      sys.name as solarSystemName,
      reg.name as regionName,

      -- Stats
      k.totalValue as totalValue,
      k.attackerCount as attackerCount

  FROM ${fromClause}
  ${prewhere}

    -- Victim JOINs
    LEFT JOIN characters vc FINAL ON k.victimCharacterId = vc.characterId
    LEFT JOIN npcCharacters vnpc FINAL ON k.victimCharacterId = vnpc.characterId
    LEFT JOIN corporations vcorp FINAL ON k.victimCorporationId = vcorp.corporationId
    LEFT JOIN npcCorporations vnpc_corp FINAL ON k.victimCorporationId = vnpc_corp.corporationId
    LEFT JOIN alliances valliance FINAL ON k.victimAllianceId = valliance.allianceId
    LEFT JOIN types vship FINAL ON k.victimShipTypeId = vship.typeId
    LEFT JOIN groups vshipgroup FINAL ON vship.groupId = vshipgroup.groupId

    -- Attacker JOINs
    LEFT JOIN characters ac FINAL ON k.topAttackerCharacterId = ac.characterId
    LEFT JOIN npcCharacters anpc FINAL ON k.topAttackerCharacterId = anpc.characterId
    LEFT JOIN corporations acorp FINAL ON k.topAttackerCorporationId = acorp.corporationId
    LEFT JOIN npcCorporations anpc_corp FINAL ON k.topAttackerCorporationId = anpc_corp.corporationId
    LEFT JOIN alliances aalliance FINAL ON k.topAttackerAllianceId = aalliance.allianceId

    -- Location JOINs
    LEFT JOIN solarSystems sys FINAL ON k.solarSystemId = sys.solarSystemId
    LEFT JOIN regions reg FINAL ON sys.regionId = reg.regionId

    ${clause}
    ORDER BY k.killmailTime DESC
    LIMIT {perPage:UInt32} OFFSET {offset:UInt32}`,
    params
  )
}

/**
 * Extended killmail data with entity names (for entity pages)
 */
export interface EntityKillmail {
  killmailId: number
  killmailTime: string

  // Victim info
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

  // Attacker info (top attacker)
  attackerCharacterId: number
  attackerCharacterName: string
  attackerCorporationId: number
  attackerCorporationName: string
  attackerCorporationTicker: string
  attackerAllianceId: number | null
  attackerAllianceName: string | null
  attackerAllianceTicker: string | null

  // Location
  solarSystemId: number
  solarSystemName: string
  regionName: string

  // Stats
  totalValue: number
  attackerCount: number
}

/**
 * Get killmails where entity was attacker (kills)
 */
export async function getEntityKillmails(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  mode: 'kills' | 'losses' | 'all',
  page: number = 1,
  perPage: number = 30
): Promise<EntityKillmail[]> {
  const offset = (page - 1) * perPage

  // Build WHERE clause based on mode
  let whereClause = ''
  if (mode === 'kills') {
    whereClause = entityType === 'character'
      ? 'topAttackerCharacterId = {entityId:UInt32}'
      : entityType === 'corporation'
      ? 'topAttackerCorporationId = {entityId:UInt32}'
      : 'topAttackerAllianceId = {entityId:UInt32}'
  } else if (mode === 'losses') {
    whereClause = entityType === 'character'
      ? 'victimCharacterId = {entityId:UInt32}'
      : entityType === 'corporation'
      ? 'victimCorporationId = {entityId:UInt32}'
      : 'victimAllianceId = {entityId:UInt32}'
  } else { // all
    whereClause = entityType === 'character'
      ? '(topAttackerCharacterId = {entityId:UInt32} OR victimCharacterId = {entityId:UInt32})'
      : entityType === 'corporation'
      ? '(topAttackerCorporationId = {entityId:UInt32} OR victimCorporationId = {entityId:UInt32})'
      : '(topAttackerAllianceId = {entityId:UInt32} OR victimAllianceId = {entityId:UInt32})'
  }

  return await database.query<EntityKillmail>(
    `SELECT
      killmailId,
      killmailTime,

      -- Victim info
      victimCharacterId,
      victimCharacterName,
      victimCorporationId,
      victimCorporationName,
      victimCorporationTicker,
      victimAllianceId,
      victimAllianceName,
      victimAllianceTicker,
      victimShipTypeId,
      victimShipName,
      victimShipGroup,

      -- Attacker info (top attacker)
      topAttackerCharacterId,
      topAttackerCharacterName as attackerCharacterName,
      topAttackerCorporationId,
      topAttackerCorporationName as attackerCorporationName,
      topAttackerCorporationTicker as attackerCorporationTicker,
      topAttackerAllianceId,
      topAttackerAllianceName as attackerAllianceName,
      topAttackerAllianceTicker as attackerAllianceTicker,

      -- Location
      solarSystemId,
      solarSystemName,
      regionName,

      -- Stats
      totalValue,
      attackerCount

    FROM killlist

    WHERE ${whereClause}
    ORDER BY killmailTime DESC
    LIMIT {perPage:UInt32} OFFSET {offset:UInt32}`,
    { entityId, perPage, offset }
  )
}

/**
 * Count entity killmails
 */
export async function countEntityKillmails(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  mode: 'kills' | 'losses' | 'all'
): Promise<number> {
  let whereClause = ''
  if (mode === 'kills') {
    whereClause = entityType === 'character'
      ? 'topAttackerCharacterId = {entityId:UInt32}'
      : entityType === 'corporation'
      ? 'topAttackerCorporationId = {entityId:UInt32}'
      : 'topAttackerAllianceId = {entityId:UInt32}'
  } else if (mode === 'losses') {
    whereClause = entityType === 'character'
      ? 'victimCharacterId = {entityId:UInt32}'
      : entityType === 'corporation'
      ? 'victimCorporationId = {entityId:UInt32}'
      : 'victimAllianceId = {entityId:UInt32}'
  } else { // all
    whereClause = entityType === 'character'
      ? '(topAttackerCharacterId = {entityId:UInt32} OR victimCharacterId = {entityId:UInt32})'
      : entityType === 'corporation'
      ? '(topAttackerCorporationId = {entityId:UInt32} OR victimCorporationId = {entityId:UInt32})'
      : '(topAttackerAllianceId = {entityId:UInt32} OR victimAllianceId = {entityId:UInt32})'
  }

  const result = await database.queryValue<number>(
    `SELECT count() FROM killlist WHERE ${whereClause}`,
    { entityId }
  )
  return result || 0
}

/**
 * Detailed killlist row with all entity information
 */
export interface DetailedKilllistRow {
  killmailId: number
  killmailTime: string
  victimCharacterId: number | null
  victimCharacterName: string
  victimCorporationId: number
  victimCorporationName: string
  victimCorporationTicker: string
  victimAllianceId: number | null
  victimAllianceName: string
  victimAllianceTicker: string
  victimShipTypeId: number
  victimShipName: string
  victimShipGroup: string
  attackerCharacterId: number
  attackerCharacterName: string
  attackerCorporationId: number
  attackerCorporationName: string
  attackerCorporationTicker: string
  attackerAllianceId: number | null
  attackerAllianceName: string
  attackerAllianceTicker: string
  solarSystemId: number
  solarSystemName: string
  regionName: string
  totalValue: number
  attackerCount: number
  isSolo: number
}

/**
 * Get kills for an entity (where entity was the attacker)
 */
export async function getEntityKillsDetailed(
  entityType: 'character' | 'corporation' | 'alliance',
  entityId: number,
  page: number = 1,
  perPage: number = 30
): Promise<DetailedKilllistRow[]> {
  const offset = (page - 1) * perPage
  const whereField = `topAttacker${entityType.charAt(0).toUpperCase() + entityType.slice(1)}Id`

  return await database.query<DetailedKilllistRow>(
    `SELECT
      killmailId,
      killmailTime,
      victimCharacterId,
      victimCharacterName,
      victimCorporationId,
      victimCorporationName,
      victimCorporationTicker,
      victimAllianceId,
      victimAllianceName,
      victimAllianceTicker,
      victimShipTypeId,
      victimShipName,
      victimShipGroup,
      topAttackerCharacterId as attackerCharacterId,
      topAttackerCharacterName as attackerCharacterName,
      topAttackerCorporationId as attackerCorporationId,
      topAttackerCorporationName as attackerCorporationName,
      topAttackerCorporationTicker as attackerCorporationTicker,
      topAttackerAllianceId as attackerAllianceId,
      topAttackerAllianceName as attackerAllianceName,
      topAttackerAllianceTicker as attackerAllianceTicker,
      solarSystemId,
      solarSystemName,
      regionName,
      totalValue,
      attackerCount,
      isSolo
    FROM killlist
    WHERE ${whereField} = {entityId:UInt32}
    ORDER BY killmailTime DESC
    LIMIT {perPage:UInt32} OFFSET {offset:UInt32}`,
    { entityId, perPage, offset }
  )
}

/**
 * Get losses for an entity (where entity was the victim)
 */
export async function getEntityLossesDetailed(
  entityType: 'character' | 'corporation' | 'alliance',
  entityId: number,
  page: number = 1,
  perPage: number = 30
): Promise<DetailedKilllistRow[]> {
  const offset = (page - 1) * perPage
  const whereField = `victim${entityType.charAt(0).toUpperCase() + entityType.slice(1)}Id`

  return await database.query<DetailedKilllistRow>(
    `SELECT
      killmailId,
      killmailTime,
      victimCharacterId,
      victimCharacterName,
      victimCorporationId,
      victimCorporationName,
      victimCorporationTicker,
      victimAllianceId,
      victimAllianceName,
      victimAllianceTicker,
      victimShipTypeId,
      victimShipName,
      victimShipGroup,
      topAttackerCharacterId as attackerCharacterId,
      topAttackerCharacterName as attackerCharacterName,
      topAttackerCorporationId as attackerCorporationId,
      topAttackerCorporationName as attackerCorporationName,
      topAttackerCorporationTicker as attackerCorporationTicker,
      topAttackerAllianceId as attackerAllianceId,
      topAttackerAllianceName as attackerAllianceName,
      topAttackerAllianceTicker as attackerAllianceTicker,
      solarSystemId,
      solarSystemName,
      regionName,
      totalValue,
      attackerCount,
      isSolo
    FROM killlist
    WHERE ${whereField} = {entityId:UInt32}
    ORDER BY killmailTime DESC
    LIMIT {perPage:UInt32} OFFSET {offset:UInt32}`,
    { entityId, perPage, offset }
  )
}

/**
 * Get all killmails for an entity (both kills and losses)
 */
export async function getEntityKillmailsDetailed(
  entityType: 'character' | 'corporation' | 'alliance',
  entityId: number,
  page: number = 1,
  perPage: number = 30
): Promise<DetailedKilllistRow[]> {
  const offset = (page - 1) * perPage
  const attackerField = `topAttacker${entityType.charAt(0).toUpperCase() + entityType.slice(1)}Id`
  const victimField = `victim${entityType.charAt(0).toUpperCase() + entityType.slice(1)}Id`

  return await database.query<DetailedKilllistRow>(
    `SELECT
      killmailId,
      killmailTime,
      victimCharacterId,
      victimCharacterName,
      victimCorporationId,
      victimCorporationName,
      victimCorporationTicker,
      victimAllianceId,
      victimAllianceName,
      victimAllianceTicker,
      victimShipTypeId,
      victimShipName,
      victimShipGroup,
      topAttackerCharacterId as attackerCharacterId,
      topAttackerCharacterName as attackerCharacterName,
      topAttackerCorporationId as attackerCorporationId,
      topAttackerCorporationName as attackerCorporationName,
      topAttackerCorporationTicker as attackerCorporationTicker,
      topAttackerAllianceId as attackerAllianceId,
      topAttackerAllianceName as attackerAllianceName,
      topAttackerAllianceTicker as attackerAllianceTicker,
      solarSystemId,
      solarSystemName,
      regionName,
      totalValue,
      attackerCount,
      isSolo
    FROM killlist
    WHERE ${attackerField} = {entityId:UInt32} OR ${victimField} = {entityId:UInt32}
    ORDER BY killmailTime DESC
    LIMIT {perPage:UInt32} OFFSET {offset:UInt32}`,
    { entityId, perPage, offset }
  )
}

/**
 * Count kills for an entity
 */
export async function countEntityKillsDetailed(
  entityType: 'character' | 'corporation' | 'alliance',
  entityId: number
): Promise<number> {
  const whereField = `attacker_${entityType}_id`
  const result = await database.queryValue<number>(
    `SELECT count() FROM killlist WHERE ${whereField} = {entityId:UInt32}`,
    { entityId }
  )
  return result || 0
}

/**
 * Count losses for an entity
 */
export async function countEntityLossesDetailed(
  entityType: 'character' | 'corporation' | 'alliance',
  entityId: number
): Promise<number> {
  const whereField = `victim_${entityType}_id`
  const result = await database.queryValue<number>(
    `SELECT count() FROM killlist WHERE ${whereField} = {entityId:UInt32}`,
    { entityId }
  )
  return result || 0
}

/**
 * Count all killmails for an entity (both kills and losses)
 */
export async function countEntityKillmailsDetailed(
  entityType: 'character' | 'corporation' | 'alliance',
  entityId: number
): Promise<number> {
  const attackerField = `attacker_${entityType}_id`
  const victimField = `victim_${entityType}_id`
  const result = await database.queryValue<number>(
    `SELECT count() FROM killlist WHERE ${attackerField} = {entityId:UInt32} OR ${victimField} = {entityId:UInt32}`,
    { entityId }
  )
  return result || 0
}

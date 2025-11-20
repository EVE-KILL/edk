import { database } from '../helpers/database'

/**
 * Killlist Model
 *
 * Queries killmail data.
 * Formerly queried the 'killlist' materialized view, now queries base tables.
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

function buildSpaceTypeCondition(spaceType: string, prefix: string = ''): string | null {
  // Assumes joins: solarSystems ss
  const securityColumn = `ss.securityStatus`
  const regionColumn = `ss.regionId`

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
  alias: string = 'k', // killmails table alias
  includeEntityTypeFilter: boolean = true // Deprecated in this new implementation but kept for signature compatibility
): {
  clause: string
  params: Record<string, unknown>
  // prewhereClause?: string // Not used in Postgres
  // basePrewhereClause?: string // Not used in Postgres
} {
  const prefix = alias ? `${alias}.` : ''
  const conditions: string[] = []
  const params: Record<string, unknown> = {}

  if (filters.spaceType) {
    const spaceTypeCondition = buildSpaceTypeCondition(filters.spaceType, alias)
    if (spaceTypeCondition) {
      conditions.push(spaceTypeCondition)
    }
  }

  if (filters.isSolo !== undefined) {
    conditions.push(`${prefix}solo = {isSolo:Boolean}`)
    params.isSolo = filters.isSolo
  }

  if (filters.isBig !== undefined) {
    params.bigShipGroupIds = BIG_SHIP_GROUP_IDS
    // Requires join with types t
    const column = `t.groupId`
    if (filters.isBig) {
      conditions.push(`${column} = ANY({bigShipGroupIds:Array(UInt32)})`)
    } else {
      conditions.push(`${column} != ALL({bigShipGroupIds:Array(UInt32)})`)
    }
  }

  if (filters.isNpc !== undefined) {
    conditions.push(`${prefix}npc = {isNpc:Boolean}`)
    params.isNpc = filters.isNpc
  }

  if (filters.minValue !== undefined) {
    conditions.push(`${prefix}totalValue >= {minValue:Float64}`)
    params.minValue = filters.minValue
  }

  if (filters.shipGroupIds && filters.shipGroupIds.length > 0) {
    // Requires join with types t
    conditions.push(`t.groupId = ANY({shipGroupIds:Array(UInt32)})`)
    params.shipGroupIds = filters.shipGroupIds
  }

  if (filters.minSecurityStatus !== undefined) {
    // Requires join with solarSystems ss
    conditions.push(`ss.securityStatus >= {minSec:Float32}`)
    params.minSec = filters.minSecurityStatus
  }

  if (filters.maxSecurityStatus !== undefined) {
    // Requires join with solarSystems ss
    conditions.push(`ss.securityStatus <= {maxSec:Float32}`)
    params.maxSec = filters.maxSecurityStatus

    if (filters.maxSecurityStatus <= 0) {
      conditions.push(`(ss.regionId < {wormholeRegionMin:UInt32} OR ss.regionId > {wormholeRegionMax:UInt32})`)
      params.wormholeRegionMin = WORMHOLE_REGION_MIN
      params.wormholeRegionMax = WORMHOLE_REGION_MAX
    }
  }

  if (filters.regionId !== undefined) {
    // Requires join with solarSystems ss
    conditions.push(`ss.regionId = {regionId:UInt32}`)
    params.regionId = filters.regionId
  }

  if (filters.regionIdMin !== undefined && filters.regionIdMax !== undefined) {
    conditions.push(`ss.regionId >= {regionIdMin:UInt32} AND ss.regionId <= {regionIdMax:UInt32}`)
    params.regionIdMin = filters.regionIdMin
    params.regionIdMax = filters.regionIdMax
  }

  const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  return { clause, params }
}

// Base SELECT list for KilllistRow
const BASE_SELECT_LIST = `
  k.killmailId,
  k.killmailTime,
  k.solarSystemId,
  ss.regionId,
  ss.securityStatus as security,
  k.victimCharacterId,
  k.victimCorporationId,
  k.victimAllianceId,
  k.victimShipTypeId,
  t.groupId as victimShipGroupId,
  k.victimDamageTaken,
  k.topAttackerCharacterId,
  k.topAttackerCorporationId,
  k.topAttackerAllianceId,
  k.topAttackerShipTypeId,
  k.totalValue,
  k.attackerCount,
  k.npc,
  k.solo,
  k.awox
`

// Helper to get base query with joins
const getBaseQuery = () => `
  FROM killmails k
  LEFT JOIN solarSystems ss ON k.solarSystemId = ss.solarSystemId
  LEFT JOIN types t ON k.victimShipTypeId = t.typeId
`

/**
 * Get recent killmails for frontpage (all kills)
 */
export async function getRecentKills(limit: number = 50): Promise<KilllistRow[]> {
  // Frontpage: no entity filter, just all kills
  return await database.query<KilllistRow>(
    `SELECT
       ${BASE_SELECT_LIST},
       0 as entityId,
       'none' as entityType,
       false as isVictim
     ${getBaseQuery()}
     ORDER BY k.killmailTime DESC, k.killmailId DESC
     LIMIT {limit:UInt32}`,
    { limit }
  )
}

/**
 * Get killmails for a specific entity (character/corp/alliance)
 * Defaults to "kills" (where entity is attacker)
 */
export async function getEntityKills(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  limit: number = 100
): Promise<KilllistRow[]> {
  // Logic: join attackers to find kills where this entity participated
  let joinClause = ''
  let whereClause = ''

  if (entityType === 'character') {
    joinClause = `JOIN attackers a ON k.killmailId = a.killmailId`;
    whereClause = `a.characterId = {entityId:UInt32}`;
  } else if (entityType === 'corporation') {
    joinClause = `JOIN attackers a ON k.killmailId = a.killmailId`;
    whereClause = `a.corporationId = {entityId:UInt32}`;
  } else if (entityType === 'alliance') {
    joinClause = `JOIN attackers a ON k.killmailId = a.killmailId`;
    whereClause = `a.allianceId = {entityId:UInt32}`;
  }

  // Postgres: DISTINCT ON k.killmailId to avoid duplicates if multiple chars from same corp on same kill
  return await database.query<KilllistRow>(
    `SELECT DISTINCT ON (k.killmailTime, k.killmailId)
       ${BASE_SELECT_LIST},
       {entityId:UInt32} as entityId,
       {entityType:String} as entityType,
       false as isVictim
     ${getBaseQuery()}
     ${joinClause}
     WHERE ${whereClause}
     ORDER BY k.killmailTime DESC, k.killmailId DESC
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
  // Logic: check victim columns on killmail
  let whereClause = ''

  if (entityType === 'character') {
    whereClause = `k.victimCharacterId = {entityId:UInt32}`;
  } else if (entityType === 'corporation') {
    whereClause = `k.victimCorporationId = {entityId:UInt32}`;
  } else if (entityType === 'alliance') {
    whereClause = `k.victimAllianceId = {entityId:UInt32}`;
  }

  return await database.query<KilllistRow>(
    `SELECT
       ${BASE_SELECT_LIST},
       {entityId:UInt32} as entityId,
       {entityType:String} as entityType,
       true as isVictim
     ${getBaseQuery()}
     WHERE ${whereClause}
     ORDER BY k.killmailTime DESC, k.killmailId DESC
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
    `SELECT
       ${BASE_SELECT_LIST},
       0 as entityId,
       'none' as entityType,
       false as isVictim
     ${getBaseQuery()}
     WHERE k.killmailTime >= NOW() - ({hours:UInt32} || ' hours')::interval
     ORDER BY k.totalValue DESC, k.killmailTime DESC
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
  let joinClause = ''
  let whereClause = ''

  if (entityType === 'character') {
    joinClause = `JOIN attackers a ON k.killmailId = a.killmailId`;
    whereClause = `a.characterId = {entityId:UInt32}`;
  } else if (entityType === 'corporation') {
    joinClause = `JOIN attackers a ON k.killmailId = a.killmailId`;
    whereClause = `a.corporationId = {entityId:UInt32}`;
  } else if (entityType === 'alliance') {
    joinClause = `JOIN attackers a ON k.killmailId = a.killmailId`;
    whereClause = `a.allianceId = {entityId:UInt32}`;
  }

  const result = await database.queryValue<number>(
    `SELECT count(DISTINCT k.killmailId)
     FROM killmails k
     ${joinClause}
     WHERE ${whereClause}`,
    { entityId }
  )
  return Number(result) || 0
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
  const { clause, params: filterParams } = buildKilllistWhereClause(filters, 'k')
  const params: Record<string, unknown> = { ...filterParams, limit: perPage, offset }

  return await database.query<KilllistRow>(
    `SELECT
       ${BASE_SELECT_LIST},
       0 as entityId,
       'none' as entityType,
       false as isVictim
     ${getBaseQuery()}
     ${clause}
     ORDER BY k.killmailTime DESC, k.killmailId DESC
     LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
    params
  )
}

/**
 * Count filtered kills
 */
export async function countFilteredKills(filters: KilllistFilters): Promise<number> {
  const { clause, params } = buildKilllistWhereClause(filters, 'k')

  const result = await database.queryValue<number>(
    `SELECT count(*)
     ${getBaseQuery()}
     ${clause}`,
    params
  )
  return Number(result) || 0
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
  const { clause, params: filterParams } = buildKilllistWhereClause(filters, 'k')
  const params: Record<string, unknown> = { ...filterParams, perPage, offset }

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

  FROM killmails k
  LEFT JOIN solarSystems sys ON k.solarSystemId = sys.solarSystemId
  -- Alias solarSystems as ss to match filters
  LEFT JOIN solarSystems ss ON k.solarSystemId = ss.solarSystemId
  LEFT JOIN regions reg ON sys.regionId = reg.regionId
  LEFT JOIN types t ON k.victimShipTypeId = t.typeId -- Needed for filter conditions

    -- Victim JOINs
    LEFT JOIN characters vc ON k.victimCharacterId = vc.characterId
    LEFT JOIN npcCharacters vnpc ON k.victimCharacterId = vnpc.characterId
    LEFT JOIN corporations vcorp ON k.victimCorporationId = vcorp.corporationId
    LEFT JOIN npcCorporations vnpc_corp ON k.victimCorporationId = vnpc_corp.corporationId
    LEFT JOIN alliances valliance ON k.victimAllianceId = valliance.allianceId
    LEFT JOIN types vship ON k.victimShipTypeId = vship.typeId
    LEFT JOIN groups vshipgroup ON vship.groupId = vshipgroup.groupId

    -- Attacker JOINs
    LEFT JOIN characters ac ON k.topAttackerCharacterId = ac.characterId
    LEFT JOIN npcCharacters anpc ON k.topAttackerCharacterId = anpc.characterId
    LEFT JOIN corporations acorp ON k.topAttackerCorporationId = acorp.corporationId
    LEFT JOIN npcCorporations anpc_corp ON k.topAttackerCorporationId = anpc_corp.corporationId
    LEFT JOIN alliances aalliance ON k.topAttackerAllianceId = aalliance.allianceId

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
  // ... fields ...
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

  attackerCharacterId: number
  attackerCharacterName: string
  attackerCorporationId: number
  attackerCorporationName: string
  attackerCorporationTicker: string
  attackerAllianceId: number | null
  attackerAllianceName: string | null
  attackerAllianceTicker: string | null

  solarSystemId: number
  solarSystemName: string
  regionName: string

  totalValue: number
  attackerCount: number
}

/**
 * Get killmails where entity was attacker (kills)
 * Or victim (losses)
 * Or both (all)
 * Detailed view with names.
 */
export async function getEntityKillmails(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  mode: 'kills' | 'losses' | 'all',
  page: number = 1,
  perPage: number = 30
): Promise<EntityKillmail[]> {
  const offset = (page - 1) * perPage

  let joinClause = ''
  let whereClause = ''

  // For 'all' or 'kills', we might need to check attackers table for 'kills' if we want comprehensive list,
  // OR check topAttacker columns if we only care about final blow/top attacker?
  // The previous implementation used `killlist` view which likely included all attackers.
  // So we should join attackers table for 'kills' mode.

  // Wait, `killlist` view in ClickHouse often replicates the killmail for each attacker.
  // So querying `killlist WHERE entityId = X` gets all kills where X was involved.

  if (mode === 'kills') {
    if (entityType === 'character') {
       joinClause = `JOIN attackers a ON k.killmailId = a.killmailId`;
       whereClause = `a.characterId = {entityId:UInt32}`;
    } else if (entityType === 'corporation') {
       joinClause = `JOIN attackers a ON k.killmailId = a.killmailId`;
       whereClause = `a.corporationId = {entityId:UInt32}`;
    } else if (entityType === 'alliance') {
       joinClause = `JOIN attackers a ON k.killmailId = a.killmailId`;
       whereClause = `a.allianceId = {entityId:UInt32}`;
    }
  } else if (mode === 'losses') {
    if (entityType === 'character') {
       whereClause = `k.victimCharacterId = {entityId:UInt32}`;
    } else if (entityType === 'corporation') {
       whereClause = `k.victimCorporationId = {entityId:UInt32}`;
    } else if (entityType === 'alliance') {
       whereClause = `k.victimAllianceId = {entityId:UInt32}`;
    }
  } else { // all
    // This is tricky with simple WHERE. We need OR.
    // And potentially JOIN attackers if we want to find kills where entity was attacker.
    // But JOIN attackers will duplicate rows if we don't use DISTINCT.
    // And we need to match either victim OR attacker.

    joinClause = `LEFT JOIN attackers a ON k.killmailId = a.killmailId`;

    if (entityType === 'character') {
       whereClause = `(k.victimCharacterId = {entityId:UInt32} OR a.characterId = {entityId:UInt32})`;
    } else if (entityType === 'corporation') {
       whereClause = `(k.victimCorporationId = {entityId:UInt32} OR a.corporationId = {entityId:UInt32})`;
    } else if (entityType === 'alliance') {
       whereClause = `(k.victimAllianceId = {entityId:UInt32} OR a.allianceId = {entityId:UInt32})`;
    }
  }

  return await database.query<EntityKillmail>(
    `SELECT DISTINCT ON (k.killmailTime, k.killmailId)
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

    FROM killmails k
    ${joinClause}

    LEFT JOIN solarSystems sys ON k.solarSystemId = sys.solarSystemId
    LEFT JOIN regions reg ON sys.regionId = reg.regionId

    -- Victim JOINs
    LEFT JOIN characters vc ON k.victimCharacterId = vc.characterId
    LEFT JOIN npcCharacters vnpc ON k.victimCharacterId = vnpc.characterId
    LEFT JOIN corporations vcorp ON k.victimCorporationId = vcorp.corporationId
    LEFT JOIN npcCorporations vnpc_corp ON k.victimCorporationId = vnpc_corp.corporationId
    LEFT JOIN alliances valliance ON k.victimAllianceId = valliance.allianceId
    LEFT JOIN types vship ON k.victimShipTypeId = vship.typeId
    LEFT JOIN groups vshipgroup ON vship.groupId = vshipgroup.groupId

    -- Attacker JOINs
    LEFT JOIN characters ac ON k.topAttackerCharacterId = ac.characterId
    LEFT JOIN npcCharacters anpc ON k.topAttackerCharacterId = anpc.characterId
    LEFT JOIN corporations acorp ON k.topAttackerCorporationId = acorp.corporationId
    LEFT JOIN npcCorporations anpc_corp ON k.topAttackerCorporationId = anpc_corp.corporationId
    LEFT JOIN alliances aalliance ON k.topAttackerAllianceId = aalliance.allianceId

    WHERE ${whereClause}
    ORDER BY k.killmailTime DESC, k.killmailId DESC
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
  let joinClause = ''
  let whereClause = ''

  if (mode === 'kills') {
    if (entityType === 'character') {
       joinClause = `JOIN attackers a ON k.killmailId = a.killmailId`;
       whereClause = `a.characterId = {entityId:UInt32}`;
    } else if (entityType === 'corporation') {
       joinClause = `JOIN attackers a ON k.killmailId = a.killmailId`;
       whereClause = `a.corporationId = {entityId:UInt32}`;
    } else if (entityType === 'alliance') {
       joinClause = `JOIN attackers a ON k.killmailId = a.killmailId`;
       whereClause = `a.allianceId = {entityId:UInt32}`;
    }
  } else if (mode === 'losses') {
    if (entityType === 'character') {
       whereClause = `k.victimCharacterId = {entityId:UInt32}`;
    } else if (entityType === 'corporation') {
       whereClause = `k.victimCorporationId = {entityId:UInt32}`;
    } else if (entityType === 'alliance') {
       whereClause = `k.victimAllianceId = {entityId:UInt32}`;
    }
  } else { // all
    joinClause = `LEFT JOIN attackers a ON k.killmailId = a.killmailId`;
    if (entityType === 'character') {
       whereClause = `(k.victimCharacterId = {entityId:UInt32} OR a.characterId = {entityId:UInt32})`;
    } else if (entityType === 'corporation') {
       whereClause = `(k.victimCorporationId = {entityId:UInt32} OR a.corporationId = {entityId:UInt32})`;
    } else if (entityType === 'alliance') {
       whereClause = `(k.victimAllianceId = {entityId:UInt32} OR a.allianceId = {entityId:UInt32})`;
    }
  }

  const result = await database.queryValue<number>(
    `SELECT count(DISTINCT k.killmailId)
     FROM killmails k
     ${joinClause}
     WHERE ${whereClause}`,
    { entityId }
  )
  return Number(result) || 0
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
  // Re-use getEntityKillmails but cast result (interfaces are very similar, Detailed has strings for IDs? No, numbers)
  // Actually EntityKillmail and DetailedKilllistRow match closely.
  // Let's just call getEntityKillmails with mode='kills'.
  return await getEntityKillmails(entityId, entityType, 'kills', page, perPage) as unknown as DetailedKilllistRow[];
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
  return await getEntityKillmails(entityId, entityType, 'losses', page, perPage) as unknown as DetailedKilllistRow[];
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
  return await getEntityKillmails(entityId, entityType, 'all', page, perPage) as unknown as DetailedKilllistRow[];
}

/**
 * Count kills for an entity
 */
export async function countEntityKillsDetailed(
  entityType: 'character' | 'corporation' | 'alliance',
  entityId: number
): Promise<number> {
  return await countEntityKillmails(entityId, entityType, 'kills');
}

/**
 * Count losses for an entity
 */
export async function countEntityLossesDetailed(
  entityType: 'character' | 'corporation' | 'alliance',
  entityId: number
): Promise<number> {
  return await countEntityKillmails(entityId, entityType, 'losses');
}

/**
 * Count all killmails for an entity (both kills and losses)
 */
export async function countEntityKillmailsDetailed(
  entityType: 'character' | 'corporation' | 'alliance',
  entityId: number
): Promise<number> {
  return await countEntityKillmails(entityId, entityType, 'all');
}

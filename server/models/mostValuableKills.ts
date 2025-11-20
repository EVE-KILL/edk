import { database } from '../helpers/database'

/**
 * Most Valuable Kills Model
 *
 * Queries killmails table directly instead of most_valuable_kills view.
 */

export interface MostValuableKill {
  periodType: 'hour' | 'day' | 'week' | 'month' | 'all'
  killmailId: number
  killmailTime: Date
  solarSystemId: number
  solarSystemName?: string | null
  victimCharacterId: number | null
  victimCharacterName: string
  victimCorporationId: number
  victimCorporationName: string
  victimCorporationTicker: string
  victimAllianceId: number | null
  victimAllianceName: string | null
  victimAllianceTicker: string | null
  victimShipTypeId: number
  victimShipName?: string
  victimShipGroup?: string
  totalValue: number
  attackerCount: number
  npc: boolean
  solo: boolean
  attackerCharacterId: number | null
  attackerCharacterName: string | null
  attackerCorporationId: number | null
  attackerCorporationName: string | null
  attackerCorporationTicker: string | null
  attackerAllianceId: number | null
  attackerAllianceName: string | null
  attackerAllianceTicker?: string | null
  regionName?: string | null
}

const SELECT_CLAUSE = `
  {periodType:String} as periodType,
  k.killmailId,
  k.killmailTime,
  k.solarSystemId,
  ss.name as solarSystemName,
  k.victimCharacterId,
  vc.name as victimCharacterName,
  k.victimCorporationId,
  vcorp.name as victimCorporationName,
  vcorp.ticker as victimCorporationTicker,
  k.victimAllianceId,
  valliance.name as victimAllianceName,
  valliance.ticker as victimAllianceTicker,
  k.victimShipTypeId,
  vship.name as victimShipName,
  vshipgroup.name as victimShipGroup,
  k.totalValue,
  k.attackerCount,
  k.npc,
  k.solo,
  k.topAttackerCharacterId as attackerCharacterId,
  ac.name as attackerCharacterName,
  k.topAttackerCorporationId as attackerCorporationId,
  acorp.name as attackerCorporationName,
  acorp.ticker as attackerCorporationTicker,
  k.topAttackerAllianceId as attackerAllianceId,
  aalliance.name as attackerAllianceName,
  aalliance.ticker as attackerAllianceTicker,
  reg.name as regionName
`

const JOIN_CLAUSE = `
  FROM killmails k
  LEFT JOIN solarSystems ss ON k.solarSystemId = ss.solarSystemId
  LEFT JOIN regions reg ON ss.regionId = reg.regionId
  LEFT JOIN characters vc ON k.victimCharacterId = vc.characterId
  LEFT JOIN corporations vcorp ON k.victimCorporationId = vcorp.corporationId
  LEFT JOIN alliances valliance ON k.victimAllianceId = valliance.allianceId
  LEFT JOIN types vship ON k.victimShipTypeId = vship.typeId
  LEFT JOIN groups vshipgroup ON vship.groupId = vshipgroup.groupId
  LEFT JOIN characters ac ON k.topAttackerCharacterId = ac.characterId
  LEFT JOIN corporations acorp ON k.topAttackerCorporationId = acorp.corporationId
  LEFT JOIN alliances aalliance ON k.topAttackerAllianceId = aalliance.allianceId
`

/**
 * Get most valuable kills for a period
 */
export async function getMostValuableKillsByPeriod(
  periodType: 'hour' | 'day' | 'week' | 'month' | 'all',
  limit: number = 50
): Promise<MostValuableKill[]> {
  // Calculate time threshold based on period type
  let hoursAgo: number
  switch (periodType) {
    case 'hour':
      hoursAgo = 1
      break
    case 'day':
      hoursAgo = 24
      break
    case 'week':
      hoursAgo = 168
      break
    case 'month':
      hoursAgo = 720
      break
    case 'all':
      hoursAgo = 876000 // ~100 years
      break
  }

  return await database.query<MostValuableKill>(
    `SELECT
      ${SELECT_CLAUSE}
    ${JOIN_CLAUSE}
    WHERE k.killmailTime >= NOW() - ({hoursAgo:UInt32} || ' hours')::interval
      AND k.attackerCount > 0
    ORDER BY k.totalValue DESC, k.killmailTime DESC, k.killmailId
    LIMIT {limit:UInt32}`,
    { periodType, hoursAgo, limit }
  )
}

/**
 * Get most valuable kills for a specific character
 */
export async function getMostValuableKillsByCharacter(
  characterId: number,
  periodType: 'hour' | 'day' | 'week' | 'month' | 'all',
  limit: number = 50
): Promise<MostValuableKill[]> {
  // Calculate time threshold based on period type
  let hoursAgo: number
  switch (periodType) {
    case 'hour':
      hoursAgo = 1
      break
    case 'day':
      hoursAgo = 24
      break
    case 'week':
      hoursAgo = 168
      break
    case 'month':
      hoursAgo = 720
      break
    case 'all':
      hoursAgo = 876000 // ~100 years
      break
  }

  return await database.query<MostValuableKill>(
    `SELECT ${SELECT_CLAUSE}
     ${JOIN_CLAUSE}
     WHERE k.victimCharacterId = {characterId:UInt32}
       AND k.killmailTime >= NOW() - ({hoursAgo:UInt32} || ' hours')::interval
     ORDER BY k.totalValue DESC, k.killmailTime DESC, k.killmailId
     LIMIT {limit:UInt32}`,
    { periodType, characterId, hoursAgo, limit }
  )
}

/**
 * Get most valuable kills for a specific corporation
 */
export async function getMostValuableKillsByCorporation(
  corporationId: number,
  periodType: 'hour' | 'day' | 'week' | 'month' | 'all',
  limit: number = 50
): Promise<MostValuableKill[]> {
  // Calculate time threshold based on period type
  let hoursAgo: number
  switch (periodType) {
    case 'hour':
      hoursAgo = 1
      break
    case 'day':
      hoursAgo = 24
      break
    case 'week':
      hoursAgo = 168
      break
    case 'month':
      hoursAgo = 720
      break
    case 'all':
      hoursAgo = 876000 // ~100 years
      break
  }

  return await database.query<MostValuableKill>(
    `SELECT ${SELECT_CLAUSE}
     ${JOIN_CLAUSE}
     WHERE k.victimCorporationId = {corporationId:UInt32}
       AND k.killmailTime >= NOW() - ({hoursAgo:UInt32} || ' hours')::interval
     ORDER BY k.totalValue DESC, k.killmailTime DESC, k.killmailId
     LIMIT {limit:UInt32}`,
    { periodType, corporationId, hoursAgo, limit }
  )
}

/**
 * Get most valuable kills for a specific alliance
 */
export async function getMostValuableKillsByAlliance(
  allianceId: number,
  periodType: 'hour' | 'day' | 'week' | 'month' | 'all',
  limit: number = 50
): Promise<MostValuableKill[]> {
  // Calculate time threshold based on period type
  let hoursAgo: number
  switch (periodType) {
    case 'hour':
      hoursAgo = 1
      break
    case 'day':
      hoursAgo = 24
      break
    case 'week':
      hoursAgo = 168
      break
    case 'month':
      hoursAgo = 720
      break
    case 'all':
      hoursAgo = 876000 // ~100 years
      break
  }

  return await database.query<MostValuableKill>(
    `SELECT ${SELECT_CLAUSE}
     ${JOIN_CLAUSE}
     WHERE k.victimAllianceId = {allianceId:UInt32}
       AND k.killmailTime >= NOW() - ({hoursAgo:UInt32} || ' hours')::interval
     ORDER BY k.totalValue DESC, k.killmailTime DESC, k.killmailId
     LIMIT {limit:UInt32}`,
    { periodType, allianceId, hoursAgo, limit }
  )
}

/**
 * Get most valuable solo kills
 */
export async function getMostValuableSoloKills(
  periodType: 'hour' | 'day' | 'week' | 'month' | 'all',
  limit: number = 50
): Promise<MostValuableKill[]> {
  // Calculate time threshold based on period type
  let hoursAgo: number
  switch (periodType) {
    case 'hour':
      hoursAgo = 1
      break
    case 'day':
      hoursAgo = 24
      break
    case 'week':
      hoursAgo = 168
      break
    case 'month':
      hoursAgo = 720
      break
    case 'all':
      hoursAgo = 876000 // ~100 years
      break
  }

  return await database.query<MostValuableKill>(
    `SELECT ${SELECT_CLAUSE}
     ${JOIN_CLAUSE}
     WHERE k.solo = true
       AND k.killmailTime >= NOW() - ({hoursAgo:UInt32} || ' hours')::interval
     ORDER BY k.totalValue DESC, k.killmailTime DESC, k.killmailId
     LIMIT {limit:UInt32}`,
    { periodType, hoursAgo, limit }
  )
}

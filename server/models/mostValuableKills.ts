import { database } from '../helpers/database'

/**
 * Most Valuable Kills Model
 *
 * Queries the most_valuable_kills materialized view
 * Tracks the most expensive kills by time period
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

/**
 * Get most valuable kills for a period
 * Uses denormalized view for O(1) lookup performance regardless of data size
 * Denormalized data means: no JOINs needed, just table scan + filter + sort
 * Performance: ~100ms regardless of data volume (previously 4+ seconds with JOINs)
 *
 * IMPORTANT: This requires entities to be inserted BEFORE killmails
 * Enforced in ekws.ts (WebSocket ingestion) and backfill.ts (historical data)
 *
 * Optimization: Uses most_valuable_kills_latest table (no CROSS JOIN multiplication)
 * Period type is computed client-side to enable efficient partition pruning on killmailTime
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
      {periodType:String} as periodType,
      killmailId,
      killmailTime,
      solarSystemId,
      solarSystemName,
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
      victimShipGroupId as victimShipGroup,
      totalValue,
      attackerCount,
      npc,
      solo,
      topAttackerCharacterId as attackerCharacterId,
      topAttackerCharacterName as attackerCharacterName,
      topAttackerCorporationId as attackerCorporationId,
      topAttackerCorporationName as attackerCorporationName,
      topAttackerCorporationTicker as attackerCorporationTicker,
      topAttackerAllianceId as attackerAllianceId,
      topAttackerAllianceName as attackerAllianceName,
      topAttackerAllianceTicker as attackerAllianceTicker,
      regionName
    FROM most_valuable_kills_latest
    WHERE killmailTime >= now() - INTERVAL {hoursAgo:UInt32} HOUR
      AND attackerCount > 0
    ORDER BY totalValue DESC, killmailTime DESC, killmailId
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
    `SELECT {periodType:String} as periodType, * FROM most_valuable_kills_latest
     WHERE victimCharacterId = {characterId:UInt32}
       AND killmailTime >= now() - INTERVAL {hoursAgo:UInt32} HOUR
     ORDER BY totalValue DESC, killmailTime DESC, killmailId
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
    `SELECT {periodType:String} as periodType, * FROM most_valuable_kills_latest
     WHERE victimCorporationId = {corporationId:UInt32}
       AND killmailTime >= now() - INTERVAL {hoursAgo:UInt32} HOUR
     ORDER BY totalValue DESC, killmailTime DESC, killmailId
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
    `SELECT {periodType:String} as periodType, * FROM most_valuable_kills_latest
     WHERE victimAllianceId = {allianceId:UInt32}
       AND killmailTime >= now() - INTERVAL {hoursAgo:UInt32} HOUR
     ORDER BY totalValue DESC, killmailTime DESC, killmailId
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
    `SELECT {periodType:String} as periodType, * FROM most_valuable_kills_latest
     WHERE solo = true
       AND killmailTime >= now() - INTERVAL {hoursAgo:UInt32} HOUR
     ORDER BY totalValue DESC, killmailTime DESC, killmailId
     LIMIT {limit:UInt32}`,
    { periodType, hoursAgo, limit }
  )
}

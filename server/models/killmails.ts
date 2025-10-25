import { database } from '../helpers/database'

/**
 * Killmails Model
 *
 * Provides query methods for killmails table
 */

export interface Killmail {
  killmailId: number
  killmailTime: string
  solarSystemId: number
  victimAllianceId?: number
  victimCharacterId: number
  victimCorporationId: number
  victimDamageTaken: number
  victimShipTypeId: number
  positionX: number
  positionY: number
  positionZ: number
  createdAt: string
  version: number
}

// Query methods will be added as needed

/**
 * NPC Station Queries
 * Query methods for accessing npcStations table
 */

import { database } from '../helpers/database'

export class NPCStationQueries {
  static async getStation(stationId: number) {
    const result = await database.query(`
      SELECT * FROM edk.npcStations WHERE stationId = ${stationId} LIMIT 1
    `)
    return result[0] || null
  }

  static async getStationsBySystem(solarSystemId: number) {
    return await database.query(`
      SELECT * FROM edk.npcStations WHERE solarSystemId = ${solarSystemId} ORDER BY stationId
    `)
  }

  static async searchStations(query: string, limit: number = 10) {
    return await database.query(`
      SELECT * FROM edk.npcStations
      WHERE name ILIKE '%${query}%'
      ORDER BY stationId
      LIMIT ${limit}
    `)
  }

  static async getStationName(stationId: number): Promise<string | null> {
    const result = await database.query(`
      SELECT name FROM edk.npcStations WHERE stationId = ${stationId} LIMIT 1
    `)
    return result[0]?.name || null
  }

  static async countStations(): Promise<number> {
    const result = await database.query(`SELECT count() FROM edk.npcStations`)
    return result[0]['count()'] || 0
  }

  static async getStationsByOperation(operationId: number) {
    return await database.query(`
      SELECT * FROM edk.npcStations WHERE operationId = ${operationId} ORDER BY stationId
    `)
  }
}

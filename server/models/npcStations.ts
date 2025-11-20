/**
 * NPC Station Queries
 * Query methods for accessing npcStations table
 */

import { database } from '../helpers/database'

export class NPCStationQueries {
  static async getStation(stationId: number) {
    const result = await database.query(
      `SELECT * FROM npcStations WHERE stationId = {stationId:UInt32} LIMIT 1`,
      { stationId }
    )
    return result[0] || null
  }

  static async getStationsBySystem(solarSystemId: number) {
    return await database.query(
      `SELECT * FROM npcStations WHERE solarSystemId = {solarSystemId:UInt32} ORDER BY stationId`,
      { solarSystemId }
    )
  }

  static async searchStations(query: string, limit: number = 10) {
    return await database.query(
      `SELECT * FROM npcStations
       WHERE name ILIKE {query:String}
       ORDER BY stationId
       LIMIT {limit:UInt32}`,
      { query: `%${query}%`, limit }
    )
  }

  static async getStationName(stationId: number): Promise<string | null> {
    const result = await database.query(
      `SELECT name FROM npcStations WHERE stationId = {stationId:UInt32} LIMIT 1`,
      { stationId }
    )
    return result[0]?.name || null
  }

  static async countStations(): Promise<number> {
    const result = await database.query(`SELECT count(*) FROM npcStations`)
    return result[0]['count(*)'] || 0
  }

  static async getStationsByOperation(operationId: number) {
    return await database.query(
      `SELECT * FROM npcStations WHERE operationId = {operationId:UInt32} ORDER BY stationId`,
      { operationId }
    )
  }
}

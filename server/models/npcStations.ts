/**
 * NPC Station Queries
 * Query methods for accessing npcStations table
 */

import { database } from '../helpers/database'

export class NPCStationQueries {
  static async getStation(stationId: number) {
    const [result] = await database.sql`
      SELECT * FROM npcStations WHERE stationId = ${stationId} LIMIT 1
    `
    return result || null
  }

  static async getStationsBySystem(solarSystemId: number) {
    return await database.sql`
      SELECT * FROM npcStations WHERE solarSystemId = ${solarSystemId} ORDER BY stationId
    `
  }

  static async searchStations(query: string, limit: number = 10) {
    return await database.sql`
      SELECT * FROM npcStations
       WHERE name ILIKE ${`%${query}%`}
       ORDER BY stationId
       LIMIT ${limit}
    `
  }

  static async getStationName(stationId: number): Promise<string | null> {
    const [result] = await database.sql`
      SELECT name FROM npcStations WHERE stationId = ${stationId} LIMIT 1
    `
    return result?.name || null
  }

  static async countStations(): Promise<number> {
    const [result] = await database.sql<{count: number}[]>`SELECT count(*) as count FROM npcStations`
    return Number(result?.count || 0)
  }

  static async getStationsByOperation(operationId: number) {
    return await database.sql`
      SELECT * FROM npcStations WHERE operationId = ${operationId} ORDER BY stationId
    `
  }
}

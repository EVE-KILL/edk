/**
 * Faction Queries
 * Query methods for accessing factions table
 */

import { database } from '../helpers/database'

export class FactionQueries {
  static async getFaction(factionId: number) {
    const result = await database.query(
      `SELECT * FROM factions WHERE factionId = {factionId:UInt32} LIMIT 1`,
      { factionId }
    )
    return result[0] || null
  }

  static async getFactionName(factionId: number): Promise<string | null> {
    const result = await database.query(
      `SELECT name FROM factions WHERE factionId = {factionId:UInt32} LIMIT 1`,
      { factionId }
    )
    return result[0]?.name || null
  }

  static async getAllFactions() {
    return await database.query(`
      SELECT * FROM factions ORDER BY factionId
    `)
  }

  static async searchFactions(query: string, limit: number = 10) {
    return await database.query(
      `SELECT * FROM factions
       WHERE name ILIKE {query:String}
       ORDER BY factionId
       LIMIT {limit:UInt32}`,
      { query: `%${query}%`, limit }
    )
  }

  static async countFactions(): Promise<number> {
    const result = await database.query(`SELECT count(*) FROM factions`)
    return result[0]['count(*)'] || 0
  }
}

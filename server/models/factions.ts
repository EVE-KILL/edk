/**
 * Faction Queries
 * Query methods for accessing factions table
 */

import { database } from '../helpers/database'

export class FactionQueries {
  static async getFaction(factionId: number) {
    const result = await database.query(`
      SELECT * FROM edk.factions WHERE factionId = ${factionId} LIMIT 1
    `)
    return result[0] || null
  }

  static async getFactionName(factionId: number): Promise<string | null> {
    const result = await database.query(`
      SELECT name FROM edk.factions WHERE factionId = ${factionId} LIMIT 1
    `)
    return result[0]?.name || null
  }

  static async getAllFactions() {
    return await database.query(`
      SELECT * FROM edk.factions ORDER BY factionId
    `)
  }

  static async searchFactions(query: string, limit: number = 10) {
    return await database.query(`
      SELECT * FROM edk.factions
      WHERE name ILIKE '%${query}%'
      ORDER BY factionId
      LIMIT ${limit}
    `)
  }

  static async countFactions(): Promise<number> {
    const result = await database.query(`SELECT count() FROM edk.factions`)
    return result[0]['count()'] || 0
  }
}

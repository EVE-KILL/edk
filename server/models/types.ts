/**
 * Type/Item Queries
 * Query methods for accessing types table
 */

import { database } from '../helpers/database'

export class TypeQueries {
  static async getType(typeId: number) {
    const result = await database.query(
      `SELECT * FROM types WHERE typeId = {typeId:UInt32} LIMIT 1`,
      { typeId }
    )
    return result[0] || null
  }

  static async getTypeName(typeId: number): Promise<string | null> {
    const result = await database.query(
      `SELECT name FROM types WHERE typeId = {typeId:UInt32} LIMIT 1`,
      { typeId }
    )
    return result[0]?.name || null
  }

  static async getTypesByGroup(groupId: number, limit: number = 1000) {
    return await database.query(
      `SELECT * FROM types WHERE groupId = {groupId:UInt32} ORDER BY typeId LIMIT {limit:UInt32}`,
      { groupId, limit }
    )
  }

  static async searchTypes(query: string, limit: number = 10) {
    return await database.query(
      `SELECT * FROM types
       WHERE name ILIKE {query:String}
       ORDER BY typeId
       LIMIT {limit:UInt32}`,
      { query: `%${query}%`, limit }
    )
  }

  static async getTypesByMarketGroup(marketGroupId: number, limit: number = 1000) {
    return await database.query(
      `SELECT * FROM types WHERE marketGroupId = {marketGroupId:UInt32} ORDER BY typeId LIMIT {limit:UInt32}`,
      { marketGroupId, limit }
    )
  }

  static async getPublishedTypes(limit: number = 1000) {
    return await database.query(
      `SELECT * FROM types WHERE published = 1 ORDER BY typeId LIMIT {limit:UInt32}`,
      { limit }
    )
  }

  static async countTypes(): Promise<number> {
    const result = await database.query(`SELECT count(*) FROM types`)
    return result[0]['count(*)'] || 0
  }
}

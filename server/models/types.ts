/**
 * Type/Item Queries
 * Query methods for accessing types table
 */

import { database } from '../helpers/database';

export class TypeQueries {
  static async getType(typeId: number) {
    const [result] = await database.sql`
      SELECT * FROM types WHERE "typeId" = ${typeId} LIMIT 1
    `;
    return result || null;
  }

  static async getTypeName(typeId: number): Promise<string | null> {
    const [result] = await database.sql`
      SELECT name FROM types WHERE "typeId" = ${typeId} LIMIT 1
    `;
    return result?.name || null;
  }

  static async getTypesByGroup(groupId: number, limit: number = 1000) {
    return await database.sql`
      SELECT * FROM types WHERE "groupId" = ${groupId} ORDER BY "typeId" LIMIT ${limit}
    `;
  }

  static async searchTypes(query: string, limit: number = 10) {
    return await database.sql`
      SELECT * FROM types
       WHERE name ILIKE ${`%${query}%`}
       ORDER BY "typeId"
       LIMIT ${limit}
    `;
  }

  static async getTypesByMarketGroup(
    marketGroupId: number,
    limit: number = 1000
  ) {
    return await database.sql`
      SELECT * FROM types WHERE "marketGroupId" = ${marketGroupId} ORDER BY "typeId" LIMIT ${limit}
    `;
  }

  static async getPublishedTypes(limit: number = 1000) {
    return await database.sql`
      SELECT * FROM types WHERE published = 1 ORDER BY "typeId" LIMIT ${limit}
    `;
  }

  static async countTypes(): Promise<number> {
    const [result] = await database.sql<
      { count: number }[]
    >`SELECT count(*) as count FROM types`;
    return Number(result?.count || 0);
  }
}

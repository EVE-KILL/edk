/**
 * Type/Item Queries
 * Query methods for accessing types table
 */

import { database } from '../helpers/database';

export class TypeQueries {
  static async getType(typeId: number) {
    return database.findOne(
      'SELECT * FROM types WHERE "typeId" = :typeId LIMIT 1',
      { typeId }
    );
  }

  static async getTypeName(typeId: number): Promise<string | null> {
    const result = await database.findOne<{ name: string }>(
      'SELECT "name" FROM types WHERE "typeId" = :typeId LIMIT 1',
      { typeId }
    );
    return result?.name || null;
  }

  static async getTypesByGroup(groupId: number, limit: number = 1000) {
    return database.find(
      'SELECT * FROM types WHERE "groupId" = :groupId ORDER BY "typeId" LIMIT :limit',
      { groupId, limit }
    );
  }

  static async searchTypes(query: string, limit: number = 10) {
    return database.find(
      `SELECT * FROM types
         WHERE "name" ILIKE :pattern
         ORDER BY "typeId"
         LIMIT :limit`,
      { pattern: `%${query}%`, limit }
    );
  }

  static async getTypesByMarketGroup(
    marketGroupId: number,
    limit: number = 1000
  ) {
    return database.find(
      'SELECT * FROM types WHERE "marketGroupId" = :marketGroupId ORDER BY "typeId" LIMIT :limit',
      { marketGroupId, limit }
    );
  }

  static async getPublishedTypes(limit: number = 1000) {
    return database.find(
      'SELECT * FROM types WHERE published = 1 ORDER BY "typeId" LIMIT :limit',
      { limit }
    );
  }

  static async countTypes(): Promise<number> {
    const result = await database.findOne<{ count: number }>(
      'SELECT count(*) as count FROM types'
    );
    return Number(result?.count || 0);
  }
}

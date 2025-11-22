/**
 * Faction Queries
 * Query methods for accessing factions table
 */

import { database } from '../helpers/database';

export class FactionQueries {
  static async getFaction(factionId: number) {
    return database.findOne(
      'SELECT * FROM factions WHERE "factionId" = :factionId LIMIT 1',
      { factionId }
    );
  }

  static async getFactionName(factionId: number): Promise<string | null> {
    const result = await database.findOne<{ name: string }>(
      'SELECT name FROM factions WHERE "factionId" = :factionId LIMIT 1',
      { factionId }
    );
    return result?.name || null;
  }

  static async getAllFactions() {
    return database.find('SELECT * FROM factions ORDER BY "factionId"');
  }

  static async searchFactions(query: string, limit: number = 10) {
    return database.find(
      `SELECT * FROM factions
         WHERE name ILIKE :pattern
         ORDER BY "factionId"
         LIMIT :limit`,
      { pattern: `%${query}%`, limit }
    );
  }

  static async countFactions(): Promise<number> {
    const result = await database.findOne<{ count: number }>(
      'SELECT count(*) as count FROM factions'
    );
    return Number(result?.count || 0);
  }
}

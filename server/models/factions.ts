/**
 * Faction Queries
 * Query methods for accessing factions table
 */

import { database } from '../helpers/database';

export class FactionQueries {
  static async getFaction(factionId: number) {
    const [result] = await database.sql`
      SELECT * FROM factions WHERE factionId = ${factionId} LIMIT 1
    `;
    return result || null;
  }

  static async getFactionName(factionId: number): Promise<string | null> {
    const [result] = await database.sql`
      SELECT name FROM factions WHERE factionId = ${factionId} LIMIT 1
    `;
    return result?.name || null;
  }

  static async getAllFactions() {
    return await database.sql`
      SELECT * FROM factions ORDER BY factionId
    `;
  }

  static async searchFactions(query: string, limit: number = 10) {
    return await database.sql`
      SELECT * FROM factions
       WHERE name ILIKE ${`%${query}%`}
       ORDER BY factionId
       LIMIT ${limit}
    `;
  }

  static async countFactions(): Promise<number> {
    const [result] = await database.sql<
      { count: number }[]
    >`SELECT count(*) as count FROM factions`;
    return Number(result?.count || 0);
  }
}

/**
 * NPC Station Queries
 * Query methods for accessing npcStations table
 */

import { database } from '../helpers/database';

export class NPCStationQueries {
  static async getStation(stationId: number) {
    return database.findOne(
      'SELECT * FROM "npcStations" WHERE "stationId" = :stationId LIMIT 1',
      { stationId }
    );
  }

  static async getStationsBySystem(solarSystemId: number) {
    return database.find(
      'SELECT * FROM "npcStations" WHERE "solarSystemId" = :solarSystemId ORDER BY "stationId"',
      { solarSystemId }
    );
  }

  static async searchStations(query: string, limit: number = 10) {
    return database.find(
      `SELECT * FROM "npcStations"
         WHERE "name" ILIKE :pattern
         ORDER BY "stationId"
         LIMIT :limit`,
      { pattern: `%${query}%`, limit }
    );
  }

  static async getStationName(stationId: number): Promise<string | null> {
    const result = await database.findOne<{ name: string }>(
      'SELECT "name" FROM "npcStations" WHERE "stationId" = :stationId LIMIT 1',
      { stationId }
    );
    return result?.name || null;
  }

  static async countStations(): Promise<number> {
    const result = await database.findOne<{ count: number }>(
      'SELECT count(*) as count FROM "npcStations"'
    );
    return Number(result?.count || 0);
  }

  static async getStationsByOperation(operationId: number) {
    return database.find(
      'SELECT * FROM "npcStations" WHERE "operationId" = :operationId ORDER BY "stationId"',
      { operationId }
    );
  }
}

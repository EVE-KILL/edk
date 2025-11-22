import { database } from '../helpers/database';

/**
 * Station Operations Model
 *
 * Provides query methods for stationOperations SDE table
 */

export interface StationOperation {
  operationId: number;
  name: string;
  description?: string;
  activityId?: number;
  border?: number;
  corridor?: number;
  fringe?: number;
  hub?: number;
  manufacturingFactor?: number;
  ratio?: number;
  researchFactor?: number;
  stationType?: string;
}

/**
 * Get a single station operation by ID
 */
export async function getStationOperation(
  operationId: number
): Promise<StationOperation | null> {
  return database.findOne<StationOperation>(
    'SELECT * FROM "stationOperations" WHERE "operationId" = :operationId',
    { operationId }
  );
}

/**
 * Get all station operations
 */
export async function getAllStationOperations(): Promise<StationOperation[]> {
  return database.find<StationOperation>(
    'SELECT * FROM "stationOperations" ORDER BY name'
  );
}

/**
 * Get station operations by type
 */
export async function getStationOperationsByType(
  stationType: string
): Promise<StationOperation[]> {
  return database.find<StationOperation>(
    'SELECT * FROM "stationOperations" WHERE "stationType" = :stationType ORDER BY name',
    { stationType }
  );
}

/**
 * Search station operations by name
 */
export async function searchStationOperations(
  namePattern: string,
  limit: number = 10
): Promise<StationOperation[]> {
  return database.find<StationOperation>(
    `SELECT * FROM "stationOperations"
     WHERE name ILIKE :pattern
     ORDER BY name
     LIMIT :limit`,
    { pattern: `%${namePattern}%`, limit }
  );
}

/**
 * Get station operation name by ID
 */
export async function getStationOperationName(
  operationId: number
): Promise<string | null> {
  const result = await database.findOne<{ name: string }>(
    'SELECT name FROM "stationOperations" WHERE "operationId" = :operationId',
    { operationId }
  );
  return result?.name || null;
}

/**
 * Count total station operations
 */
export async function countStationOperations(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    'SELECT count(*) as count FROM "stationOperations"'
  );
  return Number(result?.count || 0);
}

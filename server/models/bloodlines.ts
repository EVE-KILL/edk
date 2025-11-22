import { database } from '../helpers/database';

/**
 * Bloodlines Model
 *
 * Provides query methods for bloodlines SDE table
 */

export interface Bloodline {
  bloodlineId: number;
  name: string;
  description?: string;
  raceId: number;
  shipTypeId?: number;
  corporationId?: number;
  charisma?: number;
  constitution?: number;
  intelligence?: number;
  memory?: number;
  perception?: number;
  willpower?: number;
}

/**
 * Get a single bloodline by ID
 */
export async function getBloodline(
  bloodlineId: number
): Promise<Bloodline | null> {
  return database.findOne<Bloodline>(
    'SELECT * FROM bloodlines WHERE "bloodlineId" = :bloodlineId',
    { bloodlineId }
  );
}

/**
 * Get all bloodlines for a race
 */
export async function getBloodlinesByRace(
  raceId: number
): Promise<Bloodline[]> {
  return database.find<Bloodline>(
    'SELECT * FROM bloodlines WHERE "raceId" = :raceId ORDER BY name',
    { raceId }
  );
}

/**
 * Get all bloodlines
 */
export async function getAllBloodlines(): Promise<Bloodline[]> {
  return database.find<Bloodline>(
    'SELECT * FROM bloodlines ORDER BY "raceId", name'
  );
}

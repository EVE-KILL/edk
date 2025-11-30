import { database } from '../helpers/database';

/**
 * DogmaUnit interface - Units for dogma attributes (m, %, etc.)
 */
export interface DogmaUnit {
  unitId: number;
  name: string;
  description?: string;
  displayName?: string;
}

/**
 * Get dogma unit by ID
 */
export async function getDogmaUnit(unitId: number): Promise<DogmaUnit | null> {
  return database.findOne<DogmaUnit>(
    `SELECT * FROM dogmaunits WHERE "unitId" = :unitId`,
    { unitId }
  );
}

/**
 * Get all dogma units
 */
export async function getAllDogmaUnits(): Promise<DogmaUnit[]> {
  return database.find<DogmaUnit>(`SELECT * FROM dogmaunits ORDER BY "unitId"`);
}

/**
 * Get unit display name
 */
export async function getUnitDisplayName(
  unitId: number
): Promise<string | null> {
  const result = await database.findOne<{ displayName: string }>(
    `SELECT "displayName" FROM dogmaunits WHERE "unitId" = :unitId`,
    { unitId }
  );
  return result?.displayName ?? null;
}

/**
 * Count total dogma units
 */
export async function countDogmaUnits(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM dogmaunits`
  );
  return result?.count ?? 0;
}

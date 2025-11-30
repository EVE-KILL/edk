import { database } from '../helpers/database';

/**
 * Mastery interface - Ship mastery levels
 */
export interface Mastery {
  typeId: number;
  masteryLevels?: any[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Get mastery by type ID
 */
export async function getMastery(typeId: number): Promise<Mastery | null> {
  return database.findOne<Mastery>(
    `SELECT * FROM masteries WHERE "typeId" = :typeId`,
    { typeId }
  );
}

/**
 * Get all masteries
 */
export async function getAllMasteries(): Promise<Mastery[]> {
  return database.find<Mastery>(`SELECT * FROM masteries ORDER BY "typeId"`);
}

/**
 * Check if type has mastery levels
 */
export async function typeHasMastery(typeId: number): Promise<boolean> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM masteries WHERE "typeId" = :typeId`,
    { typeId }
  );
  return (result?.count ?? 0) > 0;
}

/**
 * Count total masteries
 */
export async function countMasteries(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM masteries`
  );
  return result?.count ?? 0;
}

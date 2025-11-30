import { database } from '../helpers/database';

/**
 * DogmaAttributeCategory interface
 */
export interface DogmaAttributeCategory {
  categoryId: number;
  name: string;
  description?: string;
}

/**
 * Get dogma attribute category by ID
 */
export async function getDogmaAttributeCategory(
  categoryId: number
): Promise<DogmaAttributeCategory | null> {
  return database.findOne<DogmaAttributeCategory>(
    `SELECT * FROM dogmaattributecategories WHERE "categoryId" = :categoryId`,
    { categoryId }
  );
}

/**
 * Get all dogma attribute categories
 */
export async function getAllDogmaAttributeCategories(): Promise<
  DogmaAttributeCategory[]
> {
  return database.find<DogmaAttributeCategory>(
    `SELECT * FROM dogmaattributecategories ORDER BY "categoryId"`
  );
}

/**
 * Count total dogma attribute categories
 */
export async function countDogmaAttributeCategories(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM dogmaattributecategories`
  );
  return result?.count ?? 0;
}

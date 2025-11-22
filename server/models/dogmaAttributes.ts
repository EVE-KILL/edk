import { database } from '../helpers/database';

/**
 * Dogma Attributes Model
 *
 * Provides query methods for dogmaAttributes SDE table
 */

export interface DogmaAttribute {
  attributeId: number;
  name: string;
  categoryId?: number;
  defaultValue?: number;
  description?: string;
  displayName?: string;
  iconId?: number;
  highIsGood: number;
  published: number;
  stackable: number;
  unitId?: number;
}

/**
 * Get a single dogma attribute by ID
 */
export async function getDogmaAttribute(
  attributeId: number
): Promise<DogmaAttribute | null> {
  const [row] = await database.sql<DogmaAttribute[]>`
    SELECT * FROM dogmaAttributes WHERE attributeId = ${attributeId}
  `;
  return row || null;
}

/**
 * Get all published dogma attributes
 */
export async function getPublishedDogmaAttributes(): Promise<DogmaAttribute[]> {
  return await database.sql<DogmaAttribute[]>`
    SELECT * FROM dogmaAttributes WHERE published = 1 ORDER BY name
  `;
}

/**
 * Get dogma attributes by category
 */
export async function getDogmaAttributesByCategory(
  categoryId: number
): Promise<DogmaAttribute[]> {
  return await database.sql<DogmaAttribute[]>`
    SELECT * FROM dogmaAttributes WHERE categoryId = ${categoryId} ORDER BY name
  `;
}

/**
 * Search dogma attributes by name
 */
export async function searchDogmaAttributes(
  namePattern: string,
  limit: number = 10
): Promise<DogmaAttribute[]> {
  return await database.sql<DogmaAttribute[]>`
    SELECT * FROM dogmaAttributes
    WHERE name ILIKE ${`%${namePattern}%`}
    ORDER BY name
    LIMIT ${limit}
  `;
}

/**
 * Get dogma attribute name by ID
 */
export async function getDogmaAttributeName(
  attributeId: number
): Promise<string | null> {
  const [result] = await database.sql<{ name: string }[]>`
    SELECT name FROM dogmaAttributes WHERE attributeId = ${attributeId}
  `;
  return result?.name || null;
}

/**
 * Count total dogma attributes
 */
export async function countDogmaAttributes(): Promise<number> {
  const [result] = await database.sql<{ count: number }[]>`
    SELECT count(*) as count FROM dogmaAttributes
  `;
  return Number(result?.count || 0);
}

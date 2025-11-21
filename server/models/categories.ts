import { database } from '../helpers/database'

/**
 * Categories Model
 *
 * Provides query methods for categories SDE table
 */

export interface Category {
  categoryId: number
  name: string
  iconId?: number
  published: number
}

/**
 * Get a single category by ID
 */
export async function getCategory(categoryId: number): Promise<Category | null> {
  const [row] = await database.sql<Category[]>`
    SELECT * FROM categories WHERE categoryId = ${categoryId}
  `
  return row || null
}

/**
 * Get all published categories
 */
export async function getPublishedCategories(): Promise<Category[]> {
  return await database.sql<Category[]>`
    SELECT * FROM categories WHERE published = 1 ORDER BY name
  `
}

/**
 * Get all categories
 */
export async function getAllCategories(): Promise<Category[]> {
  return await database.sql<Category[]>`
    SELECT * FROM categories ORDER BY name
  `
}

/**
 * Search categories by name
 */
export async function searchCategories(namePattern: string, limit: number = 10): Promise<Category[]> {
  return await database.sql<Category[]>`
    SELECT * FROM categories
    WHERE name ILIKE ${`%${namePattern}%`}
    ORDER BY name
    LIMIT ${limit}
  `
}

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
  return await database.queryOne<Category>(
    'SELECT * FROM edk.categories WHERE categoryId = {id:UInt32}',
    { id: categoryId }
  )
}

/**
 * Get all published categories
 */
export async function getPublishedCategories(): Promise<Category[]> {
  return await database.query<Category>(
    'SELECT * FROM edk.categories WHERE published = 1 ORDER BY name'
  )
}

/**
 * Get all categories
 */
export async function getAllCategories(): Promise<Category[]> {
  return await database.query<Category>(
    'SELECT * FROM edk.categories ORDER BY name'
  )
}

/**
 * Search categories by name
 */
export async function searchCategories(namePattern: string, limit: number = 10): Promise<Category[]> {
  return await database.query<Category>(
    'SELECT * FROM edk.categories WHERE name LIKE {pattern:String} ORDER BY name LIMIT {limit:UInt32}',
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get category name by ID
 */
export async function getCategoryName(categoryId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM edk.categories WHERE categoryId = {id:UInt32}',
    { id: categoryId }
  )
  return result || null
}

/**
 * Count total categories
 */
export async function countCategories(): Promise<number> {
  return await database.count('edk.categories')
}

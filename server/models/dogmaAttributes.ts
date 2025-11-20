import { database } from '../helpers/database'

/**
 * Dogma Attributes Model
 *
 * Provides query methods for dogmaAttributes SDE table
 */

export interface DogmaAttribute {
  attributeId: number
  name: string
  categoryId?: number
  defaultValue?: number
  description?: string
  displayName?: string
  iconId?: number
  highIsGood: number
  published: number
  stackable: number
  unitId?: number
}

/**
 * Get a single dogma attribute by ID
 */
export async function getDogmaAttribute(attributeId: number): Promise<DogmaAttribute | null> {
  return await database.queryOne<DogmaAttribute>(
    'SELECT * FROM dogmaAttributes WHERE attributeId = {id:UInt32}',
    { id: attributeId }
  )
}

/**
 * Get all published dogma attributes
 */
export async function getPublishedDogmaAttributes(): Promise<DogmaAttribute[]> {
  return await database.query<DogmaAttribute>(
    'SELECT * FROM dogmaAttributes WHERE published = 1 ORDER BY name'
  )
}

/**
 * Get dogma attributes by category
 */
export async function getDogmaAttributesByCategory(categoryId: number): Promise<DogmaAttribute[]> {
  return await database.query<DogmaAttribute>(
    'SELECT * FROM dogmaAttributes WHERE categoryId = {categoryId:UInt32} ORDER BY name',
    { categoryId }
  )
}

/**
 * Search dogma attributes by name
 */
export async function searchDogmaAttributes(namePattern: string, limit: number = 10): Promise<DogmaAttribute[]> {
  return await database.query<DogmaAttribute>(
    'SELECT * FROM dogmaAttributes WHERE name LIKE {pattern:String} ORDER BY name LIMIT {limit:UInt32}',
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get dogma attribute name by ID
 */
export async function getDogmaAttributeName(attributeId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM dogmaAttributes WHERE attributeId = {id:UInt32}',
    { id: attributeId }
  )
  return result || null
}

/**
 * Count total dogma attributes
 */
export async function countDogmaAttributes(): Promise<number> {
  return await database.count('dogmaAttributes')
}

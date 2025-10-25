import { database } from '../helpers/database'

/**
 * Market Groups Model
 *
 * Provides query methods for marketGroups SDE table
 */

export interface MarketGroup {
  marketGroupId: number
  name: string
  description?: string
  iconId?: number
  hasTypes: number
  parentGroupId?: number
}

/**
 * Get a single market group by ID
 */
export async function getMarketGroup(marketGroupId: number): Promise<MarketGroup | null> {
  return await database.queryOne<MarketGroup>(
    'SELECT * FROM edk.marketGroups WHERE marketGroupId = {id:UInt32}',
    { id: marketGroupId }
  )
}

/**
 * Get all child market groups
 */
export async function getMarketGroupsByParent(parentGroupId: number): Promise<MarketGroup[]> {
  return await database.query<MarketGroup>(
    'SELECT * FROM edk.marketGroups WHERE parentGroupId = {parentId:UInt32} ORDER BY name',
    { parentId: parentGroupId }
  )
}

/**
 * Get root market groups
 */
export async function getRootMarketGroups(): Promise<MarketGroup[]> {
  return await database.query<MarketGroup>(
    'SELECT * FROM edk.marketGroups WHERE parentGroupId IS NULL ORDER BY name'
  )
}

/**
 * Get market groups that have types
 */
export async function getMarketGroupsWithTypes(): Promise<MarketGroup[]> {
  return await database.query<MarketGroup>(
    'SELECT * FROM edk.marketGroups WHERE hasTypes = 1 ORDER BY name'
  )
}

/**
 * Search market groups by name
 */
export async function searchMarketGroups(namePattern: string, limit: number = 10): Promise<MarketGroup[]> {
  return await database.query<MarketGroup>(
    'SELECT * FROM edk.marketGroups WHERE name LIKE {pattern:String} ORDER BY name LIMIT {limit:UInt32}',
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get market group name by ID
 */
export async function getMarketGroupName(marketGroupId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM edk.marketGroups WHERE marketGroupId = {id:UInt32}',
    { id: marketGroupId }
  )
  return result || null
}

/**
 * Count total market groups
 */
export async function countMarketGroups(): Promise<number> {
  return await database.count('edk.marketGroups')
}

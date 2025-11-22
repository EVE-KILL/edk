import { database } from '../helpers/database';

/**
 * Market Groups Model
 *
 * Provides query methods for marketGroups SDE table
 */

export interface MarketGroup {
  marketGroupId: number;
  name: string;
  description?: string;
  iconId?: number;
  hasTypes: number;
  parentGroupId?: number;
}

/**
 * Get a single market group by ID
 */
export async function getMarketGroup(
  marketGroupId: number
): Promise<MarketGroup | null> {
  const [row] = await database.sql<MarketGroup[]>`
    SELECT * FROM marketGroups WHERE marketGroupId = ${marketGroupId}
  `;
  return row || null;
}

/**
 * Get all child market groups
 */
export async function getMarketGroupsByParent(
  parentGroupId: number
): Promise<MarketGroup[]> {
  return await database.sql<MarketGroup[]>`
    SELECT * FROM marketGroups WHERE parentGroupId = ${parentGroupId} ORDER BY name
  `;
}

/**
 * Get root market groups
 */
export async function getRootMarketGroups(): Promise<MarketGroup[]> {
  return await database.sql<MarketGroup[]>`
    SELECT * FROM marketGroups WHERE parentGroupId IS NULL ORDER BY name
  `;
}

/**
 * Get market groups that have types
 */
export async function getMarketGroupsWithTypes(): Promise<MarketGroup[]> {
  return await database.sql<MarketGroup[]>`
    SELECT * FROM marketGroups WHERE hasTypes = 1 ORDER BY name
  `;
}

/**
 * Search market groups by name
 */
export async function searchMarketGroups(
  namePattern: string,
  limit: number = 10
): Promise<MarketGroup[]> {
  return await database.sql<MarketGroup[]>`
    SELECT * FROM marketGroups
    WHERE name ILIKE ${`%${namePattern}%`}
    ORDER BY name
    LIMIT ${limit}
  `;
}

/**
 * Get market group name by ID
 */
export async function getMarketGroupName(
  marketGroupId: number
): Promise<string | null> {
  const [result] = await database.sql<{ name: string }[]>`
    SELECT name FROM marketGroups WHERE marketGroupId = ${marketGroupId}
  `;
  return result?.name || null;
}

/**
 * Count total market groups
 */
export async function countMarketGroups(): Promise<number> {
  const [result] = await database.sql<{ count: number }[]>`
    SELECT count(*) as count FROM marketGroups
  `;
  return Number(result?.count || 0);
}

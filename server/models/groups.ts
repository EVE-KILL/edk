import { database } from '../helpers/database';

/**
 * Groups Model
 *
 * Provides query methods for groups SDE table
 */

export interface Group {
  groupId: number;
  name: string;
  categoryId: number;
  iconId?: number;
  published: number;
}

/**
 * Get a single group by ID
 */
export async function getGroup(groupId: number): Promise<Group | null> {
  const [row] = await database.sql<Group[]>`
    SELECT * FROM groups WHERE "groupId" = ${groupId}
  `;
  return row || null;
}

/**
 * Get all groups in a category
 */
export async function getGroupsByCategory(
  categoryId: number
): Promise<Group[]> {
  return await database.sql<Group[]>`
    SELECT * FROM groups WHERE "categoryId" = ${categoryId} ORDER BY name
  `;
}

/**
 * Get published groups only
 */
export async function getPublishedGroups(): Promise<Group[]> {
  return await database.sql<Group[]>`
    SELECT * FROM groups WHERE published = 1 ORDER BY "categoryId", name
  `;
}

/**
 * Search groups by name
 */
export async function searchGroups(
  namePattern: string,
  limit: number = 10
): Promise<Group[]> {
  return await database.sql<Group[]>`
    SELECT * FROM groups
    WHERE name ILIKE ${`%${namePattern}%`}
    ORDER BY name
    LIMIT ${limit}
  `;
}

/**
 * Get group name by ID
 */
export async function getGroupName(groupId: number): Promise<string | null> {
  const [result] = await database.sql<{ name: string }[]>`
    SELECT name FROM groups WHERE "groupId" = ${groupId}
  `;
  return result?.name || null;
}

/**
 * Count total groups
 */
export async function countGroups(): Promise<number> {
  const [result] = await database.sql<{ count: number }[]>`
    SELECT count(*) as count FROM groups
  `;
  return Number(result?.count || 0);
}

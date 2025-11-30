import { database } from '../helpers/database';

/**
 * Icon interface
 */
export interface Icon {
  iconId: number;
  iconFile?: string;
  description?: string;
}

/**
 * Get icon by ID
 */
export async function getIcon(iconId: number): Promise<Icon | null> {
  return database.findOne<Icon>(
    `SELECT * FROM icons WHERE "iconId" = :iconId`,
    { iconId }
  );
}

/**
 * Get all icons
 */
export async function getAllIcons(): Promise<Icon[]> {
  return database.find<Icon>(`SELECT * FROM icons ORDER BY "iconId"`);
}

/**
 * Count total icons
 */
export async function countIcons(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM icons`
  );
  return result?.count ?? 0;
}

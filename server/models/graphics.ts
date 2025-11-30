import { database } from '../helpers/database';

/**
 * Graphic interface
 */
export interface Graphic {
  graphicId: number;
  graphicFile?: string;
  description?: string;
}

/**
 * Get graphic by ID
 */
export async function getGraphic(graphicId: number): Promise<Graphic | null> {
  return database.findOne<Graphic>(
    `SELECT * FROM graphics WHERE "graphicId" = :graphicId`,
    { graphicId }
  );
}

/**
 * Get all graphics
 */
export async function getAllGraphics(): Promise<Graphic[]> {
  return database.find<Graphic>(`SELECT * FROM graphics ORDER BY "graphicId"`);
}

/**
 * Count total graphics
 */
export async function countGraphics(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM graphics`
  );
  return result?.count ?? 0;
}

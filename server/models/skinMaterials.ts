import { database } from '../helpers/database';

/**
 * SkinMaterial interface
 */
export interface SkinMaterial {
  skinMaterialId: number;
  displayName?: string;
  materialSetId?: number;
}

/**
 * Get skin material by ID
 */
export async function getSkinMaterial(
  skinMaterialId: number
): Promise<SkinMaterial | null> {
  return database.findOne<SkinMaterial>(
    `SELECT * FROM skinmaterials WHERE "skinMaterialId" = :skinMaterialId`,
    { skinMaterialId }
  );
}

/**
 * Get skin materials by material set ID
 */
export async function getSkinMaterialsBySetId(
  materialSetId: number
): Promise<SkinMaterial[]> {
  return database.find<SkinMaterial>(
    `SELECT * FROM skinmaterials WHERE "materialSetId" = :materialSetId ORDER BY "skinMaterialId"`,
    { materialSetId }
  );
}

/**
 * Get all skin materials
 */
export async function getAllSkinMaterials(): Promise<SkinMaterial[]> {
  return database.find<SkinMaterial>(
    `SELECT * FROM skinmaterials ORDER BY "skinMaterialId"`
  );
}

/**
 * Count total skin materials
 */
export async function countSkinMaterials(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM skinmaterials`
  );
  return result?.count ?? 0;
}

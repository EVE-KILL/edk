import { database } from '../helpers/database';

/**
 * SkinLicense interface
 */
export interface SkinLicense {
  licenseId: number;
  duration?: number;
  skinId?: number;
}

/**
 * Get skin license by ID
 */
export async function getSkinLicense(
  licenseId: number
): Promise<SkinLicense | null> {
  return database.findOne<SkinLicense>(
    `SELECT * FROM skinlicenses WHERE "licenseId" = :licenseId`,
    { licenseId }
  );
}

/**
 * Get skin licenses by skin ID
 */
export async function getSkinLicensesBySkinId(
  skinId: number
): Promise<SkinLicense[]> {
  return database.find<SkinLicense>(
    `SELECT * FROM skinlicenses WHERE "skinId" = :skinId ORDER BY "licenseId"`,
    { skinId }
  );
}

/**
 * Get all skin licenses
 */
export async function getAllSkinLicenses(): Promise<SkinLicense[]> {
  return database.find<SkinLicense>(
    `SELECT * FROM skinlicenses ORDER BY "licenseId"`
  );
}

/**
 * Count total skin licenses
 */
export async function countSkinLicenses(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM skinlicenses`
  );
  return result?.count ?? 0;
}

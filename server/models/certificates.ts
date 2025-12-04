import { database } from '../helpers/database';

/**
 * Certificate interface - EVE skill certification
 */
export interface Certificate {
  certificateId: number;
  name: string;
  description: string;
  groupId?: number;
  recommendedFor?: number[];
  skillTypes?: any[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Get certificate by ID
 */
export async function getCertificate(
  certificateId: number
): Promise<Certificate | null> {
  return database.findOne<Certificate>(
    `SELECT * FROM certificates WHERE "certificateId" = :certificateId`,
    { certificateId }
  );
}

/**
 * Get all certificates
 */
export async function getAllCertificates(): Promise<Certificate[]> {
  return database.find<Certificate>(
    `SELECT * FROM certificates ORDER BY "certificateId"`
  );
}

/**
 * Get certificates by group
 */
export async function getCertificatesByGroup(
  groupId: number
): Promise<Certificate[]> {
  return database.find<Certificate>(
    `SELECT * FROM certificates WHERE "groupId" = :groupId ORDER BY "certificateId"`,
    { groupId }
  );
}

/**
 * Search certificates by name
 */
export async function searchCertificates(
  searchTerm: string
): Promise<Certificate[]> {
  return database.find<Certificate>(
    `SELECT * FROM certificates
     WHERE name ILIKE :searchTerm
     ORDER BY "certificateId"
     LIMIT 50`,
    { searchTerm: `%${searchTerm}%` }
  );
}

/**
 * Count total certificates
 */
export async function countCertificates(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM certificates`
  );
  return result?.count ?? 0;
}

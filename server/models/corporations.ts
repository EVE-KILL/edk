import { database } from '../helpers/database';

/**
 * Corporation Model
 *
 * Queries the corporations table (player corporations from ESI)
 */

export interface Corporation {
  corporationId: number;
  allianceId: number | null;
  ceoId: number;
  creatorId: number;
  dateFounded: string | null;
  description: string;
  homeStationId: number | null;
  memberCount: number;
  name: string;
  shares: number;
  taxRate: number;
  ticker: string;
  url: string;
}

/**
 * Get corporation by ID
 */
export async function getCorporation(
  corporationId: number
): Promise<Corporation | null> {
  return database.findOne<Corporation>(
    'SELECT * FROM corporations WHERE "corporationId" = :corporationId',
    { corporationId }
  );
}

/**
 * Get multiple corporations by IDs
 */
export async function getCorporations(
  corporationIds: number[]
): Promise<Corporation[]> {
  if (corporationIds.length === 0) return [];

  return database.find<Corporation>(
    'SELECT * FROM corporations WHERE "corporationId" = ANY(:corporationIds)',
    { corporationIds }
  );
}

/**
 * Search corporations by name
 */
export async function searchCorporations(
  searchTerm: string,
  limit: number = 20
): Promise<Corporation[]> {
  return database.find<Corporation>(
    `SELECT * FROM corporations
     WHERE "name" ILIKE :pattern
     ORDER BY "name"
     LIMIT :limit`,
    { pattern: `%${searchTerm}%`, limit }
  );
}

/**
 * Get corporation name by ID
 */
export async function getCorporationName(
  corporationId: number
): Promise<string | null> {
  const result = await database.findOne<{ name: string }>(
    'SELECT "name" FROM corporations WHERE "corporationId" = :corporationId',
    { corporationId }
  );
  return result?.name || null;
}

/**
 * Get corporation ticker by ID
 */
export async function getCorporationTicker(
  corporationId: number
): Promise<string | null> {
  const result = await database.findOne<{ ticker: string }>(
    'SELECT ticker FROM corporations WHERE "corporationId" = :corporationId',
    { corporationId }
  );
  return result?.ticker || null;
}

/**
 * Get corporations by alliance
 */
export async function getCorporationsByAlliance(
  allianceId: number
): Promise<Corporation[]> {
  return database.find<Corporation>(
    'SELECT * FROM corporations WHERE "allianceId" = :allianceId',
    { allianceId }
  );
}

/**
 * Get corporations by CEO
 */
export async function getCorporationsByCEO(
  characterId: number
): Promise<Corporation[]> {
  return database.find<Corporation>(
    'SELECT * FROM corporations WHERE "ceoId" = :characterId',
    { characterId }
  );
}

/**
 * Get corporations by creator
 */
export async function getCorporationsByCreator(
  characterId: number
): Promise<Corporation[]> {
  return database.find<Corporation>(
    'SELECT * FROM corporations WHERE "creatorId" = :characterId',
    { characterId }
  );
}

/**
 * Count total corporations
 */
export async function countCorporations(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    'SELECT count(*) as count FROM corporations'
  );
  return Number(result?.count || 0);
}

/**
 * Count corporations in an alliance
 */
export async function countCorporationsInAlliance(
  allianceId: number
): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    'SELECT count(*) as count FROM corporations WHERE "allianceId" = :allianceId',
    { allianceId }
  );
  return Number(result?.count || 0);
}

/**
 * Store or update corporation data
 */
export async function storeCorporation(
  corporationId: number,
  data: {
    allianceId: number | null;
    ceoId: number;
    creatorId: number;
    dateFounded: string | null;
    description: string;
    homeStationId: number | null;
    memberCount: number;
    name: string;
    shares: number;
    taxRate: number;
    ticker: string;
    url: string;
  }
): Promise<void> {
  await database.bulkUpsert(
    'corporations',
    [
      {
        corporationId: corporationId,
        allianceId: data.allianceId,
        ceoId: data.ceoId,
        creatorId: data.creatorId,
        dateFounded: data.dateFounded,
        description: data.description,
        homeStationId: data.homeStationId,
        memberCount: data.memberCount,
        name: data.name,
        shares: data.shares,
        taxRate: data.taxRate,
        ticker: data.ticker,
        url: data.url,
      },
    ],
    ['corporationId']
  );
}

/**
 * Bulk store corporation data (for backfill/import)
 */
export async function storeCorporationsBulk(
  corporations: Array<{
    corporationId: number;
    allianceId: number | null;
    ceoId: number;
    creatorId: number;
    dateFounded: string | null;
    description: string;
    homeStationId: number | null;
    memberCount: number;
    name: string;
    shares: number;
    taxRate: number;
    ticker: string;
    url: string;
  }>
): Promise<void> {
  if (corporations.length === 0) return;

  const records = corporations.map((corp) => ({
    corporationId: corp.corporationId,
    allianceId: corp.allianceId,
    ceoId: corp.ceoId,
    creatorId: corp.creatorId,
    dateFounded: corp.dateFounded,
    description: corp.description,
    homeStationId: corp.homeStationId,
    memberCount: corp.memberCount,
    name: corp.name,
    shares: corp.shares,
    taxRate: corp.taxRate,
    ticker: corp.ticker,
    url: corp.url,
  }));

  await database.bulkUpsert('corporations', records, ['corporationId']);
}

/**
 * Check if corporation exists
 */
export async function corporationExists(
  corporationId: number
): Promise<boolean> {
  const result = await database.findOne<{ count: number }>(
    'SELECT count(*) as count FROM corporations WHERE "corporationId" = :corporationId',
    { corporationId }
  );
  return Number(result?.count) > 0;
}

/**
 * Get corporation with alliance information
 */
export async function getCorporationWithAlliance(
  corporationId: number
): Promise<{
  name: string;
  ticker: string;
  allianceId: number | null;
  allianceName: string | null;
  allianceTicker: string | null;
} | null> {
  return database.findOne<{
    name: string;
    ticker: string;
    allianceId: number | null;
    allianceName: string | null;
    allianceTicker: string | null;
  }>(
    `SELECT
      c.name as name,
      c.ticker as ticker,
      c."allianceId" as "allianceId",
      alliance.name as "allianceName",
      alliance.ticker as "allianceTicker"
    FROM corporations c
    LEFT JOIN alliances alliance ON c."allianceId" = alliance."allianceId"
    WHERE c."corporationId" = :corporationId
    LIMIT 1`,
    { corporationId }
  );
}

/**
 * Get approximate corporation count (very fast, uses PostgreSQL statistics)
 */
export async function getApproximateCorporationCount(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COALESCE(reltuples::bigint, 0) as count 
     FROM pg_class 
     WHERE relname = 'corporations'`
  );
  return Number(result?.count || 0);
}

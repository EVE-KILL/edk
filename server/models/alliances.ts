import { database } from '../helpers/database';

/**
 * Alliance Model
 *
 * Queries the alliances table (player alliances from ESI)
 * Uses ReplacingMergeTree with version field for updates
 */

export interface Alliance {
  allianceId: number;
  creatorCorporationId: number;
  creatorId: number;
  dateFounded: string | null;
  executorCorporationId: number;
  factionId: number | null;
  name: string;
  ticker: string;
}

/**
 * Get alliance by ID
 */
export async function getAlliance(
  allianceId: number
): Promise<Alliance | null> {
  return database.findOne<Alliance>(
    'SELECT * FROM alliances WHERE "allianceId" = :allianceId',
    { allianceId }
  );
}

/**
 * Get multiple alliances by IDs
 */
export async function getAlliances(allianceIds: number[]): Promise<Alliance[]> {
  if (allianceIds.length === 0) return [];

  return database.find<Alliance>(
    'SELECT * FROM alliances WHERE "allianceId" = ANY(:allianceIds)',
    { allianceIds }
  );
}

/**
 * Search alliances by name
 */
export async function searchAlliances(
  searchTerm: string,
  limit: number = 20
): Promise<Alliance[]> {
  return database.find<Alliance>(
    `SELECT * FROM alliances
     WHERE "name" ILIKE :pattern
     ORDER BY "name"
     LIMIT :limit`,
    { pattern: `%${searchTerm}%`, limit }
  );
}

/**
 * Get alliance name by ID
 */
export async function getAllianceName(
  allianceId: number
): Promise<string | null> {
  const row = await database.findOne<{ name: string }>(
    'SELECT "name" FROM alliances WHERE "allianceId" = :allianceId',
    { allianceId }
  );
  return row?.name || null;
}

/**
 * Get alliance ticker by ID
 */
export async function getAllianceTicker(
  allianceId: number
): Promise<string | null> {
  const row = await database.findOne<{ ticker: string }>(
    'SELECT ticker FROM alliances WHERE "allianceId" = :allianceId',
    { allianceId }
  );
  return row?.ticker || null;
}

/**
 * Get alliances by executor corporation
 */
export async function getAlliancesByExecutorCorporation(
  corporationId: number
): Promise<Alliance[]> {
  return database.find<Alliance>(
    'SELECT * FROM alliances WHERE "executorCorporationId" = :corporationId',
    { corporationId }
  );
}

/**
 * Get alliances by creator
 */
export async function getAlliancesByCreator(
  characterId: number
): Promise<Alliance[]> {
  return database.find<Alliance>(
    'SELECT * FROM alliances WHERE "creatorId" = :characterId',
    { characterId }
  );
}

/**
 * Count total alliances
 */
export async function countAlliances(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    'SELECT count(*) as count FROM alliances'
  );
  return Number(result?.count || 0);
}

/**
 * Store or update alliance data
 */
export async function storeAlliance(
  allianceId: number,
  data: {
    creatorCorporationId: number;
    creatorId: number;
    dateFounded: string | null;
    executorCorporationId: number;
    factionId: number | null;
    name: string;
    ticker: string;
  }
): Promise<void> {
  await database.bulkUpsert(
    'alliances',
    [
      {
        allianceId: allianceId,
        creatorCorporationId: data.creatorCorporationId,
        creatorId: data.creatorId,
        dateFounded: data.dateFounded,
        executorCorporationId: data.executorCorporationId,
        factionId: data.factionId,
        name: data.name,
        ticker: data.ticker,
      },
    ],
    ['allianceId']
  );
}

/**
 * Bulk store alliance data (for backfill/import)
 */
export async function storeAlliancesBulk(
  alliances: Array<{
    allianceId: number;
    creatorCorporationId: number;
    creatorId: number;
    dateFounded: string | null;
    executorCorporationId: number;
    name: string;
    ticker: string;
  }>
): Promise<void> {
  if (alliances.length === 0) return;

  const records = alliances.map((alliance) => ({
    allianceId: alliance.allianceId,
    creatorCorporationId: alliance.creatorCorporationId,
    creatorId: alliance.creatorId,
    dateFounded: alliance.dateFounded,
    executorCorporationId: alliance.executorCorporationId,
    name: alliance.name,
    ticker: alliance.ticker,
  }));

  await database.bulkUpsert('alliances', records, ['allianceId']);
}

/**
 * Check if alliance exists
 */
export async function allianceExists(allianceId: number): Promise<boolean> {
  const result = await database.findOne<{ count: number }>(
    'SELECT count(*) as count FROM alliances WHERE "allianceId" = :allianceId',
    { allianceId }
  );
  return Number(result?.count) > 0;
}

/**
 * Get approximate alliance count (very fast, uses PostgreSQL statistics)
 */
export async function getApproximateAllianceCount(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COALESCE(reltuples::bigint, 0) as count
     FROM pg_class
     WHERE relname = 'alliances'`
  );
  return Number(result?.count || 0);
}

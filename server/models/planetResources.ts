import { database } from '../helpers/database';

export interface PlanetResource {
  planetId: number;
  power?: number;
}

export async function getPlanetResource(
  planetId: number
): Promise<PlanetResource | null> {
  return database.findOne<PlanetResource>(
    `SELECT * FROM planetresources WHERE "planetId" = :planetId`,
    { planetId }
  );
}

export async function getAllPlanetResources(): Promise<PlanetResource[]> {
  return database.find<PlanetResource>(
    `SELECT * FROM planetresources ORDER BY "planetId"`
  );
}

export async function countPlanetResources(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM planetresources`
  );
  return result?.count ?? 0;
}

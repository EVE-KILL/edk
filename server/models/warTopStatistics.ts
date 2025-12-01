/**
 * War Top Statistics Model
 * Fetches pre-aggregated top 10 statistics for wars from materialized view
 */

interface WarTopStatEntry {
  entityId: number;
  entityName: string;
  kills: number;
  iskValue: number;
}

/**
 * Get top 10 characters for a war
 */
export async function getWarTopCharacters(
  warId: number
): Promise<WarTopStatEntry[]> {
  const results = await database.sql<WarTopStatEntry[]>`
    SELECT
      "entityId",
      "entityName",
      kills,
      "iskValue"
    FROM war_top_statistics
    WHERE "warId" = ${warId}
      AND category = 'character'
    ORDER BY kills DESC, "iskValue" DESC
    LIMIT 10
  `;

  return results;
}

/**
 * Get top 10 corporations for a war
 */
export async function getWarTopCorporations(
  warId: number
): Promise<WarTopStatEntry[]> {
  const results = await database.sql<WarTopStatEntry[]>`
    SELECT
      "entityId",
      "entityName",
      kills,
      "iskValue"
    FROM war_top_statistics
    WHERE "warId" = ${warId}
      AND category = 'corporation'
    ORDER BY kills DESC, "iskValue" DESC
    LIMIT 10
  `;

  return results;
}

/**
 * Get top 10 alliances for a war
 */
export async function getWarTopAlliances(
  warId: number
): Promise<WarTopStatEntry[]> {
  const results = await database.sql<WarTopStatEntry[]>`
    SELECT
      "entityId",
      "entityName",
      kills,
      "iskValue"
    FROM war_top_statistics
    WHERE "warId" = ${warId}
      AND category = 'alliance'
    ORDER BY kills DESC, "iskValue" DESC
    LIMIT 10
  `;

  return results;
}

/**
 * Get top 10 ships for a war
 */
export async function getWarTopShips(
  warId: number
): Promise<WarTopStatEntry[]> {
  const results = await database.sql<WarTopStatEntry[]>`
    SELECT
      "entityId",
      "entityName",
      kills,
      "iskValue"
    FROM war_top_statistics
    WHERE "warId" = ${warId}
      AND category = 'ship'
    ORDER BY kills DESC, "iskValue" DESC
    LIMIT 10
  `;

  return results;
}

/**
 * Get top 10 systems for a war
 */
export async function getWarTopSystems(
  warId: number
): Promise<WarTopStatEntry[]> {
  const results = await database.sql<WarTopStatEntry[]>`
    SELECT
      "entityId",
      "entityName",
      kills,
      "iskValue"
    FROM war_top_statistics
    WHERE "warId" = ${warId}
      AND category = 'system'
    ORDER BY kills DESC, "iskValue" DESC
    LIMIT 10
  `;

  return results;
}

/**
 * Get top 10 regions for a war
 */
export async function getWarTopRegions(
  warId: number
): Promise<WarTopStatEntry[]> {
  const results = await database.sql<WarTopStatEntry[]>`
    SELECT
      "entityId",
      "entityName",
      kills,
      "iskValue"
    FROM war_top_statistics
    WHERE "warId" = ${warId}
      AND category = 'region'
    ORDER BY kills DESC, "iskValue" DESC
    LIMIT 10
  `;

  return results;
}

/**
 * Get all top 10 statistics for a war (all categories)
 */
export async function getWarTopStatistics(warId: number): Promise<{
  characters: WarTopStatEntry[];
  corporations: WarTopStatEntry[];
  alliances: WarTopStatEntry[];
  ships: WarTopStatEntry[];
  systems: WarTopStatEntry[];
  regions: WarTopStatEntry[];
}> {
  const [characters, corporations, alliances, ships, systems, regions] =
    await Promise.all([
      getWarTopCharacters(warId),
      getWarTopCorporations(warId),
      getWarTopAlliances(warId),
      getWarTopShips(warId),
      getWarTopSystems(warId),
      getWarTopRegions(warId),
    ]);

  return {
    characters,
    corporations,
    alliances,
    ships,
    systems,
    regions,
  };
}

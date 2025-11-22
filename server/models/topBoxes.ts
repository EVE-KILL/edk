import { database } from '../helpers/database';

/**
 * Top Boxes Model
 *
 * Queries for top boxes (Top Characters, Top Corporations, etc.)
 * Aggregates on the fly from killmails table.
 */

export interface TopBoxWithName {
  id: number;
  name: string;
  kills: number;
  losses: number;
  iskDestroyed: number;
  iskLost: number;
  points: number;
}

/**
 * Get top entities by kills for a period
 */
export async function getTopByKills(
  periodType: 'hour' | 'day' | 'week' | 'month',
  entityType:
    | 'character'
    | 'corporation'
    | 'alliance'
    | 'ship'
    | 'system'
    | 'region',
  limit: number = 10
): Promise<TopBoxWithName[]> {
  const end = new Date();
  const start = new Date();

  switch (periodType) {
    case 'hour':
      start.setHours(start.getHours() - 1);
      break;
    case 'day':
      start.setDate(start.getDate() - 1);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
  }

  let groupCol;
  let nameCol;
  let joinClause;

  if (entityType === 'character') {
    groupCol = database.sql`k."topAttackerCharacterId"`;
    nameCol = database.sql`c.name`;
    joinClause = database.sql`LEFT JOIN characters c ON k."topAttackerCharacterId" = c."characterId"`;
  } else if (entityType === 'corporation') {
    groupCol = database.sql`k."topAttackerCorporationId"`;
    nameCol = database.sql`c.name`;
    joinClause = database.sql`LEFT JOIN corporations c ON k."topAttackerCorporationId" = c."corporationId"`;
  } else if (entityType === 'alliance') {
    groupCol = database.sql`k."topAttackerAllianceId"`;
    nameCol = database.sql`a.name`;
    joinClause = database.sql`LEFT JOIN alliances a ON k."topAttackerAllianceId" = a."allianceId"`;
  } else if (entityType === 'ship') {
    groupCol = database.sql`k."victimShipTypeId"`;
    nameCol = database.sql`t.name`;
    joinClause = database.sql`LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"`;
  } else if (entityType === 'system') {
    groupCol = database.sql`k."solarSystemId"`;
    nameCol = database.sql`ss.name`;
    joinClause = database.sql`LEFT JOIN solarSystems ss ON k."solarSystemId" = ss."solarSystemId"`;
  } else if (entityType === 'region') {
    groupCol = database.sql`ss."regionId"`;
    nameCol = database.sql`r.name`;
    joinClause = database.sql`LEFT JOIN solarSystems ss ON k."solarSystemId" = ss."solarSystemId" LEFT JOIN regions r ON ss."regionId" = r."regionId"`;
  } else {
    return [];
  }

  return await database.sql<TopBoxWithName[]>`
    SELECT
       ${groupCol} as id,
       COALESCE(${nameCol}, 'Unknown') as name,
       count(*) as kills,
       0 as losses,
       SUM(k."totalValue") as "iskDestroyed",
       0 as "iskLost",
       0 as points
     FROM killmails k
     ${joinClause}
     WHERE k."killmailTime" >= ${start}
       AND k."killmailTime" <= ${end}
       AND ${groupCol} > 0
     GROUP BY ${groupCol}, ${nameCol}
     ORDER BY "iskDestroyed" DESC, kills DESC
     LIMIT ${limit}
  `;
}

/**
 * Get top entities by points (for ranking)
 */
export async function getTopByPoints(
  _periodType: 'hour' | 'day' | 'week' | 'month',
  _entityType:
    | 'character'
    | 'corporation'
    | 'alliance'
    | 'ship'
    | 'system'
    | 'region',
  _limit: number = 10
): Promise<TopBoxWithName[]> {
  // Points not implemented without aggregations, return empty
  return [];
}

/**
 * Get stats for a specific entity
 */
export async function getEntityTopBoxStats(
  _entityId: number,
  _entityType:
    | 'character'
    | 'corporation'
    | 'alliance'
    | 'ship'
    | 'system'
    | 'region',
  _periodType: 'hour' | 'day' | 'week' | 'month'
): Promise<TopBoxWithName | null> {
  return null;
}

/**
 * Get top stats for filtered killmails (for kills pages with filters)
 * This queries the killlist table directly and aggregates on the fly
 */
export interface FilteredTopStats {
  systems: Array<{ id: number; name: string; kills: number }>;
  regions: Array<{ id: number; name: string; kills: number }>;
  characters: Array<{ id: number; name: string; kills: number }>;
  corporations: Array<{ id: number; name: string; kills: number }>;
  alliances: Array<{ id: number; name: string; kills: number }>;
}

/**
 * Helper to combine conditions into a WHERE clause
 */
function conditionsToWhere(conditions: any[], extraCondition?: any): any {
  const all = extraCondition ? [...conditions, extraCondition] : conditions;
  return all.length > 0
    ? database.sql`WHERE ${all.reduce((acc, curr, i) => (i === 0 ? curr : database.sql`${acc} AND ${curr}`), database.sql``)}`
    : database.sql``;
}

/**
 * Get top systems for filtered kills
 */
export async function getTopSystemsFiltered(
  whereConditions: any[],
  limit: number = 10
): Promise<Array<{ id: number; name: string; kills: number }>> {
  const clause = conditionsToWhere(
    whereConditions,
    database.sql`k."solarSystemId" > 0`
  );

  return await database.sql<{ id: number; name: string; kills: number }[]>`
    SELECT
       k."solarSystemId" as id,
       COALESCE(ss.name, 'Unknown') as name,
       count(*) as kills
     FROM killmails k
     LEFT JOIN solarSystems ss ON k."solarSystemId" = ss."solarSystemId"
     LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"
     ${clause}
     GROUP BY k."solarSystemId", ss.name
     ORDER BY kills DESC
     LIMIT ${limit}
  `;
}

/**
 * Get top regions for filtered kills
 */
export async function getTopRegionsFiltered(
  whereConditions: any[],
  limit: number = 10
): Promise<Array<{ id: number; name: string; kills: number }>> {
  const clause = conditionsToWhere(
    whereConditions,
    database.sql`ss."regionId" > 0`
  );

  return await database.sql<{ id: number; name: string; kills: number }[]>`
    SELECT
       ss."regionId" as id,
       COALESCE(reg.name, 'Unknown') as name,
       count(*) as kills
     FROM killmails k
     LEFT JOIN solarSystems ss ON k."solarSystemId" = ss."solarSystemId"
     LEFT JOIN regions reg ON ss."regionId" = reg."regionId"
     LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"
     ${clause}
     GROUP BY ss."regionId", reg.name
     ORDER BY kills DESC
     LIMIT ${limit}
  `;
}

/**
 * Get top characters (attackers) for filtered kills
 */
export async function getTopCharactersFiltered(
  whereConditions: any[],
  limit: number = 10
): Promise<Array<{ id: number; name: string; kills: number }>> {
  const clause = conditionsToWhere(
    whereConditions,
    database.sql`k."topAttackerCharacterId" > 0`
  );

  return await database.sql<{ id: number; name: string; kills: number }[]>`
    SELECT
       k."topAttackerCharacterId" as id,
       COALESCE(c.name, 'Unknown') as name,
       count(*) as kills
     FROM killmails k
     LEFT JOIN solarSystems ss ON k."solarSystemId" = ss."solarSystemId"
     LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"
     LEFT JOIN characters c ON k."topAttackerCharacterId" = c."characterId"
     ${clause}
     GROUP BY k."topAttackerCharacterId", c.name
     ORDER BY kills DESC
     LIMIT ${limit}
  `;
}

/**
 * Get top corporations (attackers) for filtered kills
 */
export async function getTopCorporationsFiltered(
  whereConditions: any[],
  limit: number = 10
): Promise<Array<{ id: number; name: string; kills: number }>> {
  const clause = conditionsToWhere(
    whereConditions,
    database.sql`k."topAttackerCorporationId" > 0`
  );

  return await database.sql<{ id: number; name: string; kills: number }[]>`
    SELECT
       k."topAttackerCorporationId" as id,
       COALESCE(c.name, 'Unknown') as name,
       count(*) as kills
     FROM killmails k
     LEFT JOIN solarSystems ss ON k."solarSystemId" = ss."solarSystemId"
     LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"
     LEFT JOIN corporations c ON k."topAttackerCorporationId" = c."corporationId"
     ${clause}
     GROUP BY k."topAttackerCorporationId", c.name
     ORDER BY kills DESC
     LIMIT ${limit}
  `;
}

/**
 * Get top alliances (attackers) for filtered kills
 */
export async function getTopAlliancesFiltered(
  whereConditions: any[],
  limit: number = 10
): Promise<Array<{ id: number; name: string; kills: number }>> {
  const clause = conditionsToWhere(
    whereConditions,
    database.sql`k."topAttackerAllianceId" > 0`
  );

  return await database.sql<{ id: number; name: string; kills: number }[]>`
    SELECT
       k."topAttackerAllianceId" as id,
       COALESCE(a.name, 'Unknown') as name,
       count(*) as kills
     FROM killmails k
     LEFT JOIN solarSystems ss ON k."solarSystemId" = ss."solarSystemId"
     LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"
     LEFT JOIN alliances a ON k."topAttackerAllianceId" = a."allianceId"
     ${clause}
     GROUP BY k."topAttackerAllianceId", a.name
     ORDER BY kills DESC
     LIMIT ${limit}
  `;
}

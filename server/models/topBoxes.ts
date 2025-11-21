import { database } from '../helpers/database'
import { buildKilllistConditions, KilllistFilters } from './killlist'

/**
 * Top Boxes Model
 *
 * Queries for top boxes (Top Characters, Top Corporations, etc.)
 * Reads from pre-aggregated materialized views for performance.
 */

export interface TopBoxWithName {
  id: number
  name: string
  kills: number
  losses?: number
  iskDestroyed: number
  iskLost?: number
  points?: number
}

/**
 * Get top entities by kills for a period
 */
export async function getTopByKills(
  periodType: 'week', // Currently only 'week' is supported by mat views
  entityType: 'character' | 'corporation' | 'alliance' | 'system' | 'region',
  limit: number = 10
): Promise<TopBoxWithName[]> {
  let viewName: string;

  switch (entityType) {
    case 'character':
      viewName = 'top_characters_weekly';
      break;
    case 'corporation':
      viewName = 'top_corporations_weekly';
      break;
    case 'alliance':
      viewName = 'top_alliances_weekly';
      break;
    case 'system':
      viewName = 'top_systems_weekly';
      break;
    case 'region':
      viewName = 'top_regions_weekly';
      break;
    default:
      return [];
  }

  // The materialized views are already ordered and limited, but we can re-order if needed.
  // The columns are id, name, kills, iskDestroyed.
  return await database.sql<TopBoxWithName[]>`
    SELECT id, name, kills, "iskDestroyed"
    FROM ${database.sql.unsafe(viewName)}
    ORDER BY "iskDestroyed" DESC, kills DESC
    LIMIT ${limit}
  `
}

/**
 * Get top stats for filtered killmails (for kills pages with filters)
 * This queries the kill_list materialized view and aggregates on the fly.
 */
export interface FilteredTopStats {
  systems: Array<{ id: number; name: string; kills: number }>
  regions: Array<{ id: number; name: string; kills: number }>
  characters: Array<{ id: number; name: string; kills: number }>
  corporations: Array<{ id: number; name: string; kills: number }>
  alliances: Array<{ id: number; name: string; kills: number }>
}

/**
 * Helper to combine conditions into a WHERE clause
 */
function conditionsToWhere(conditions: any[], extraCondition?: any): any {
    const allConditions = extraCondition ? [...conditions, extraCondition] : conditions;
    return allConditions.length > 0
        ? database.sql`WHERE ${database.sql(allConditions, ' AND ')}`
        : database.sql``;
}

/**
 * Get top systems for filtered kills
 */
export async function getTopSystemsFiltered(
  filters: KilllistFilters,
  limit: number = 10
): Promise<Array<{ id: number; name: string; kills: number }>> {
  const conditions = buildKilllistConditions(filters, 'k')
  const where = conditionsToWhere(conditions, database.sql`k."solarSystemId" > 0`)

  return await database.sql<{ id: number; name: string; kills: number }[]>`
    SELECT
       k."solarSystemId" as id,
       k."solarSystemName" as name,
       count(*) as kills
     FROM kill_list k
     ${where}
     GROUP BY k."solarSystemId", k."solarSystemName"
     ORDER BY kills DESC
     LIMIT ${limit}
  `
}

/**
 * Get top regions for filtered kills
 */
export async function getTopRegionsFiltered(
  filters: KilllistFilters,
  limit: number = 10
): Promise<Array<{ id: number; name: string; kills: number }>> {
    const conditions = buildKilllistConditions(filters, 'k')
    const where = conditionsToWhere(conditions, database.sql`k."regionId" > 0`)

  return await database.sql<{ id: number; name: string; kills: number }[]>`
    SELECT
       k."regionId" as id,
       k."regionName" as name,
       count(*) as kills
     FROM kill_list k
     ${where}
     GROUP BY k."regionId", k."regionName"
     ORDER BY kills DESC
     LIMIT ${limit}
  `
}

/**
 * Get top characters (attackers) for filtered kills
 */
export async function getTopCharactersFiltered(
  filters: KilllistFilters,
  limit: number = 10
): Promise<Array<{ id: number; name: string; kills: number }>> {
    const conditions = buildKilllistConditions(filters, 'k')
    const where = conditionsToWhere(conditions, database.sql`k."attackerCharacterId" > 0`)

  return await database.sql<{ id: number; name: string; kills: number }[]>`
    SELECT
       k."attackerCharacterId" as id,
       k."attackerCharacterName" as name,
       count(*) as kills
     FROM kill_list k
     ${where}
     GROUP BY k."attackerCharacterId", k."attackerCharacterName"
     ORDER BY kills DESC
     LIMIT ${limit}
  `
}

/**
 * Get top corporations (attackers) for filtered kills
 */
export async function getTopCorporationsFiltered(
  filters: KilllistFilters,
  limit: number = 10
): Promise<Array<{ id: number; name: string; kills: number }>> {
    const conditions = buildKilllistConditions(filters, 'k')
    const where = conditionsToWhere(conditions, database.sql`k."attackerCorporationId" > 0`)

  return await database.sql<{ id: number; name: string; kills: number }[]>`
    SELECT
       k."attackerCorporationId" as id,
       k."attackerCorporationName" as name,
       count(*) as kills
     FROM kill_list k
     ${where}
     GROUP BY k."attackerCorporationId", k."attackerCorporationName"
     ORDER BY kills DESC
     LIMIT ${limit}
  `
}

/**
 * Get top alliances (attackers) for filtered kills
 */
export async function getTopAlliancesFiltered(
  filters: KilllistFilters,
  limit: number = 10
): Promise<Array<{ id: number; name: string; kills: number }>> {
    const conditions = buildKilllistConditions(filters, 'k')
    const where = conditionsToWhere(conditions, database.sql`k."attackerAllianceId" > 0`)

  return await database.sql<{ id: number; name: string; kills: number }[]>`
    SELECT
       k."attackerAllianceId" as id,
       k."attackerAllianceName" as name,
       count(*) as kills
     FROM kill_list k
     ${where}
     GROUP BY k."attackerAllianceId", k."attackerAllianceName"
     ORDER BY kills DESC
     LIMIT ${limit}
  `
}

import { database, type NamedParams } from '../helpers/database';
import type { KilllistFilters } from './killlist';
import {
  ABYSSAL_REGION_MAX,
  ABYSSAL_REGION_MIN,
  BIG_SHIP_GROUP_IDS,
  POCHVEN_REGION_ID,
  WORMHOLE_REGION_MAX,
  WORMHOLE_REGION_MIN,
} from './killlist';

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
type FilterEntity = {
  type: 'alliance' | 'corporation' | 'system' | 'region';
  id: number;
};

interface PeriodRange {
  start: Date;
  end: Date;
}

interface GroupingParts {
  groupColumn: string;
  nameColumn: string;
  joinClause: string;
}

interface FilterAliasConfig {
  killmailAlias?: string;
  solarSystemAlias?: string;
  typeAlias?: string;
}
const DEFAULT_ALIAS_CONFIG: Required<FilterAliasConfig> = {
  killmailAlias: 'k',
  solarSystemAlias: 'ss',
  typeAlias: 't',
};

function getPeriodRange(periodType: 'hour' | 'day' | 'week' | 'month'): PeriodRange {
  const end = new Date();
  const start = new Date(end);

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
    default:
      throw new Error(`Unsupported period type: ${periodType}`);
  }

  return { start, end };
}

function getGroupingParts(
  entityType:
    | 'character'
    | 'corporation'
    | 'alliance'
    | 'ship'
    | 'system'
    | 'region'
): GroupingParts | null {
  switch (entityType) {
    case 'character':
      return {
        groupColumn: 'k."topAttackerCharacterId"',
        nameColumn: 'c.name',
        joinClause:
          'LEFT JOIN characters c ON k."topAttackerCharacterId" = c."characterId"',
      };
    case 'corporation':
      return {
        groupColumn: 'k."topAttackerCorporationId"',
        nameColumn: 'c.name',
        joinClause:
          'LEFT JOIN corporations c ON k."topAttackerCorporationId" = c."corporationId"',
      };
    case 'alliance':
      return {
        groupColumn: 'k."topAttackerAllianceId"',
        nameColumn: 'a.name',
        joinClause:
          'LEFT JOIN alliances a ON k."topAttackerAllianceId" = a."allianceId"',
      };
    case 'ship':
      return {
        groupColumn: 'k."victimShipTypeId"',
        nameColumn: 't.name',
        joinClause:
          'LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"',
      };
    case 'system':
      return {
        groupColumn: 'k."solarSystemId"',
        nameColumn: 'ss.name',
        joinClause:
          'LEFT JOIN solarSystems ss ON k."solarSystemId" = ss."solarSystemId"',
      };
    case 'region':
      return {
        groupColumn: 'ss."regionId"',
        nameColumn: 'r.name',
        joinClause:
          'LEFT JOIN solarSystems ss ON k."solarSystemId" = ss."solarSystemId" LEFT JOIN regions r ON ss."regionId" = r."regionId"',
      };
    default:
      return null;
  }
}

export async function getTopByKills(
  periodType: 'hour' | 'day' | 'week' | 'month',
  entityType:
    | 'character'
    | 'corporation'
    | 'alliance'
    | 'ship'
    | 'system'
    | 'region',
  limit: number = 10,
  filter?: FilterEntity
): Promise<TopBoxWithName[]> {
  const filterEntity = filter ?? null;

  // Use materialized views for weekly stats when no filter is applied
  if (periodType === 'week' && !filterEntity) {
    const viewMap: Record<string, string> = {
      character: 'top_characters_weekly',
      corporation: 'top_corporations_weekly',
      alliance: 'top_alliances_weekly',
      system: 'top_systems_weekly',
      region: 'top_regions_weekly',
    };

    const viewName = viewMap[entityType];
    if (viewName) {
      const query = `
        SELECT
          id,
          name,
          kills,
          0 AS losses,
          "iskDestroyed",
          0 AS "iskLost",
          0 AS points
        FROM ${viewName}
        ORDER BY kills DESC
        LIMIT :limit
      `;
      return database.find<TopBoxWithName>(query, { limit });
    }
  }

  // Fall back to dynamic query for other periods or when filters are applied
  const periodRange = getPeriodRange(periodType);

  const grouping = getGroupingParts(entityType);
  if (!grouping) {
    return [];
  }

  const params: NamedParams = {
    start: periodRange.start,
    end: periodRange.end,
    limit,
  };

  const conditions: string[] = [
    'k."killmailTime" >= :start',
    'k."killmailTime" <= :end',
    `${grouping.groupColumn} > 0`,
  ];

  if (filterEntity) {
    switch (filterEntity.type) {
      case 'alliance':
        params.filterAllianceId = filterEntity.id;
        conditions.push(
          `(
            k."victimAllianceId" = :filterAllianceId OR
            k."topAttackerAllianceId" = :filterAllianceId
          )`.replace(/\s+/g, ' ')
        );
        break;
      case 'system':
        params.filterSolarSystemId = filterEntity.id;
        conditions.push('k."solarSystemId" = :filterSolarSystemId');
        break;
      case 'region':
        params.filterRegionId = filterEntity.id;
        conditions.push(
          `k."solarSystemId" IN (
            SELECT "solarSystemId" FROM "solarSystems" WHERE "regionId" = :filterRegionId
          )`.replace(/\s+/g, ' ')
        );
        break;
    }
  }

  const whereClause = conditions.length ? conditions.join(' AND ') : '1=1';

  const query = `
    SELECT
      ${grouping.groupColumn} AS id,
      COALESCE(${grouping.nameColumn}, 'Unknown') AS name,
      COUNT(*) AS kills,
      0 AS losses,
      SUM(k."totalValue") AS "iskDestroyed",
      0 AS "iskLost",
      0 AS points
    FROM killmails k
    ${grouping.joinClause}
    WHERE ${whereClause}
    GROUP BY ${grouping.groupColumn}, ${grouping.nameColumn}
    ORDER BY kills DESC
    LIMIT :limit
  `;

  return database.find<TopBoxWithName>(query, params);
}

/**
 * Get top entities by points (for ranking)
 */
export async function getTopByPoints(
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
  // Points not implemented without aggregations, return empty
  return [];
}

/**
 * Get stats for a specific entity
 */
export async function getEntityTopBoxStats(
  entityId: number,
  entityType:
    | 'character'
    | 'corporation'
    | 'alliance'
    | 'ship'
    | 'system'
    | 'region',
  periodType: 'hour' | 'day' | 'week' | 'month'
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

function columnReference(alias: string, column: string): string {
  return `${database.identifier(alias)}.${database.identifier(column)}`;
}

function buildFilteredWhereClause(
  filters: KilllistFilters,
  extraCondition?: string,
  aliasConfig: FilterAliasConfig = DEFAULT_ALIAS_CONFIG
): { whereClause: string; params: NamedParams } {
  const { conditions, params } = buildKilllistFilterConditions(
    filters,
    aliasConfig
  );

  if (extraCondition) {
    conditions.push(extraCondition);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  return { whereClause, params };
}

function buildKilllistFilterConditions(
  filters: KilllistFilters,
  aliasConfig: FilterAliasConfig
): { conditions: string[]; params: NamedParams } {
  const config = { ...DEFAULT_ALIAS_CONFIG, ...aliasConfig };
  const killmailColumn = (column: string) =>
    columnReference(config.killmailAlias, column);
  const solarColumn = (column: string) =>
    columnReference(config.solarSystemAlias, column);
  const typeColumn = (column: string) =>
    columnReference(config.typeAlias, column);

  const conditions: string[] = [];
  const params: NamedParams = {};

  if (filters.spaceType) {
    const spaceCondition = buildSpaceTypeConditionString(
      filters.spaceType,
      config.solarSystemAlias
    );
    if (spaceCondition) {
      conditions.push(spaceCondition);
    }
  }

  if (filters.isSolo !== undefined) {
    params.isSolo = filters.isSolo;
    conditions.push(`${killmailColumn('solo')} = :isSolo`);
  }

  if (filters.isBig !== undefined) {
    if (filters.isBig) {
      params.bigShipGroupIds = BIG_SHIP_GROUP_IDS;
      conditions.push(`${typeColumn('groupId')} = ANY(:bigShipGroupIds)`);
    } else {
      params.notBigShipGroupIds = BIG_SHIP_GROUP_IDS;
      conditions.push(`${typeColumn('groupId')} != ALL(:notBigShipGroupIds)`);
    }
  }

  if (filters.isNpc !== undefined) {
    params.isNpc = filters.isNpc;
    conditions.push(`${killmailColumn('npc')} = :isNpc`);
  }

  if (filters.minValue !== undefined) {
    params.minValue = filters.minValue;
    conditions.push(`${killmailColumn('totalValue')} >= :minValue`);
  }

  if (filters.shipGroupIds && filters.shipGroupIds.length > 0) {
    params.shipGroupIds = filters.shipGroupIds;
    conditions.push(`${typeColumn('groupId')} = ANY(:shipGroupIds)`);
  }

  if (filters.minSecurityStatus !== undefined) {
    params.minSecurityStatus = filters.minSecurityStatus;
    conditions.push(`${solarColumn('securityStatus')} >= :minSecurityStatus`);
  }

  if (filters.maxSecurityStatus !== undefined) {
    params.maxSecurityStatus = filters.maxSecurityStatus;
    conditions.push(`${solarColumn('securityStatus')} <= :maxSecurityStatus`);

    if (filters.maxSecurityStatus <= 0) {
      conditions.push(
        `(${solarColumn('regionId')} < ${WORMHOLE_REGION_MIN} OR ${solarColumn('regionId')} > ${WORMHOLE_REGION_MAX})`
      );
    }
  }

  if (filters.regionId !== undefined) {
    params.regionId = filters.regionId;
    conditions.push(`${solarColumn('regionId')} = :regionId`);
  }

  if (
    filters.regionIdMin !== undefined &&
    filters.regionIdMax !== undefined
  ) {
    params.regionIdMin = filters.regionIdMin;
    params.regionIdMax = filters.regionIdMax;
    conditions.push(
      `${solarColumn('regionId')} BETWEEN :regionIdMin AND :regionIdMax`
    );
  }

  if (filters.solarSystemId !== undefined) {
    params.solarSystemId = filters.solarSystemId;
    conditions.push(`${killmailColumn('solarSystemId')} = :solarSystemId`);
  }

  return { conditions, params };
}

function buildSpaceTypeConditionString(
  spaceType: string,
  solarAlias: string
): string | null {
  const securityColumn = columnReference(solarAlias, 'securityStatus');
  const regionColumn = columnReference(solarAlias, 'regionId');

  switch (spaceType) {
    case 'highsec':
      return `${securityColumn} >= 0.45`;
    case 'lowsec':
      return `${securityColumn} >= 0.0 AND ${securityColumn} < 0.45`;
    case 'nullsec':
      return `${securityColumn} < 0.0 AND (${regionColumn} < ${WORMHOLE_REGION_MIN} OR ${regionColumn} > ${WORMHOLE_REGION_MAX})`;
    case 'w-space':
    case 'wormhole':
      return `${regionColumn} BETWEEN ${WORMHOLE_REGION_MIN} AND ${WORMHOLE_REGION_MAX}`;
    case 'abyssal':
      return `${regionColumn} BETWEEN ${ABYSSAL_REGION_MIN} AND ${ABYSSAL_REGION_MAX}`;
    case 'pochven':
      return `${regionColumn} = ${POCHVEN_REGION_ID}`;
    default:
      return null;
  }
}

/**
 * Get top systems for filtered kills
 */
export async function getTopSystemsFiltered(
  filters: KilllistFilters,
  limit: number = 10
): Promise<Array<{ id: number; name: string; kills: number }>> {
  const systemCondition = `${columnReference('k', 'solarSystemId')} > 0`;
  const { whereClause, params } = buildFilteredWhereClause(
    filters,
    systemCondition
  );

  const query = `
    SELECT
      k."solarSystemId" AS id,
      COALESCE(ss.name, 'Unknown') AS name,
      COUNT(*) AS kills
    FROM killmails k
    LEFT JOIN solarSystems ss ON k."solarSystemId" = ss."solarSystemId"
    LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"
    ${whereClause}
    GROUP BY k."solarSystemId", ss.name
    ORDER BY kills DESC
    LIMIT :limit
  `;

  return database.find(query, { ...params, limit });
}

/**
 * Get top regions for filtered kills
 */
export async function getTopRegionsFiltered(
  filters: KilllistFilters,
  limit: number = 10
): Promise<Array<{ id: number; name: string; kills: number }>> {
  const regionCondition = `${columnReference('ss', 'regionId')} > 0`;
  const { whereClause, params } = buildFilteredWhereClause(
    filters,
    regionCondition
  );

  const query = `
    SELECT
      ss."regionId" AS id,
      COALESCE(reg.name, 'Unknown') AS name,
      COUNT(*) AS kills
    FROM killmails k
    LEFT JOIN solarSystems ss ON k."solarSystemId" = ss."solarSystemId"
    LEFT JOIN regions reg ON ss."regionId" = reg."regionId"
    LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"
    ${whereClause}
    GROUP BY ss."regionId", reg.name
    ORDER BY kills DESC
    LIMIT :limit
  `;

  return database.find(query, { ...params, limit });
}

/**
 * Get top characters (attackers) for filtered kills
 */
export async function getTopCharactersFiltered(
  filters: KilllistFilters,
  limit: number = 10
): Promise<Array<{ id: number; name: string; kills: number }>> {
  const characterCondition = `${columnReference('k', 'topAttackerCharacterId')} > 0`;
  const { whereClause, params } = buildFilteredWhereClause(
    filters,
    characterCondition
  );

  const query = `
    SELECT
      k."topAttackerCharacterId" AS id,
      COALESCE(c.name, 'Unknown') AS name,
      COUNT(*) AS kills
    FROM killmails k
    LEFT JOIN solarSystems ss ON k."solarSystemId" = ss."solarSystemId"
    LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"
    LEFT JOIN characters c ON k."topAttackerCharacterId" = c."characterId"
    ${whereClause}
    GROUP BY k."topAttackerCharacterId", c.name
    ORDER BY kills DESC
    LIMIT :limit
  `;

  return database.find(query, { ...params, limit });
}

/**
 * Get top corporations (attackers) for filtered kills
 */
export async function getTopCorporationsFiltered(
  filters: KilllistFilters,
  limit: number = 10
): Promise<Array<{ id: number; name: string; kills: number }>> {
  const corporationCondition = `${columnReference(
    'k',
    'topAttackerCorporationId'
  )} > 0`;
  const { whereClause, params } = buildFilteredWhereClause(
    filters,
    corporationCondition
  );

  const query = `
    SELECT
      k."topAttackerCorporationId" AS id,
      COALESCE(c.name, 'Unknown') AS name,
      COUNT(*) AS kills
    FROM killmails k
    LEFT JOIN solarSystems ss ON k."solarSystemId" = ss."solarSystemId"
    LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"
    LEFT JOIN corporations c ON k."topAttackerCorporationId" = c."corporationId"
    ${whereClause}
    GROUP BY k."topAttackerCorporationId", c.name
    ORDER BY kills DESC
    LIMIT :limit
  `;

  return database.find(query, { ...params, limit });
}

/**
 * Get top alliances (attackers) for filtered kills
 */
export async function getTopAlliancesFiltered(
  filters: KilllistFilters,
  limit: number = 10
): Promise<Array<{ id: number; name: string; kills: number }>> {
  const allianceCondition = `${columnReference('k', 'topAttackerAllianceId')} > 0`;
  const { whereClause, params } = buildFilteredWhereClause(
    filters,
    allianceCondition
  );

  const query = `
    SELECT
      k."topAttackerAllianceId" AS id,
      COALESCE(a.name, 'Unknown') AS name,
      COUNT(*) AS kills
    FROM killmails k
    LEFT JOIN solarSystems ss ON k."solarSystemId" = ss."solarSystemId"
    LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"
    LEFT JOIN alliances a ON k."topAttackerAllianceId" = a."allianceId"
    ${whereClause}
    GROUP BY k."topAttackerAllianceId", a.name
    ORDER BY kills DESC
    LIMIT :limit
  `;

  return database.find(query, { ...params, limit });
}

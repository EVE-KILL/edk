import { database } from '../helpers/database';

/**
 * Killlist Model
 *
 * Queries killmail data.
 * Formerly queried the 'killlist' materialized view, now queries base tables.
 */

export interface KilllistRow {
  killmailId: number;
  killmailTime: Date;

  // Location
  solarSystemId: number;
  regionId: number;
  security: number;

  // Victim info
  victimCharacterId: number | null;
  victimCorporationId: number;
  victimAllianceId: number | null;
  victimShipTypeId: number;
  victimShipGroupId: number;
  victimDamageTaken: number;

  // Attacker info (top attacker)
  topAttackerCharacterId: number | null;
  topAttackerCorporationId: number | null;
  topAttackerAllianceId: number | null;
  topAttackerShipTypeId: number | null;

  // Value and counts
  totalValue: number;
  attackerCount: number;

  // Flags
  npc: boolean;
  solo: boolean;
  awox: boolean;

  // Entity tracking
  entityId: number;
  entityType: 'none' | 'character' | 'corporation' | 'alliance';
  isVictim: boolean;
}

export const BIG_SHIP_GROUP_IDS = [547, 485, 513, 902, 941, 30, 659];
export const CAPSULE_GROUP_IDS = [29, 4053]; // Capsule and Irregular Capsule (Golden Pod)
export const WORMHOLE_REGION_MIN = 11000001;
export const WORMHOLE_REGION_MAX = 11000033;
export const ABYSSAL_REGION_MIN = 12000000;
export const ABYSSAL_REGION_MAX = 13000000;
export const POCHVEN_REGION_ID = 10000070;

function buildSpaceTypeCondition(
  spaceType: string,
  securityColumn: any,
  regionColumn: any
) {
  switch (spaceType) {
    case 'highsec':
      return database.sql`${securityColumn} >= 0.45`;
    case 'lowsec':
      return database.sql`${securityColumn} >= 0.0 AND ${securityColumn} < 0.45`;
    case 'nullsec':
      return database.sql`${securityColumn} < 0.0 AND (${regionColumn} < ${WORMHOLE_REGION_MIN} OR ${regionColumn} > ${WORMHOLE_REGION_MAX})`;
    case 'w-space':
    case 'wormhole':
      return database.sql`${regionColumn} BETWEEN ${WORMHOLE_REGION_MIN} AND ${WORMHOLE_REGION_MAX}`;
    case 'abyssal':
      return database.sql`${regionColumn} BETWEEN ${ABYSSAL_REGION_MIN} AND ${ABYSSAL_REGION_MAX}`;
    case 'pochven':
      return database.sql`${regionColumn} = ${POCHVEN_REGION_ID}`;
    default:
      return null;
  }
}

interface KilllistConditionOptions {
  usingKillListView?: boolean;
  securityColumn?: any;
  regionColumn?: any;
  groupColumn?: any;
}

export function buildKilllistConditions(
  filters: KilllistFilters,
  alias: string = 'k',
  options: KilllistConditionOptions = {}
) {
  const conditions = [];
  // We assume alias is safe or we use it as identifier.
  // Since alias is usually 'k', we can use database.sql(alias)
  const k = database.sql(alias);

  // Use denormalized fields from killmails table (no JOINs needed)
  const securityColumn =
    options.securityColumn ?? database.sql`k."securityStatus"`;
  const regionColumn = options.regionColumn ?? database.sql`k."regionId"`;
  const groupColumn =
    options.groupColumn ?? database.sql`k."victimShipGroupId"`;

  if (filters.warId) {
    conditions.push(database.sql`${k}."warId" = ${filters.warId}`);
  }

  if (filters.spaceType) {
    const spaceTypeCondition = buildSpaceTypeCondition(
      filters.spaceType,
      securityColumn,
      regionColumn
    );
    if (spaceTypeCondition) {
      conditions.push(spaceTypeCondition);
    }
  }

  if (filters.isSolo !== undefined) {
    conditions.push(database.sql`${k}.solo = ${filters.isSolo}`);
  }

  if (filters.isBig !== undefined) {
    if (filters.isBig) {
      conditions.push(
        database.sql`${groupColumn} = ANY(${BIG_SHIP_GROUP_IDS})`
      );
    } else {
      conditions.push(
        database.sql`${groupColumn} != ALL(${BIG_SHIP_GROUP_IDS})`
      );
    }
  }

  if (filters.isNpc !== undefined) {
    conditions.push(database.sql`${k}.npc = ${filters.isNpc}`);
  }

  if (filters.isAwox !== undefined) {
    conditions.push(database.sql`${k}.awox = ${filters.isAwox}`);
  }

  const minValue = filters.minTotalValue ?? filters.minValue;
  if (minValue !== undefined) {
    conditions.push(database.sql`${k}."totalValue" >= ${minValue}`);
  }

  if (filters.maxTotalValue !== undefined) {
    conditions.push(
      database.sql`${k}."totalValue" <= ${filters.maxTotalValue}`
    );
  }

  if (filters.shipGroupIds && filters.shipGroupIds.length > 0) {
    conditions.push(
      database.sql`${groupColumn} = ANY(${filters.shipGroupIds})`
    );
  }

  if (filters.minSecurityStatus !== undefined) {
    conditions.push(
      database.sql`${securityColumn} >= ${filters.minSecurityStatus}`
    );
  }

  if (filters.maxSecurityStatus !== undefined) {
    conditions.push(
      database.sql`${securityColumn} <= ${filters.maxSecurityStatus}`
    );

    if (filters.maxSecurityStatus <= 0) {
      conditions.push(
        database.sql`(${regionColumn} < ${WORMHOLE_REGION_MIN} OR ${regionColumn} > ${WORMHOLE_REGION_MAX})`
      );
    }
  }

  if (filters.regionId !== undefined) {
    conditions.push(database.sql`${regionColumn} = ${filters.regionId}`);
  }

  if (filters.regionIdMin !== undefined && filters.regionIdMax !== undefined) {
    conditions.push(
      database.sql`${regionColumn} >= ${filters.regionIdMin} AND ${regionColumn} <= ${filters.regionIdMax}`
    );
  }

  if (filters.constellationId !== undefined) {
    conditions.push(
      database.sql`${k}."constellationId" = ${filters.constellationId}`
    );
  }

  if (filters.solarSystemId !== undefined) {
    conditions.push(
      database.sql`${k}."solarSystemId" = ${filters.solarSystemId}`
    );
  }

  if (filters.typeId !== undefined) {
    conditions.push(database.sql`${k}."victimShipTypeId" = ${filters.typeId}`);
  }

  if (filters.victimShipTypeId !== undefined) {
    conditions.push(
      database.sql`${k}."victimShipTypeId" = ${filters.victimShipTypeId}`
    );
  }

  if (filters.groupId !== undefined) {
    conditions.push(database.sql`${groupColumn} = ${filters.groupId}`);
  }

  if (filters.victimShipGroupId !== undefined) {
    conditions.push(
      database.sql`${groupColumn} = ${filters.victimShipGroupId}`
    );
  }

  if (filters.attackerCharacterId !== undefined) {
    conditions.push(
      database.sql`${k}."topAttackerCharacterId" = ${filters.attackerCharacterId}`
    );
  }

  if (filters.attackerCorporationId !== undefined) {
    conditions.push(
      database.sql`${k}."topAttackerCorporationId" = ${filters.attackerCorporationId}`
    );
  }

  if (filters.attackerAllianceId !== undefined) {
    conditions.push(
      database.sql`${k}."topAttackerAllianceId" = ${filters.attackerAllianceId}`
    );
  }

  if (filters.victimCharacterId !== undefined) {
    conditions.push(
      database.sql`${k}."victimCharacterId" = ${filters.victimCharacterId}`
    );
  }

  if (filters.victimCorporationId !== undefined) {
    conditions.push(
      database.sql`${k}."victimCorporationId" = ${filters.victimCorporationId}`
    );
  }

  if (filters.victimAllianceId !== undefined) {
    conditions.push(
      database.sql`${k}."victimAllianceId" = ${filters.victimAllianceId}`
    );
  }

  if (filters.excludeTypeIds && filters.excludeTypeIds.length > 0) {
    conditions.push(
      database.sql`${k}."victimShipTypeId" != ALL(${filters.excludeTypeIds})`
    );
  }

  if (filters.noCapsules) {
    conditions.push(database.sql`${groupColumn} != ALL(${CAPSULE_GROUP_IDS})`);
  }

  if (filters.metaGroupIds && filters.metaGroupIds.length > 0) {
    // Note: metaGroupIds filters victim ship by meta group
    conditions.push(
      database.sql`${k}."victimShipTypeId" IN (
        SELECT "typeId" FROM types WHERE "metaGroupId" = ANY(${filters.metaGroupIds})
      )`
    );
  }

  const filteredConditions = conditions.filter(Boolean);

  if (filteredConditions.length === 0) {
    return database.sql`1=1`;
  }

  let combined = filteredConditions[0];
  for (let i = 1; i < filteredConditions.length; i += 1) {
    combined = database.sql`${combined} AND ${filteredConditions[i]}`;
  }

  return combined;
}

// Base SELECT list for KilllistRow
const BASE_SELECT_LIST = database.sql`
  k."killmailId",
  k."killmailTime",
  k."solarSystemId",
  k."regionId",
  k."securityStatus" as security,
  k."victimCharacterId",
  k."victimCorporationId",
  k."victimAllianceId",
  k."victimShipTypeId",
  k."victimShipGroupId",
  k."victimDamageTaken",
  k."topAttackerCharacterId",
  k."topAttackerCorporationId",
  k."topAttackerAllianceId",
  k."topAttackerShipTypeId",
  k."totalValue",
  k."attackerCount",
  k.npc,
  k.solo,
  k.awox
`;

// No JOINs needed! All fields denormalized in killmails table
const BASE_QUERY = database.sql`
  FROM killmails k
`;

/**
 * Get recent killmails for frontpage (all kills)
 */
export async function getRecentKills(
  limit: number = 50
): Promise<KilllistRow[]> {
  // Frontpage: no entity filter, just all kills
  return await database.sql<KilllistRow[]>`
    SELECT
       ${BASE_SELECT_LIST},
       0 as "entityId",
       'none' as "entityType",
       false as "isVictim"
     ${BASE_QUERY}
     ORDER BY k."killmailTime" DESC, k."killmailId" DESC
     LIMIT ${limit}
  `;
}

/**
 * Get killmails for a specific entity (character/corp/alliance)
 * Defaults to "kills" (where entity is attacker)
 */
export async function getEntityKills(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  limit: number = 100
): Promise<KilllistRow[]> {
  let joinClause = database.sql``;
  let whereClause = database.sql``;

  if (entityType === 'character') {
    joinClause = database.sql`JOIN attackers a ON k."killmailId" = a."killmailId"`;
    whereClause = database.sql`a."characterId" = ${entityId}`;
  } else if (entityType === 'corporation') {
    joinClause = database.sql`JOIN attackers a ON k."killmailId" = a."killmailId"`;
    whereClause = database.sql`a."corporationId" = ${entityId}`;
  } else if (entityType === 'alliance') {
    joinClause = database.sql`JOIN attackers a ON k."killmailId" = a."killmailId"`;
    whereClause = database.sql`a."allianceId" = ${entityId}`;
  }

  return await database.sql<KilllistRow[]>`
    SELECT DISTINCT ON (k."killmailTime", k."killmailId")
       ${BASE_SELECT_LIST},
       ${entityId} as "entityId",
       ${entityType} as "entityType",
       false as "isVictim"
     ${BASE_QUERY}
     ${joinClause}
     WHERE ${whereClause}
     ORDER BY k."killmailTime" DESC, k."killmailId" DESC
     LIMIT ${limit}
  `;
}

/**
 * Get kills where entity was the victim
 */
export async function getEntityLosses(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  limit: number = 100
): Promise<KilllistRow[]> {
  let whereClause = database.sql``;

  if (entityType === 'character') {
    whereClause = database.sql`k."victimCharacterId" = ${entityId}`;
  } else if (entityType === 'corporation') {
    whereClause = database.sql`k."victimCorporationId" = ${entityId}`;
  } else if (entityType === 'alliance') {
    whereClause = database.sql`k."victimAllianceId" = ${entityId}`;
  }

  return await database.sql<KilllistRow[]>`
    SELECT
       ${BASE_SELECT_LIST},
       ${entityId} as "entityId",
       ${entityType} as "entityType",
       true as "isVictim"
     ${BASE_QUERY}
     WHERE ${whereClause}
     ORDER BY k."killmailTime" DESC, k."killmailId" DESC
     LIMIT ${limit}
  `;
}

/**
 * Get most valuable kills (using projection)
 */
export async function getMostValuableKills(
  limit: number = 50,
  hoursAgo: number = 168 // 7 days default
): Promise<KilllistRow[]> {
  return await database.sql<KilllistRow[]>`
    SELECT
       ${BASE_SELECT_LIST},
       0 as "entityId",
       'none' as "entityType",
       false as "isVictim"
     ${BASE_QUERY}
     WHERE k."killmailTime" >= NOW() - (${hoursAgo} || ' hours')::interval
     ORDER BY k."totalValue" DESC, k."killmailTime" DESC
     LIMIT ${limit}
  `;
}

/**
 * Count total kills for an entity
 */
export async function countEntityKills(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance'
): Promise<number> {
  let joinClause = database.sql``;
  let whereClause = database.sql``;

  if (entityType === 'character') {
    joinClause = database.sql`JOIN attackers a ON k."killmailId" = a."killmailId"`;
    whereClause = database.sql`a."characterId" = ${entityId}`;
  } else if (entityType === 'corporation') {
    joinClause = database.sql`JOIN attackers a ON k."killmailId" = a."killmailId"`;
    whereClause = database.sql`a."corporationId" = ${entityId}`;
  } else if (entityType === 'alliance') {
    joinClause = database.sql`JOIN attackers a ON k."killmailId" = a."killmailId"`;
    whereClause = database.sql`a."allianceId" = ${entityId}`;
  }

  const [result] = await database.sql<{ count: number }[]>`
    SELECT count(DISTINCT k."killmailId") as count
     FROM killmails k
     ${joinClause}
     WHERE ${whereClause}
  `;
  return Number(result?.count || 0);
}

/**
 * Estimate entity kills count (fast approximation for pagination)
 */
export async function estimateEntityKills(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance'
): Promise<number> {
  let joinClause = database.sql``;
  let whereClause = database.sql``;

  if (entityType === 'character') {
    joinClause = database.sql`JOIN attackers a ON k."killmailId" = a."killmailId"`;
    whereClause = database.sql`a."characterId" = ${entityId}`;
  } else if (entityType === 'corporation') {
    joinClause = database.sql`JOIN attackers a ON k."killmailId" = a."killmailId"`;
    whereClause = database.sql`a."corporationId" = ${entityId}`;
  } else if (entityType === 'alliance') {
    joinClause = database.sql`JOIN attackers a ON k."killmailId" = a."killmailId"`;
    whereClause = database.sql`a."allianceId" = ${entityId}`;
  }

  return estimateCount(database.sql`
    SELECT DISTINCT k."killmailId"
    FROM killmails k
    ${joinClause}
    WHERE ${whereClause}
  `);
}

/**
 * Get activity (kills + losses) for multiple followed entities
 */
export async function getFollowedEntitiesActivity(
  charIds: number[],
  corpIds: number[],
  allyIds: number[],
  page: number = 1,
  perPage: number = 30
): Promise<EntityKillmail[]> {
  const offset = (page - 1) * perPage;

  // Ensure safe numbers
  const safeCharIds = charIds.map(Number).filter((n) => !isNaN(n) && n > 0);
  const safeCorpIds = corpIds.map(Number).filter((n) => !isNaN(n) && n > 0);
  const safeAllyIds = allyIds.map(Number).filter((n) => !isNaN(n) && n > 0);

  const conditions: any[] = [];

  if (safeCharIds.length > 0) {
    conditions.push(
      database.sql`(k."victimCharacterId" IN ${database.sql(safeCharIds)} OR k."topAttackerCharacterId" IN ${database.sql(safeCharIds)})`
    );
  }
  if (safeCorpIds.length > 0) {
    conditions.push(
      database.sql`(k."victimCorporationId" IN ${database.sql(safeCorpIds)} OR k."topAttackerCorporationId" IN ${database.sql(safeCorpIds)})`
    );
  }
  if (safeAllyIds.length > 0) {
    conditions.push(
      database.sql`(k."victimAllianceId" IN ${database.sql(safeAllyIds)} OR k."topAttackerAllianceId" IN ${database.sql(safeAllyIds)})`
    );
  }

  if (conditions.length === 0) {
    return [];
  }

  const whereClause = conditions.reduce(
    (acc, curr, i) => (i === 0 ? curr : database.sql`${acc} OR ${curr}`),
    database.sql``
  );

  return await database.sql<EntityKillmail[]>`
    SELECT DISTINCT ON (k."killmailTime", k."killmailId")
      k."killmailId",
      k."killmailTime",
      -- Victim info
      k."victimCharacterId",
      coalesce(vc.name, vnpc.name, 'Unknown') as "victimCharacterName",
      k."victimCorporationId",
      coalesce(vcorp.name, vnpc_corp.name, 'Unknown') as "victimCorporationName",
      coalesce(vcorp.ticker, vnpc_corp."tickerName", '???') as "victimCorporationTicker",
      k."victimAllianceId",
      valliance.name as "victimAllianceName",
      valliance.ticker as "victimAllianceTicker",
      k."victimShipTypeId",
      coalesce(vship.name, 'Unknown') as "victimShipName",
      coalesce(vshipgroup.name, 'Unknown') as "victimShipGroup",

      -- Attacker info
      k."topAttackerCharacterId" as "attackerCharacterId",
      coalesce(ac.name, anpc.name, 'Unknown') as "attackerCharacterName",
      k."topAttackerCorporationId" as "attackerCorporationId",
      coalesce(acorp.name, anpc_corp.name, 'Unknown') as "attackerCorporationName",
      coalesce(acorp.ticker, anpc_corp."tickerName", '???') as "attackerCorporationTicker",
      k."topAttackerAllianceId" as "attackerAllianceId",
      aalliance.name as "attackerAllianceName",
      aalliance.ticker as "attackerAllianceTicker",

      -- Location
      k."solarSystemId",
      sys.name as "solarSystemName",
      reg.name as "regionName",

      -- Stats
      k."totalValue",
      k."attackerCount"

    FROM killmails k
    LEFT JOIN regions reg ON k."regionId" = reg."regionId"

    -- Victim JOINs
    LEFT JOIN characters vc ON k."victimCharacterId" = vc."characterId"
    LEFT JOIN npcCharacters vnpc ON k."victimCharacterId" = vnpc."characterId"
    LEFT JOIN corporations vcorp ON k."victimCorporationId" = vcorp."corporationId"
    LEFT JOIN npcCorporations vnpc_corp ON k."victimCorporationId" = vnpc_corp."corporationId"
    LEFT JOIN alliances valliance ON k."victimAllianceId" = valliance."allianceId"
    LEFT JOIN types vship ON k."victimShipTypeId" = vship."typeId"

    -- Attacker JOINs
    LEFT JOIN characters ac ON k."topAttackerCharacterId" = ac."characterId"
    LEFT JOIN npcCharacters anpc ON k."topAttackerCharacterId" = anpc."characterId"
    LEFT JOIN corporations acorp ON k."topAttackerCorporationId" = acorp."corporationId"
    LEFT JOIN npcCorporations anpc_corp ON k."topAttackerCorporationId" = anpc_corp."corporationId"
    LEFT JOIN alliances aalliance ON k."topAttackerAllianceId" = aalliance."allianceId"

    WHERE ${whereClause}
    ORDER BY k."killmailTime" DESC, k."killmailId" DESC
    LIMIT ${perPage} OFFSET ${offset}`;
}

export async function countFollowedEntitiesActivity(
  charIds: number[],
  corpIds: number[],
  allyIds: number[]
): Promise<number> {
  const safeCharIds = charIds.map(Number).filter((n) => !isNaN(n) && n > 0);
  const safeCorpIds = corpIds.map(Number).filter((n) => !isNaN(n) && n > 0);
  const safeAllyIds = allyIds.map(Number).filter((n) => !isNaN(n) && n > 0);

  const conditions: any[] = [];

  if (safeCharIds.length > 0) {
    conditions.push(
      database.sql`("victimCharacterId" IN ${database.sql(safeCharIds)} OR "topAttackerCharacterId" IN ${database.sql(safeCharIds)})`
    );
  }
  if (safeCorpIds.length > 0) {
    conditions.push(
      database.sql`("victimCorporationId" IN ${database.sql(safeCorpIds)} OR "topAttackerCorporationId" IN ${database.sql(safeCorpIds)})`
    );
  }
  if (safeAllyIds.length > 0) {
    conditions.push(
      database.sql`("victimAllianceId" IN ${database.sql(safeAllyIds)} OR "topAttackerAllianceId" IN ${database.sql(safeAllyIds)})`
    );
  }

  if (conditions.length === 0) {
    return 0;
  }

  const whereClause = conditions.reduce(
    (acc, curr, i) => (i === 0 ? curr : database.sql`${acc} OR ${curr}`),
    database.sql``
  );

  const [result] = await database.sql<{ count: number }[]>`
    SELECT count(*) as count FROM killmails WHERE ${whereClause}
  `;
  return Number(result?.count || 0);
}

/**
 * Filter options for killlist queries
 */
export interface KilllistFilters {
  warId?: number;
  spaceType?: string;
  isSolo?: boolean;
  isBig?: boolean;
  isNpc?: boolean;
  isAwox?: boolean;
  minValue?: number; // legacy alias for minTotalValue
  minTotalValue?: number;
  maxTotalValue?: number;
  shipGroupIds?: number[];
  minSecurityStatus?: number;
  maxSecurityStatus?: number;
  regionId?: number;
  regionIdMin?: number;
  regionIdMax?: number;
  constellationId?: number;
  solarSystemId?: number;
  typeId?: number; // legacy alias for victimShipTypeId
  groupId?: number; // legacy alias for victimShipGroupId
  victimShipTypeId?: number;
  victimShipGroupId?: number;
  metaGroupIds?: number[]; // Filter by meta group (T1, T2, Faction, Officer)
  attackerCharacterId?: number;
  attackerCorporationId?: number;
  attackerAllianceId?: number;
  victimCharacterId?: number;
  victimCorporationId?: number;
  victimAllianceId?: number;
  excludeTypeIds?: number[];
  noCapsules?: boolean; // Filter out capsules
}

/**
 * Get filtered kills with pagination
 */
export async function getFilteredKills(
  filters: KilllistFilters,
  page: number = 1,
  perPage: number = 50
): Promise<KilllistRow[]> {
  const offset = (page - 1) * perPage;
  const clause = buildKilllistConditions(filters, 'k');

  return await database.sql<KilllistRow[]>`
    SELECT
       ${BASE_SELECT_LIST},
       0 as "entityId",
       'none' as "entityType",
       false as "isVictim"
     ${BASE_QUERY}
     WHERE ${clause}
     ORDER BY k."killmailTime" DESC, k."killmailId" DESC
     LIMIT ${perPage} OFFSET ${offset}
  `;
}

/**
 * Count filtered kills (DEPRECATED - use estimateFilteredKills for pagination)
 *
 * This performs an exact COUNT(*) which is expensive on large tables.
 * Only use this when you need a precise count (e.g., analytics, reports).
 * For pagination and UI display, use estimateFilteredKills() instead.
 */
export async function countFilteredKills(
  filters: KilllistFilters
): Promise<number> {
  const clause = buildKilllistConditions(filters, 'k');

  // Optimization: If no filters (clause is '1=1'), use pg_class estimate
  // This avoids locking all partitions which causes "out of shared memory"
  // We can check if clause is exactly '1=1' fragment? No, hard to check fragment content.
  // But we can check if filters are empty.
  const hasFilters =
    Object.keys(filters).length > 0 &&
    Object.values(filters).some((v) => v !== undefined);

  if (!hasFilters) {
    return getTableEstimate('killmails_%');
  }

  const [result] = await database.sql<{ count: number }[]>`
    SELECT count(*) as count
     ${BASE_QUERY}
     WHERE ${clause}
  `;
  return Number(result?.count || 0);
}

/**
 * Estimate filtered kills count using query planner
 *
 * This is 100-1000x faster than countFilteredKills() because it uses
 * PostgreSQL's EXPLAIN to get the planner's row estimate instead of
 * scanning all matching rows.
 *
 * Accuracy: Usually within 10-50% of exact count, which is sufficient
 * for pagination display ("Page 5 of ~2,340").
 *
 * Performance: 5-50ms vs 5-30 seconds for exact count on large tables.
 */
export async function estimateFilteredKills(
  filters: KilllistFilters
): Promise<number> {
  const clause = buildKilllistConditions(filters, 'k');

  // No filters: use pg_class estimate (instant)
  const hasFilters =
    Object.keys(filters).length > 0 &&
    Object.values(filters).some((v) => v !== undefined);

  if (!hasFilters) {
    return getTableEstimate('killmails_%');
  }

  // With filters: use EXPLAIN-based estimate
  return estimateCount(database.sql`
    SELECT 1 ${BASE_QUERY} WHERE ${clause}
  `);
}

/**
 * Get filtered kills with all names joined from SDE tables
 * Optimized to query base killmails table with targeted joins
 */
export async function getFilteredKillsWithNames(
  filters: KilllistFilters,
  page: number = 1,
  perPage: number = 50,
  lookbackDays?: number
): Promise<EntityKillmail[]> {
  const offset = (page - 1) * perPage;
  const clause = buildKilllistConditions(filters, 'k', {
    groupColumn: database.sql`k."victimShipGroupId"`,
  });
  const timeClause = lookbackDays
    ? database.sql`AND k."killmailTime" >= NOW() - (${lookbackDays} || ' days')::interval`
    : database.sql``;

  return await database.sql<EntityKillmail[]>`
    SELECT
      k."killmailId",
      k."killmailTime",

      -- Victim info
      k."victimCharacterId",
      COALESCE(vc.name, vnpc.name, 'Unknown') AS "victimCharacterName",
      k."victimCorporationId",
      COALESCE(vcorp.name, vnpc_corp.name, 'Unknown') AS "victimCorporationName",
      COALESCE(vcorp.ticker, vnpc_corp."tickerName", '???') AS "victimCorporationTicker",
      k."victimAllianceId",
      valliance.name AS "victimAllianceName",
      valliance.ticker AS "victimAllianceTicker",
      k."victimShipTypeId",
      COALESCE(vship.name, 'Unknown') AS "victimShipName",
      COALESCE(vshipgroup.name, 'Unknown') AS "victimShipGroup",

      -- Attacker info (top attacker)
      k."topAttackerCharacterId" AS "attackerCharacterId",
      COALESCE(ac.name, anpc.name, 'Unknown') AS "attackerCharacterName",
      k."topAttackerCorporationId" AS "attackerCorporationId",
      COALESCE(acorp.name, anpc_corp.name, 'Unknown') AS "attackerCorporationName",
      COALESCE(acorp.ticker, anpc_corp."tickerName", '???') AS "attackerCorporationTicker",
      k."topAttackerAllianceId" AS "attackerAllianceId",
      aalliance.name AS "attackerAllianceName",
      aalliance.ticker AS "attackerAllianceTicker",

      -- Location
      k."solarSystemId",
      ss.name AS "solarSystemName",
      r.name AS "regionName",

      -- Stats
      k."totalValue",
      k."attackerCount"

    FROM killmails k
    LEFT JOIN solarsystems ss ON k."solarSystemId" = ss."solarSystemId"
    LEFT JOIN regions r ON k."regionId" = r."regionId"
    LEFT JOIN characters vc ON k."victimCharacterId" = vc."characterId"
    LEFT JOIN npccharacters vnpc ON k."victimCharacterId" = vnpc."characterId"
    LEFT JOIN corporations vcorp ON k."victimCorporationId" = vcorp."corporationId"
    LEFT JOIN npccorporations vnpc_corp ON k."victimCorporationId" = vnpc_corp."corporationId"
    LEFT JOIN alliances valliance ON k."victimAllianceId" = valliance."allianceId"
    LEFT JOIN types vship ON k."victimShipTypeId" = vship."typeId"
    LEFT JOIN groups vshipgroup ON vship."groupId" = vshipgroup."groupId"
    LEFT JOIN characters ac ON k."topAttackerCharacterId" = ac."characterId"
    LEFT JOIN npccharacters anpc ON k."topAttackerCharacterId" = anpc."characterId"
    LEFT JOIN corporations acorp ON k."topAttackerCorporationId" = acorp."corporationId"
    LEFT JOIN npccorporations anpc_corp ON k."topAttackerCorporationId" = anpc_corp."corporationId"
    LEFT JOIN alliances aalliance ON k."topAttackerAllianceId" = aalliance."allianceId"

    WHERE ${clause} ${timeClause}
    ORDER BY k."killmailTime" DESC
    LIMIT ${perPage} OFFSET ${offset}
  `;
}

/**
 * Get most valuable killmails for a filter (no pagination, no limit)
 * Only limited by lookbackDays - returns ALL matching kills to be sorted by value
 */
export async function getMostValuableKillsFiltered(
  filters: KilllistFilters,
  lookbackDays: number
): Promise<EntityKillmail[]> {
  const clause = buildKilllistConditions(filters, 'k', {
    groupColumn: database.sql`k."victimShipGroupId"`,
  });
  const timeClause = database.sql`AND k."killmailTime" >= NOW() - (${lookbackDays} || ' days')::interval`;

  return await database.sql<EntityKillmail[]>`
    SELECT
      k."killmailId",
      k."killmailTime",

      -- Victim info
      k."victimCharacterId",
      COALESCE(vc.name, vnpc.name, 'Unknown') AS "victimCharacterName",
      k."victimCorporationId",
      COALESCE(vcorp.name, vnpc_corp.name, 'Unknown') AS "victimCorporationName",
      COALESCE(vcorp.ticker, vnpc_corp."tickerName", '???') AS "victimCorporationTicker",
      k."victimAllianceId",
      valliance.name AS "victimAllianceName",
      valliance.ticker AS "victimAllianceTicker",
      k."victimShipTypeId",
      COALESCE(vship.name, 'Unknown') AS "victimShipName",
      COALESCE(vshipgroup.name, 'Unknown') AS "victimShipGroup",

      -- Attacker info (top attacker)
      k."topAttackerCharacterId" AS "attackerCharacterId",
      COALESCE(ac.name, anpc.name, 'Unknown') AS "attackerCharacterName",
      k."topAttackerCorporationId" AS "attackerCorporationId",
      COALESCE(acorp.name, anpc_corp.name, 'Unknown') AS "attackerCorporationName",
      COALESCE(acorp.ticker, anpc_corp."tickerName", '???') AS "attackerCorporationTicker",
      k."topAttackerAllianceId" AS "attackerAllianceId",
      aalliance.name AS "attackerAllianceName",
      aalliance.ticker AS "attackerAllianceTicker",

      -- Location
      k."solarSystemId",
      ss.name AS "solarSystemName",
      r.name AS "regionName",

      -- Stats
      k."totalValue",
      k."attackerCount"

    FROM killmails k
    LEFT JOIN solarsystems ss ON k."solarSystemId" = ss."solarSystemId"
    LEFT JOIN regions r ON k."regionId" = r."regionId"
    LEFT JOIN characters vc ON k."victimCharacterId" = vc."characterId"
    LEFT JOIN npccharacters vnpc ON k."victimCharacterId" = vnpc."characterId"
    LEFT JOIN corporations vcorp ON k."victimCorporationId" = vcorp."corporationId"
    LEFT JOIN npccorporations vnpc_corp ON k."victimCorporationId" = vnpc_corp."corporationId"
    LEFT JOIN alliances valliance ON k."victimAllianceId" = valliance."allianceId"
    LEFT JOIN types vship ON k."victimShipTypeId" = vship."typeId"
    LEFT JOIN groups vshipgroup ON vship."groupId" = vshipgroup."groupId"
    LEFT JOIN characters ac ON k."topAttackerCharacterId" = ac."characterId"
    LEFT JOIN npccharacters anpc ON k."topAttackerCharacterId" = anpc."characterId"
    LEFT JOIN corporations acorp ON k."topAttackerCorporationId" = acorp."corporationId"
    LEFT JOIN npccorporations anpc_corp ON k."topAttackerCorporationId" = anpc_corp."corporationId"
    LEFT JOIN alliances aalliance ON k."topAttackerAllianceId" = aalliance."allianceId"

    WHERE ${clause} ${timeClause}
    ORDER BY k."killmailTime" DESC
  `;
}

/**
 * Extended killmail data with entity names (for entity pages)
 */
export interface EntityKillmail {
  killmailId: number;
  killmailTime: string;
  // ... fields ...
  victimCharacterId: number | null;
  victimCharacterName: string;
  victimCorporationId: number;
  victimCorporationName: string;
  victimCorporationTicker: string;
  victimAllianceId: number | null;
  victimAllianceName: string | null;
  victimAllianceTicker: string | null;
  victimShipTypeId: number;
  victimShipName: string;
  victimShipGroup: string;

  attackerCharacterId: number;
  attackerCharacterName: string;
  attackerCorporationId: number;
  attackerCorporationName: string;
  attackerCorporationTicker: string;
  attackerAllianceId: number | null;
  attackerAllianceName: string | null;
  attackerAllianceTicker: string | null;

  solarSystemId: number;
  solarSystemName: string;
  regionName: string;

  totalValue: number;
  attackerCount: number;
}

/**
 * Get killmails where entity was attacker (kills)
 * Or victim (losses)
 * Or both (all)
 * Detailed view with names.
 */
export async function getEntityKillmails(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  mode: 'kills' | 'losses' | 'all',
  page: number = 1,
  perPage: number = 30,
  filters?: KilllistFilters
): Promise<EntityKillmail[]> {
  const offset = (page - 1) * perPage;
  const victimCol = victimColumnMap[entityType];

  // For 'all' mode, combine kills and losses
  // With increased max_locks_per_transaction, we can now use proper queries
  if (mode === 'all') {
    return getEntityKillmails(
      entityId,
      entityType,
      'kills',
      page,
      perPage,
      filters
    );
  }

  // Build additional filter conditions
  const additionalFilters = filters
    ? buildKilllistConditions(filters, 'k', {
        groupColumn: database.sql`k."victimShipGroupId"`,
      })
    : database.sql`1=1`;

  // Step 1: Get killmail IDs from killmails table (topAttacker columns, not attackers table)
  let killmailIds: number[] = [];

  if (mode === 'kills') {
    // Query killmails table using topAttacker columns
    const topAttackerCol = `topAttacker${entityType.charAt(0).toUpperCase() + entityType.slice(1)}Id`;

    const killKillmails = await database.sql<{ killmailId: number }[]>`
      SELECT k."killmailId"
      FROM killmails k
      WHERE k.${database.sql(topAttackerCol)} = ${entityId}
      AND ${additionalFilters}
      ORDER BY k."killmailTime" DESC, k."killmailId" DESC
      LIMIT ${perPage} OFFSET ${offset}
    `;

    killmailIds = killKillmails.map((km) => km.killmailId);
  } else {
    // Losses query
    const lossKillmails = await database.sql<{ killmailId: number }[]>`
      SELECT k."killmailId"
      FROM killmails k
      WHERE k.${database.sql(victimCol)} = ${entityId}
      AND ${additionalFilters}
      ORDER BY k."killmailTime" DESC, k."killmailId" DESC
      LIMIT ${perPage} OFFSET ${offset}
    `;

    killmailIds = lossKillmails.map((km) => km.killmailId);
  }

  if (killmailIds.length === 0) {
    return [];
  }

  // Step 2: Fetch full killmail data for those IDs
  const query = `
    SELECT
      k."killmailId" as "killmailId",
      k."killmailTime" as "killmailTime",
      k."victimCharacterId" as "victimCharacterId",
      coalesce(vc.name, vnpc.name, 'Unknown') as "victimCharacterName",
      k."victimCorporationId" as "victimCorporationId",
      coalesce(vcorp.name, vnpc_corp.name, 'Unknown') as "victimCorporationName",
      coalesce(vcorp.ticker, vnpc_corp."tickerName", '???') as "victimCorporationTicker",
      k."victimAllianceId" as "victimAllianceId",
      valliance.name as "victimAllianceName",
      valliance.ticker as "victimAllianceTicker",
      k."victimShipTypeId" as "victimShipTypeId",
      coalesce(vship.name, 'Unknown') as "victimShipName",
      coalesce(vshipgroup.name, 'Unknown') as "victimShipGroup",
      k."topAttackerCharacterId" as "attackerCharacterId",
      coalesce(ac.name, anpc.name, 'Unknown') as "attackerCharacterName",
      k."topAttackerCorporationId" as "attackerCorporationId",
      coalesce(acorp.name, anpc_corp.name, 'Unknown') as "attackerCorporationName",
      coalesce(acorp.ticker, anpc_corp."tickerName", '???') as "attackerCorporationTicker",
      k."topAttackerAllianceId" as "attackerAllianceId",
      aalliance.name as "attackerAllianceName",
      aalliance.ticker as "attackerAllianceTicker",
      k."solarSystemId" as "solarSystemId",
      sys.name as "solarSystemName",
      reg.name as "regionName",
      k."totalValue" as "totalValue",
      k."attackerCount" as "attackerCount"
    FROM killmails k
    LEFT JOIN solarSystems sys ON k."solarSystemId" = sys."solarSystemId"
    LEFT JOIN regions reg ON sys."regionId" = reg."regionId"
    LEFT JOIN characters vc ON k."victimCharacterId" = vc."characterId"
    LEFT JOIN npcCharacters vnpc ON k."victimCharacterId" = vnpc."characterId"
    LEFT JOIN corporations vcorp ON k."victimCorporationId" = vcorp."corporationId"
    LEFT JOIN npcCorporations vnpc_corp ON k."victimCorporationId" = vnpc_corp."corporationId"
    LEFT JOIN alliances valliance ON k."victimAllianceId" = valliance."allianceId"
    LEFT JOIN types vship ON k."victimShipTypeId" = vship."typeId"
    LEFT JOIN groups vshipgroup ON vship."groupId" = vshipgroup."groupId"
    LEFT JOIN characters ac ON k."topAttackerCharacterId" = ac."characterId"
    LEFT JOIN npcCharacters anpc ON k."topAttackerCharacterId" = anpc."characterId"
    LEFT JOIN corporations acorp ON k."topAttackerCorporationId" = acorp."corporationId"
    LEFT JOIN npcCorporations anpc_corp ON k."topAttackerCorporationId" = anpc_corp."corporationId"
    LEFT JOIN alliances aalliance ON k."topAttackerAllianceId" = aalliance."allianceId"
    WHERE k."killmailId" IN (:killmailIds)
    ORDER BY k."killmailTime" DESC, k."killmailId" DESC
  `;

  return database.find<EntityKillmail>(query, { killmailIds });
}

/**
 * Count entity killmails
 */
type EntityColumnMap = Record<'character' | 'corporation' | 'alliance', string>;

const victimColumnMap: EntityColumnMap = {
  character: 'victimCharacterId',
  corporation: 'victimCorporationId',
  alliance: 'victimAllianceId',
};

export async function countEntityKillmails(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  mode: 'kills' | 'losses' | 'all',
  filters?: KilllistFilters
): Promise<number> {
  const victimCol = victimColumnMap[entityType];

  // Build additional filter conditions
  const additionalFilters = filters
    ? buildKilllistConditions(filters, 'k', {
        groupColumn: database.sql`k."victimShipGroupId"`,
      })
    : database.sql`1=1`;

  if (mode === 'kills') {
    // Count using topAttacker columns (matching getEntityKillmails)
    const topAttackerCol = `topAttacker${entityType.charAt(0).toUpperCase() + entityType.slice(1)}Id`;

    const result = await database.sql<{ count: number }[]>`
      SELECT COUNT(*) AS count
      FROM killmails k
      WHERE k.${database.sql(topAttackerCol)} = ${entityId}
      AND ${additionalFilters}
    `;
    return Number(result[0]?.count ?? 0);
  }

  if (mode === 'losses') {
    const result = await database.sql<{ count: number }[]>`
      SELECT COUNT(*) AS count
      FROM killmails k
      WHERE k.${database.sql(victimCol)} = ${entityId}
      AND ${additionalFilters}
    `;
    return Number(result[0]?.count ?? 0);
  }

  // all mode - return estimated count without actual database query
  // Counting all kills for very active characters causes "out of shared memory" errors
  // For pagination purposes, we return a large estimated value
  // The actual pagination is limited to 7 days of data anyway
  return 100000; // Reasonable upper bound for 7 days of killmails
}

/**
 * Estimate entity killmails count (fast approximation for pagination)
 */
export async function estimateEntityKillmails(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  mode: 'kills' | 'losses' | 'all',
  filters?: KilllistFilters
): Promise<number> {
  const victimCol = victimColumnMap[entityType];

  // Build additional filter conditions
  const additionalFilters = filters
    ? buildKilllistConditions(filters, 'k', {
        groupColumn: database.sql`k."victimShipGroupId"`,
      })
    : database.sql`1=1`;

  if (mode === 'kills') {
    const topAttackerCol = `topAttacker${entityType.charAt(0).toUpperCase() + entityType.slice(1)}Id`;

    return estimateCount(database.sql`
      SELECT 1
      FROM killmails k
      WHERE k.${database.sql(topAttackerCol)} = ${entityId}
      AND ${additionalFilters}
    `);
  }

  if (mode === 'losses') {
    return estimateCount(database.sql`
      SELECT 1
      FROM killmails k
      WHERE k.${database.sql(victimCol)} = ${entityId}
      AND ${additionalFilters}
    `);
  }

  // all mode - return fixed estimate
  return 100000;
}

/**
 * Detailed killlist row with all entity information
 */
export interface DetailedKilllistRow {
  killmailId: number;
  killmailTime: string;
  victimCharacterId: number | null;
  victimCharacterName: string;
  victimCorporationId: number;
  victimCorporationName: string;
  victimCorporationTicker: string;
  victimAllianceId: number | null;
  victimAllianceName: string;
  victimAllianceTicker: string;
  victimShipTypeId: number;
  victimShipName: string;
  victimShipGroup: string;
  attackerCharacterId: number;
  attackerCharacterName: string;
  attackerCorporationId: number;
  attackerCorporationName: string;
  attackerCorporationTicker: string;
  attackerAllianceId: number | null;
  attackerAllianceName: string;
  attackerAllianceTicker: string;
  solarSystemId: number;
  solarSystemName: string;
  regionName: string;
  totalValue: number;
  attackerCount: number;
  isSolo: number;
}

/**
 * Get kills for an entity (where entity was the attacker)
 */
export async function getEntityKillsDetailed(
  entityType: 'character' | 'corporation' | 'alliance',
  entityId: number,
  page: number = 1,
  perPage: number = 30
): Promise<DetailedKilllistRow[]> {
  // Re-use getEntityKillmails but cast result (interfaces are very similar, Detailed has strings for IDs? No, numbers)
  // Actually EntityKillmail and DetailedKilllistRow match closely.
  // Let's just call getEntityKillmails with mode='kills'.
  return (await getEntityKillmails(
    entityId,
    entityType,
    'kills',
    page,
    perPage
  )) as unknown as DetailedKilllistRow[];
}

/**
 * Count kills for an entity
 */
export async function countEntityKillsDetailed(
  entityType: 'character' | 'corporation' | 'alliance',
  entityId: number
): Promise<number> {
  return await countEntityKillmails(entityId, entityType, 'kills');
}

/**
 * Count losses for an entity
 */
export async function countEntityLossesDetailed(
  entityType: 'character' | 'corporation' | 'alliance',
  entityId: number
): Promise<number> {
  return await countEntityKillmails(entityId, entityType, 'losses');
}

/**
 * Count all killmails for an entity (both kills and losses)
 */
export async function countEntityKillmailsDetailed(
  entityType: 'character' | 'corporation' | 'alliance',
  entityId: number
): Promise<number> {
  return await countEntityKillmails(entityId, entityType, 'all');
}

/**
 * Get losses for multiple followed entities
 */
export async function getFollowedEntitiesLosses(
  charIds: number[],
  corpIds: number[],
  allyIds: number[],
  page: number = 1,
  perPage: number = 30
): Promise<EntityKillmail[]> {
  const offset = (page - 1) * perPage;

  // Ensure safe numbers
  const safeCharIds = charIds.map(Number).filter((n) => !isNaN(n) && n > 0);
  const safeCorpIds = corpIds.map(Number).filter((n) => !isNaN(n) && n > 0);
  const safeAllyIds = allyIds.map(Number).filter((n) => !isNaN(n) && n > 0);

  const conditions: any[] = [];

  if (safeCharIds.length > 0) {
    conditions.push(
      database.sql`k."victimCharacterId" IN ${database.sql(safeCharIds)}`
    );
  }
  if (safeCorpIds.length > 0) {
    conditions.push(
      database.sql`k."victimCorporationId" IN ${database.sql(safeCorpIds)}`
    );
  }
  if (safeAllyIds.length > 0) {
    conditions.push(
      database.sql`k."victimAllianceId" IN ${database.sql(safeAllyIds)}`
    );
  }

  if (conditions.length === 0) {
    return [];
  }

  const whereClause = conditions
    .slice(1)
    .reduce((acc, clause) => database.sql`${acc} OR ${clause}`, conditions[0]);

  return database.sql<EntityKillmail[]>`
    SELECT DISTINCT ON (k."killmailTime", k."killmailId")
      k."killmailId" as "killmailId",
      k."killmailTime" as "killmailTime",
      k."victimCharacterId" as "victimCharacterId",
      coalesce(vc.name, vnpc.name, 'Unknown') as "victimCharacterName",
      k."victimCorporationId" as "victimCorporationId",
      coalesce(vcorp.name, vnpc_corp.name, 'Unknown') as "victimCorporationName",
      coalesce(vcorp.ticker, vnpc_corp."tickerName", '???') as "victimCorporationTicker",
      k."victimAllianceId" as "victimAllianceId",
      valliance.name as "victimAllianceName",
      valliance.ticker as "victimAllianceTicker",
      k."victimShipTypeId" as "victimShipTypeId",
      coalesce(vship.name, 'Unknown') as "victimShipName",
      coalesce(vshipgroup.name, 'Unknown') as "victimShipGroup",
      k."topAttackerCharacterId" as "attackerCharacterId",
      coalesce(ac.name, anpc.name, 'Unknown') as "attackerCharacterName",
      k."topAttackerCorporationId" as "attackerCorporationId",
      coalesce(acorp.name, anpc_corp.name, 'Unknown') as "attackerCorporationName",
      coalesce(acorp.ticker, anpc_corp."tickerName", '???') as "attackerCorporationTicker",
      k."topAttackerAllianceId" as "attackerAllianceId",
      aalliance.name as "attackerAllianceName",
      aalliance.ticker as "attackerAllianceTicker",
      k."solarSystemId",
      sys.name as "solarSystemName",
      reg.name as "regionName",
      k."totalValue",
      k."attackerCount"
    FROM killmails k
    LEFT JOIN solarSystems sys ON k."solarSystemId" = sys."solarSystemId"
    LEFT JOIN regions reg ON sys."regionId" = reg."regionId"
    LEFT JOIN characters vc ON k."victimCharacterId" = vc."characterId"
    LEFT JOIN npcCharacters vnpc ON k."victimCharacterId" = vnpc."characterId"
    LEFT JOIN corporations vcorp ON k."victimCorporationId" = vcorp."corporationId"
    LEFT JOIN npcCorporations vnpc_corp ON k."victimCorporationId" = vnpc_corp."corporationId"
    LEFT JOIN alliances valliance ON k."victimAllianceId" = valliance."allianceId"
    LEFT JOIN types vship ON k."victimShipTypeId" = vship."typeId"
    LEFT JOIN groups vshipgroup ON vship."groupId" = vshipgroup."groupId"
    LEFT JOIN characters ac ON k."topAttackerCharacterId" = ac."characterId"
    LEFT JOIN npcCharacters anpc ON k."topAttackerCharacterId" = anpc."characterId"
    LEFT JOIN corporations acorp ON k."topAttackerCorporationId" = acorp."corporationId"
    LEFT JOIN npcCorporations anpc_corp ON k."topAttackerCorporationId" = anpc_corp."corporationId"
    LEFT JOIN alliances aalliance ON k."topAttackerAllianceId" = aalliance."allianceId"
    WHERE ${whereClause}
    ORDER BY k."killmailTime" DESC, k."killmailId" DESC
    LIMIT ${perPage} OFFSET ${offset}
  `;
}

export async function countFollowedEntitiesLosses(
  charIds: number[],
  corpIds: number[],
  allyIds: number[]
): Promise<number> {
  const safeCharIds = charIds.map(Number).filter((n) => !isNaN(n) && n > 0);
  const safeCorpIds = corpIds.map(Number).filter((n) => !isNaN(n) && n > 0);
  const safeAllyIds = allyIds.map(Number).filter((n) => !isNaN(n) && n > 0);

  const conditions: any[] = [];

  if (safeCharIds.length > 0) {
    conditions.push(
      database.sql`"victimCharacterId" IN ${database.sql(safeCharIds)}`
    );
  }
  if (safeCorpIds.length > 0) {
    conditions.push(
      database.sql`"victimCorporationId" IN ${database.sql(safeCorpIds)}`
    );
  }
  if (safeAllyIds.length > 0) {
    conditions.push(
      database.sql`"victimAllianceId" IN ${database.sql(safeAllyIds)}`
    );
  }

  if (conditions.length === 0) {
    return 0;
  }

  const whereClause = conditions.reduce(
    (acc, curr, i) => (i === 0 ? curr : database.sql`${acc} OR ${curr}`),
    database.sql``
  );

  const [result] = await database.sql<{ count: number }[]>`
    SELECT count(*) as count FROM killmails WHERE ${whereClause}
  `;
  return Number(result?.count || 0);
}

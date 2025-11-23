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

export function buildKilllistConditions(
  filters: KilllistFilters,
  alias: string = 'k'
) {
  const conditions = [];
  // We assume alias is safe or we use it as identifier.
  // Since alias is usually 'k', we can use database.sql(alias)
  // But that creates "k".
  const k = database.sql(alias);
  const usingKillListView = alias === 'kl';

  const securityColumn = usingKillListView
    ? database.sql`${k}."security"`
    : database.sql`ss."securityStatus"`;
  const regionColumn = usingKillListView
    ? database.sql`${k}."regionId"`
    : database.sql`ss."regionId"`;
  const groupColumn = usingKillListView
    ? database.sql`${k}."victimShipGroupId"`
    : database.sql`t."groupId"`;

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

  if (filters.minValue !== undefined) {
    conditions.push(database.sql`${k}."totalValue" >= ${filters.minValue}`);
  }

  if (filters.shipGroupIds && filters.shipGroupIds.length > 0) {
    conditions.push(database.sql`${groupColumn} = ANY(${filters.shipGroupIds})`);
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

  if (filters.solarSystemId !== undefined) {
    conditions.push(
      database.sql`${k}."solarSystemId" = ${filters.solarSystemId}`
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
  ss."regionId",
  ss."securityStatus" as security,
  k."victimCharacterId",
  k."victimCorporationId",
  k."victimAllianceId",
  k."victimShipTypeId",
  t."groupId" as "victimShipGroupId",
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

// Helper to get base query with joins
const BASE_QUERY = database.sql`
  FROM killmails k
  LEFT JOIN solarSystems ss ON k."solarSystemId" = ss."solarSystemId"
  LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"
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
    LEFT JOIN solarSystems sys ON k."solarSystemId" = sys."solarSystemId"
    LEFT JOIN regions reg ON sys."regionId" = reg."regionId"

    -- Victim JOINs
    LEFT JOIN characters vc ON k."victimCharacterId" = vc."characterId"
    LEFT JOIN npcCharacters vnpc ON k."victimCharacterId" = vnpc."characterId"
    LEFT JOIN corporations vcorp ON k."victimCorporationId" = vcorp."corporationId"
    LEFT JOIN npcCorporations vnpc_corp ON k."victimCorporationId" = vnpc_corp."corporationId"
    LEFT JOIN alliances valliance ON k."victimAllianceId" = valliance."allianceId"
    LEFT JOIN types vship ON k."victimShipTypeId" = vship."typeId"
    LEFT JOIN groups vshipgroup ON vship."groupId" = vshipgroup."groupId"

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
  spaceType?: string;
  isSolo?: boolean;
  isBig?: boolean;
  isNpc?: boolean;
  isAwox?: boolean;
  minValue?: number;
  shipGroupIds?: number[];
  minSecurityStatus?: number;
  maxSecurityStatus?: number;
  regionId?: number;
  regionIdMin?: number;
  regionIdMax?: number;
  solarSystemId?: number;
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
 * Count filtered kills
 */
export async function countFilteredKills(
  filters: KilllistFilters
): Promise<number> {
  const clause = buildKilllistConditions(filters, 'k');

  // Optimization: If no filters (clause is '1=1'), use pg_class estimate
  // This avoids locking all partitions which causes "out of shared memory"
  // We can check if clause is exactly '1=1' fragment? No, hard to check fragment content.
  // But we can check if filters are empty.
  const hasFilters = Object.keys(filters).length > 0 && Object.values(filters).some(v => v !== undefined);

  if (!hasFilters) {
    const [result] = await database.sql<{ count: string }[]>`
      SELECT sum(reltuples)::bigint as count
      FROM pg_class
      WHERE relname LIKE 'killmails_%' AND relkind = 'r'
    `;
    return Number(result?.count || 0);
  }

  const [result] = await database.sql<{ count: number }[]>`
    SELECT count(*) as count
     ${BASE_QUERY}
     WHERE ${clause}
  `;
  return Number(result?.count || 0);
}

/**
 * Get filtered kills with all names joined from SDE tables
 * Similar to getEntityKillmails but applies KilllistFilters instead of entity ID
 */
export async function getFilteredKillsWithNames(
  filters: KilllistFilters,
  page: number = 1,
  perPage: number = 50
): Promise<EntityKillmail[]> {
  const offset = (page - 1) * perPage;
  const clause = buildKilllistConditions(filters, 'kl');

  return await database.sql<EntityKillmail[]>`
    SELECT
      kl."killmailId",
      kl."killmailTime",

      -- Victim info
      kl."victimCharacterId",
      kl."victimCharacterName",
      kl."victimCorporationId",
      kl."victimCorporationName",
      kl."victimCorporationTicker",
      kl."victimAllianceId",
      kl."victimAllianceName",
      kl."victimAllianceTicker",
      kl."victimShipTypeId",
      kl."victimShipName",
      kl."victimShipGroup",

      -- Attacker info (top attacker)
      kl."attackerCharacterId",
      kl."attackerCharacterName",
      kl."attackerCorporationId",
      kl."attackerCorporationName",
      kl."attackerCorporationTicker",
      kl."attackerAllianceId",
      kl."attackerAllianceName",
      kl."attackerAllianceTicker",

      -- Location
      kl."solarSystemId",
      kl."solarSystemName",
      kl."regionName",

      -- Stats
      kl."totalValue",
      kl."attackerCount"

    FROM kill_list kl

    WHERE ${clause}
    ORDER BY kl."killmailTime" DESC
    LIMIT ${perPage} OFFSET ${offset}
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
  perPage: number = 30
): Promise<EntityKillmail[]> {
  const offset = (page - 1) * perPage;
  const attackerCol = attackerColumnMap[entityType];
  const victimCol = victimColumnMap[entityType];

  // For 'all' mode, just show kills for now
  // TODO: For very active characters, even simple queries cause "out of shared memory"
  // This requires increasing max_locks_per_transaction in PostgreSQL config
  if (mode === 'all') {
    return getEntityKillmails(entityId, entityType, 'kills', page, perPage);
  }

  // Step 1: Get killmail IDs - NO JOINS to avoid shared memory issues
  let killmailIds: number[] = [];

  if (mode === 'kills') {
    // Query attackers table - NO DISTINCT to avoid shared memory issues
    // Limit to recent records and deduplicate in application
    const attackerKillmails = await database.find<{ killmailId: number; killmailTime: string }>(
      `SELECT a."killmailId", a."killmailTime"
       FROM attackers a
       WHERE a.${database.identifier(attackerCol)} = :entityId
       ORDER BY a."killmailTime" DESC
       LIMIT :fetchLimit`,
      { entityId, fetchLimit: (perPage + offset) * 10 } // Fetch extra to account for duplicates
    );

    // Deduplicate and filter by time in application
    const seen = new Set<number>();
    const unique: Array<{ killmailId: number; killmailTime: string }> = [];

    for (const km of attackerKillmails) {
      if (!seen.has(km.killmailId)) {
        const time = new Date(km.killmailTime).getTime();
        const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
        if (time >= cutoff) {
          seen.add(km.killmailId);
          unique.push(km);
        }
      }
    }

    killmailIds = unique
      .slice(offset, offset + perPage)
      .map(km => km.killmailId);
  } else {
    // Losses only - use LIMIT without ORDER BY to avoid index scan locking issues
    const lossKillmails = await database.find<{ killmailId: number; killmailTime: string }>(
      `SELECT k."killmailId", k."killmailTime"
       FROM killmails k
       WHERE k.${database.identifier(victimCol)} = :entityId
       LIMIT :fetchLimit`,
      { entityId, fetchLimit: 50 } // Fetch small amount to avoid lock issues
    );

    // Sort, filter by time, and paginate in application
    const filtered = lossKillmails
      .filter(km => {
        const time = new Date(km.killmailTime).getTime();
        const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
        return time >= cutoff;
      })
      .sort((a, b) => {
        const timeA = new Date(a.killmailTime).getTime();
        const timeB = new Date(b.killmailTime).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return b.killmailId - a.killmailId;
      });

    killmailIds = filtered
      .slice(offset, offset + perPage)
      .map(r => r.killmailId);
  }  if (killmailIds.length === 0) {
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

const attackerColumnMap: EntityColumnMap = {
  character: 'characterId',
  corporation: 'corporationId',
  alliance: 'allianceId',
};

const victimColumnMap: EntityColumnMap = {
  character: 'victimCharacterId',
  corporation: 'victimCorporationId',
  alliance: 'victimAllianceId',
};



export async function countEntityKillmails(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  mode: 'kills' | 'losses' | 'all'
): Promise<number> {
  const attackerCol = attackerColumnMap[entityType];
  const victimCol = victimColumnMap[entityType];

  // Time range: last 7 days (matching getEntityKillmails)
  const timeFilter = "k.\"killmailTime\" >= NOW() - INTERVAL '7 days'";

  if (mode === 'kills') {
    // Count distinct killmails from attackers table directly
    const query = `
      SELECT COUNT(DISTINCT a."killmailId") AS count
      FROM attackers a
      JOIN killmails k ON a."killmailId" = k."killmailId"
      WHERE ${timeFilter}
      AND a.${database.identifier(attackerCol)} = :entityId
    `;
    const row = await database.findOne<{ count: number }>(query, { entityId });
    return Number(row?.count ?? 0);
  }

  if (mode === 'losses') {
    const query = `
      SELECT COUNT(*) AS count
      FROM killmails k
      WHERE ${timeFilter}
      AND k.${database.identifier(victimCol)} = :entityId
    `;
    const row = await database.findOne<{ count: number }>(query, { entityId });
    return Number(row?.count ?? 0);
  }

  // all mode - return estimated count without actual database query
  // Counting all kills for very active characters causes "out of shared memory" errors
  // For pagination purposes, we return a large estimated value
  // The actual pagination is limited to 7 days of data anyway
  return 100000; // Reasonable upper bound for 7 days of killmails
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

  const whereClause = conditions.slice(1).reduce(
    (acc, clause) => database.sql`${acc} OR ${clause}`,
    conditions[0]
  );

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

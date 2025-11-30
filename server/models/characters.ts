/**
 * Character Model
 * Handles character-related data queries
 */
import { database } from '../helpers/database';

export interface CharacterInfo {
  id: number;
  name: string;
  corporation: {
    id: number;
    name: string;
    ticker: string;
  } | null;
  alliance: {
    id: number;
    name: string;
    ticker: string;
  } | null;
  stats: {
    kills: number;
    losses: number;
    killLossRatio: number;
    efficiency: number;
    iskDestroyed: number;
    iskLost: number;
    iskEfficiency: number;
  };
}

/**
 * Get character information with statistics
 */
export async function getCharacterInfo(
  characterId: number
): Promise<CharacterInfo | null> {
  // First get character name from characters table
  const character = await database.findOne<{ name: string }>(
    `SELECT "name"
    FROM characters
    WHERE "characterId" = :characterId
    LIMIT 1`,
    { characterId }
  );

  if (!character || !character.name) {
    return null;
  }

  // Get latest corporation/alliance info from most recent killmail activity
  const corpAllianceQuery = await database.findOne<{
    corporationId: number | null;
    corporationName: string | null;
    corporationTicker: string | null;
    allianceId: number | null;
    allianceName: string | null;
    allianceTicker: string | null;
  }>(
    `SELECT
      corporationId,
      corporationName,
      corporationTicker,
      allianceId,
      allianceName,
      allianceTicker
    FROM (
      SELECT
        a."corporationId" as "corporationId",
        corp.name as "corporationName",
        corp.ticker as "corporationTicker",
        a."allianceId" as "allianceId",
        alliance.ticker as "allianceName",
        alliance.ticker as "allianceTicker",
        k."killmailTime" as "lastSeen"
      FROM attackers a
      LEFT JOIN killmails k ON a."killmailId" = k."killmailId"
      LEFT JOIN corporations corp ON a."corporationId" = corp."corporationId"
      LEFT JOIN alliances alliance ON a."allianceId" = alliance."allianceId"
      WHERE a."characterId" = :characterId

      UNION ALL

      SELECT
        k."victimCorporationId" as "corporationId",
        corp.name as "corporationName",
        corp.ticker as "corporationTicker",
        k."victimAllianceId" as "allianceId",
        alliance.name as "allianceName",
        alliance.ticker as "allianceTicker",
        k."killmailTime" as "lastSeen"
      FROM killmails k
      LEFT JOIN corporations corp ON k."victimCorporationId" = corp."corporationId"
      LEFT JOIN alliances alliance ON k."victimAllianceId" = alliance."allianceId"
      WHERE k."victimCharacterId" = :characterId
    ) as sub
    ORDER BY "lastSeen" DESC
    LIMIT 1`,
    { characterId }
  );

  // Build corporation object
  let corporation: CharacterInfo['corporation'] = null;
  if (corpAllianceQuery?.corporationId) {
    corporation = {
      id: corpAllianceQuery.corporationId,
      name:
        corpAllianceQuery.corporationName ||
        `Corp ${corpAllianceQuery.corporationId}`,
      ticker: corpAllianceQuery.corporationTicker || '???',
    };
  }

  // Build alliance object
  let alliance: CharacterInfo['alliance'] = null;
  if (corpAllianceQuery?.allianceId) {
    alliance = {
      id: corpAllianceQuery.allianceId,
      name:
        corpAllianceQuery.allianceName ||
        `Alliance ${corpAllianceQuery.allianceId}`,
      ticker: corpAllianceQuery.allianceTicker || '???',
    };
  }

  // Get statistics
  const stats = await database.findOne<{
    kills: number;
    losses: number;
    iskDestroyed: number;
    iskLost: number;
  }>(
    `WITH
      kills_stats AS (
        SELECT
          count(*) as kills,
          sum(COALESCE(p."averagePrice", 0)) +
          sum(i.totalValue) as "iskDestroyed"
        FROM attackers a
        LEFT JOIN killmails k ON a."killmailId" = k."killmailId" AND a."killmailTime" = k."killmailTime"
        LEFT JOIN prices p ON k."victimShipTypeId" = p."typeId" AND k."killmailTime"::date = p."priceDate"
        LEFT JOIN (
          SELECT
            items."killmailId" as "killmailId",
            sum(("quantityDestroyed" + "quantityDropped") * COALESCE(prices."averagePrice", 0)) as totalValue
          FROM items
          LEFT JOIN killmails km ON items."killmailId" = km."killmailId" AND items."killmailTime" = km."killmailTime"
          LEFT JOIN prices ON items."itemTypeId" = prices."typeId" AND km."killmailTime"::date = prices."priceDate"
          GROUP BY items."killmailId"
        ) i ON k."killmailId" = i."killmailId"
        WHERE a."characterId" = :characterId
      ),
      losses_stats AS (
        SELECT
          count(*) as losses,
          sum(COALESCE(p."averagePrice", 0)) +
          sum(i.totalValue) as "iskLost"
        FROM killmails k
        LEFT JOIN prices p ON k."victimShipTypeId" = p."typeId" AND k."killmailTime"::date = p."priceDate"
        LEFT JOIN (
          SELECT
            items."killmailId" as "killmailId",
            sum(("quantityDestroyed" + "quantityDropped") * COALESCE(prices."averagePrice", 0)) as totalValue
          FROM items
          LEFT JOIN killmails km ON items."killmailId" = km."killmailId" AND items."killmailTime" = km."killmailTime"
          LEFT JOIN prices ON items."itemTypeId" = prices."typeId" AND km."killmailTime"::date = prices."priceDate"
          GROUP BY items."killmailId"
        ) i ON k."killmailId" = i."killmailId"
        WHERE k."victimCharacterId" = :characterId
      )
    SELECT
      kills_stats.kills as kills,
      losses_stats.losses as losses,
      kills_stats."iskDestroyed" as "iskDestroyed",
      losses_stats."iskLost" as "iskLost"
    FROM kills_stats, losses_stats`,
    { characterId }
  );

  const kills = Number(stats?.kills) || 0;
  const losses = Number(stats?.losses) || 0;
  const iskDestroyed = stats?.iskDestroyed || 0;
  const iskLost = stats?.iskLost || 0;
  const killLossRatio = losses > 0 ? kills / losses : kills;
  const efficiency =
    iskDestroyed + iskLost > 0
      ? (iskDestroyed / (iskDestroyed + iskLost)) * 100
      : 0;
  const iskEfficiency =
    iskDestroyed + iskLost > 0
      ? (iskDestroyed / (iskDestroyed + iskLost)) * 100
      : 0;

  return {
    id: characterId,
    name: character.name,
    corporation,
    alliance,
    stats: {
      kills,
      losses,
      killLossRatio,
      efficiency,
      iskDestroyed,
      iskLost,
      iskEfficiency,
    },
  };
}

export interface ShipGroupStats {
  groupId: number;
  groupName: string;
  killed: number;
  lost: number;
}

/**
 * Get ship group statistics for a character (last 30 days)
 */
export async function getShipGroupStatsByCharacter(
  characterId: number
): Promise<ShipGroupStats[]> {
  const stats = await database.find<ShipGroupStats>(
    `WITH
      killed_stats AS (
        SELECT
          g."groupId" as "groupId",
          g.name as "groupName",
          count(*) as killed
        FROM attackers a
        LEFT JOIN killmails k ON a."killmailId" = k."killmailId" AND a."killmailTime" = k."killmailTime"
        LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"
        LEFT JOIN groups g ON t."groupId" = g."groupId"
        WHERE a."characterId" = :characterId
          AND k."killmailTime" >= NOW() - INTERVAL '30 days'
          AND g."groupId" IS NOT NULL
        GROUP BY g."groupId", g.name
      ),
      lost_stats AS (
        SELECT
          g."groupId" as "groupId",
          g.name as "groupName",
          count(*) as lost
        FROM killmails k
        LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"
        LEFT JOIN groups g ON t."groupId" = g."groupId"
        WHERE k."victimCharacterId" = :characterId
          AND k."killmailTime" >= NOW() - INTERVAL '30 days'
          AND g."groupId" IS NOT NULL
        GROUP BY g."groupId", g.name
      )
    SELECT
      coalesce(killed_stats."groupId", lost_stats."groupId") as "groupId",
      coalesce(killed_stats."groupName", lost_stats."groupName") as "groupName",
      coalesce(killed_stats.killed, 0) as killed,
      coalesce(lost_stats.lost, 0) as lost
    FROM killed_stats
    FULL OUTER JOIN lost_stats ON killed_stats."groupId" = lost_stats."groupId"
    ORDER BY (coalesce(killed_stats.killed, 0) + coalesce(lost_stats.lost, 0)) DESC
    LIMIT 100`,
    { characterId }
  );

  return stats;
}

export interface CharacterTopEntity {
  id: number;
  name: string;
  kills: number;
}

export interface CharacterTopBoxStats {
  ships: CharacterTopEntity[];
  systems: CharacterTopEntity[];
  regions: CharacterTopEntity[];
  corporations: CharacterTopEntity[];
  alliances: CharacterTopEntity[];
}

/**
 * Get top 10 stats for a character (last 7 days)
 * Shows: ships, systems, regions, corporations, alliances (excludes characters)
 */
export async function getTop10StatsByCharacter(
  characterId: number
): Promise<CharacterTopBoxStats> {
  // Top ships killed
  const ships = await database.find<CharacterTopEntity>(
    `SELECT
      t."typeId" as id,
      t.name as name,
      count(*) as kills
    FROM attackers a
    LEFT JOIN killmails k ON a."killmailId" = k."killmailId" AND a."killmailTime" = k."killmailTime"
    LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"
    WHERE a."characterId" = :characterId
      AND k."killmailTime" >= NOW() - INTERVAL '7 days'
      AND t."typeId" IS NOT NULL
    GROUP BY t."typeId", t.name
    ORDER BY kills DESC
    LIMIT 10`,
    { characterId }
  );

  const systems = await database.find<CharacterTopEntity>(
    `SELECT
      sys."solarSystemId" as id,
      sys.name as name,
      count(*) as kills
    FROM attackers a
    LEFT JOIN killmails k ON a."killmailId" = k."killmailId" AND a."killmailTime" = k."killmailTime"
    LEFT JOIN solarSystems sys ON k."solarSystemId" = sys."solarSystemId"
    WHERE a."characterId" = :characterId
      AND k."killmailTime" >= NOW() - INTERVAL '7 days'
      AND sys."solarSystemId" IS NOT NULL
    GROUP BY sys."solarSystemId", sys.name
    ORDER BY kills DESC
    LIMIT 10`,
    { characterId }
  );

  const regions = await database.find<CharacterTopEntity>(
    `SELECT
      reg."regionId" as id,
      reg.name as name,
      count(*) as kills
    FROM attackers a
    LEFT JOIN killmails k ON a."killmailId" = k."killmailId" AND a."killmailTime" = k."killmailTime"
    LEFT JOIN solarSystems sys ON k."solarSystemId" = sys."solarSystemId"
    LEFT JOIN regions reg ON sys."regionId" = reg."regionId"
    WHERE a."characterId" = :characterId
      AND k."killmailTime" >= NOW() - INTERVAL '7 days'
      AND reg."regionId" IS NOT NULL
    GROUP BY reg."regionId", reg.name
    ORDER BY kills DESC
    LIMIT 10`,
    { characterId }
  );

  const corporations = await database.find<CharacterTopEntity>(
    `SELECT
      corp."corporationId" as id,
      corp.name as name,
      count(*) as kills
    FROM attackers a
    LEFT JOIN killmails k ON a."killmailId" = k."killmailId" AND a."killmailTime" = k."killmailTime"
    LEFT JOIN npcCorporations corp ON k."victimCorporationId" = corp."corporationId"
    WHERE a."characterId" = :characterId
      AND k."killmailTime" >= NOW() - INTERVAL '7 days'
      AND corp."corporationId" IS NOT NULL
    GROUP BY corp."corporationId", corp.name
    ORDER BY kills DESC
    LIMIT 10`,
    { characterId }
  );

  const alliances = await database.find<CharacterTopEntity>(
    `SELECT
      alliance."corporationId" as id,
      alliance.name as name,
      count(*) as kills
    FROM attackers a
    LEFT JOIN killmails k ON a."killmailId" = k."killmailId" AND a."killmailTime" = k."killmailTime"
    LEFT JOIN npcCorporations alliance ON k."victimAllianceId" = alliance."corporationId"
    WHERE a."characterId" = :characterId
      AND k."killmailTime" >= NOW() - INTERVAL '7 days'
      AND alliance."corporationId" IS NOT NULL
      AND k."victimAllianceId" IS NOT NULL
    GROUP BY alliance."corporationId", alliance.name
    ORDER BY kills DESC
    LIMIT 10`,
    { characterId }
  );

  return {
    ships,
    systems,
    regions,
    corporations,
    alliances,
  };
}

export interface CharacterKillmailRow {
  killmail_id: number;
  killmail_time: Date;
  victim_ship_type_id: number;
  victim_ship_name: string;
  victim_ship_group: string;
  victim_characterId: number | null;
  victim_character_name: string;
  victim_corporationId: number;
  victim_corporation_name: string;
  victim_corporation_ticker: string;
  victim_allianceId: number | null;
  victim_alliance_name: string | null;
  victim_alliance_ticker: string | null;
  attacker_characterId: number | null;
  attacker_character_name: string;
  attacker_corporationId: number | null;
  attacker_corporation_name: string;
  attacker_corporation_ticker: string;
  attacker_allianceId: number | null;
  attacker_alliance_name: string | null;
  attacker_alliance_ticker: string | null;
  solar_system_id: number;
  solar_system_name: string;
  solar_system_security: number;
  region_id: number;
  region_name: string;
  ship_value: number;
  total_value: number;
  attacker_count: number;
}

/**
 * Get killmails for a character
 * @param characterId Character ID
 * @param limit Number of killmails to return
 * @param offset Offset for pagination
 * @param type Filter by 'all', 'kills', or 'losses'
 */
export async function getCharacterKillmails(
  characterId: number,
  limit: number = 30,
  offset: number = 0,
  type: 'all' | 'kills' | 'losses' = 'all'
): Promise<CharacterKillmailRow[]> {
  const baseQuery = `
    SELECT
      k."killmailId" as killmail_id,
      k."killmailTime" as killmail_time,
      k."victimShipTypeId" as victim_ship_type_id,
      t.name as victim_ship_name,
      g.name as victim_ship_group,
      k."victimCharacterId" as victim_characterId,
      c.name as victim_character_name,
      k."victimCorporationId" as victim_corporationId,
      corp.name as victim_corporation_name,
      corp.ticker as victim_corporation_ticker,
      k."victimAllianceId" as victim_allianceId,
      all.name as victim_alliance_name,
      all.ticker as victim_alliance_ticker,
      k."topAttackerCharacterId" as attacker_characterId,
      ac.name as attacker_character_name,
      k."topAttackerCorporationId" as attacker_corporationId,
      acorp.name as attacker_corporation_name,
      acorp.ticker as attacker_corporation_ticker,
      k."topAttackerAllianceId" as attacker_allianceId,
      aall.name as attacker_alliance_name,
      aall.ticker as attacker_alliance_ticker,
      k."solarSystemId" as solar_system_id,
      sys.name as solar_system_name,
      sys."securityStatus" as solar_system_security,
      sys."regionId" as region_id,
      reg.name as region_name,
      COALESCE(p."averagePrice", 0) as ship_value,
      k."totalValue" as total_value,
      k."attackerCount" as attacker_count
    FROM killmails k
    LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"
    LEFT JOIN groups g ON t."groupId" = g."groupId"
    LEFT JOIN characters c ON k."victimCharacterId" = c."characterId"
    LEFT JOIN corporations corp ON k."victimCorporationId" = corp."corporationId"
    LEFT JOIN alliances all ON k."victimAllianceId" = all."allianceId"
    LEFT JOIN characters ac ON k."topAttackerCharacterId" = ac."characterId"
    LEFT JOIN corporations acorp ON k."topAttackerCorporationId" = acorp."corporationId"
    LEFT JOIN alliances aall ON k."topAttackerAllianceId" = aall."allianceId"
    LEFT JOIN solarSystems sys ON k."solarSystemId" = sys."solarSystemId"
    LEFT JOIN regions reg ON sys."regionId" = reg."regionId"
    LEFT JOIN prices p ON k."victimShipTypeId" = p."typeId" AND k."killmailTime"::date = p."priceDate"`;

  let whereClause = '';
  if (type === 'kills') {
    whereClause = `AND k."killmailId" IN (
        SELECT "killmailId"
        FROM attackers
        WHERE "characterId" = :characterId
      )`;
  } else if (type === 'losses') {
    whereClause = 'AND k."victimCharacterId" = :characterId';
  } else {
    whereClause = `AND (
        k."victimCharacterId" = :characterId
        OR k."killmailId" IN (
          SELECT "killmailId"
          FROM attackers
          WHERE "characterId" = :characterId
        )
      )`;
  }

  return database.find<CharacterKillmailRow>(
    `${baseQuery}
    WHERE 1=1
      ${whereClause}
    ORDER BY k."killmailTime" DESC
    LIMIT :limit OFFSET :offset`,
    { characterId, limit, offset }
  );
}

/**
 * Count killmails for a character
 * @param characterId Character ID
 * @param type Filter by 'all', 'kills', or 'losses'
 */
export async function getCharacterKillmailCount(
  characterId: number,
  type: 'all' | 'kills' | 'losses' = 'all'
): Promise<number> {
  let whereClause = '';
  if (type === 'kills') {
    whereClause = `AND "killmailId" IN (
        SELECT "killmailId"
        FROM attackers
        WHERE "characterId" = :characterId
      )`;
  } else if (type === 'losses') {
    whereClause = 'AND "victimCharacterId" = :characterId';
  } else {
    whereClause = `AND (
        "victimCharacterId" = :characterId
        OR "killmailId" IN (
          SELECT "killmailId"
          FROM attackers
          WHERE "characterId" = :characterId
        )
      )`;
  }

  const result = await database.findOne<{ count: number }>(
    `SELECT count(*) as count
    FROM killmails
    WHERE 1=1
      ${whereClause}`,
    { characterId }
  );

  return Number(result?.count || 0);
}

/**
 * Character database record interface
 */
export interface Character {
  characterId: number;
  allianceId: number | null;
  birthday: string;
  bloodlineId: number;
  corporationId: number;
  description: string;
  factionId: number | null;
  gender: string;
  name: string;
  raceId: number;
  securityStatus: number;
  title: string | null;
  updatedAt?: Date;
}

/**
 * Get character by ID (basic record)
 */
export async function getCharacter(
  characterId: number
): Promise<Character | null> {
  return database.findOne<Character>(
    'SELECT * FROM characters WHERE "characterId" = :characterId',
    { characterId }
  );
}

/**
 * Check if character exists and is fresh (updated within maxAgeDays)
 * @returns The character if fresh, null if doesn't exist or is stale
 */
export async function getFreshCharacter(
  characterId: number,
  maxAgeDays: number = 14
): Promise<Character | null> {
  const character = await database.findOne<Character>(
    `SELECT * FROM characters
     WHERE "characterId" = :characterId
     AND "updatedAt" > NOW() - INTERVAL '${maxAgeDays} days'`,
    { characterId }
  );
  return character;
}

/**
 * Get multiple characters by IDs
 */
export async function getCharacters(
  characterIds: number[]
): Promise<Character[]> {
  if (characterIds.length === 0) return [];

  return database.find<Character>(
    'SELECT * FROM characters WHERE "characterId" = ANY(:characterIds)',
    { characterIds }
  );
}

/**
 * Search characters by name
 */
export async function searchCharacters(
  searchTerm: string,
  limit: number = 20
): Promise<Character[]> {
  return database.find<Character>(
    `SELECT * FROM characters
    WHERE "name" ILIKE :pattern
    ORDER BY "name"
    LIMIT :limit`,
    { pattern: `%${searchTerm}%`, limit }
  );
}

/**
 * Get character name by ID
 */
export async function getCharacterName(
  characterId: number
): Promise<string | null> {
  const result = await database.findOne<{ name: string }>(
    'SELECT "name" FROM characters WHERE "characterId" = :characterId',
    { characterId }
  );
  return result?.name || null;
}

/**
 * Character with corporation and alliance info
 */
export interface CharacterWithCorporationAndAlliance {
  name: string;
  corporationId: number;
  corporationName: string;
  corporationTicker: string;
  allianceId: number | null;
  allianceName: string | null;
  allianceTicker: string | null;
}

/**
 * Get character with joined corporation and alliance data
 */
export async function getCharacterWithCorporationAndAlliance(
  characterId: number
): Promise<CharacterWithCorporationAndAlliance | null> {
  return database.findOne<CharacterWithCorporationAndAlliance>(
    `SELECT
      c.name as name,
      c."corporationId" as "corporationId",
      corp.name as "corporationName",
      corp.ticker as "corporationTicker",
      corp."allianceId" as "allianceId",
      alliance.name as "allianceName",
      alliance.ticker as "allianceTicker"
    FROM characters c
    LEFT JOIN corporations corp ON c."corporationId" = corp."corporationId"
    LEFT JOIN alliances alliance ON corp."allianceId" = alliance."allianceId"
    WHERE c."characterId" = :characterId
    LIMIT 1`,
    { characterId }
  );
}

/**
 * Store or update character data
 */
export async function storeCharacter(
  characterId: number,
  data: {
    allianceId: number | null;
    birthday: string | null;
    bloodlineId: number;
    corporationId: number;
    description: string;
    factionId: number | null;
    gender: string;
    name: string;
    raceId: number;
    securityStatus: number;
    title: string | null;
  }
): Promise<void> {
  await database.bulkUpsert(
    'characters',
    [
      {
        characterId: characterId,
        allianceId: data.allianceId,
        birthday: data.birthday,
        bloodlineId: data.bloodlineId,
        corporationId: data.corporationId,
        description: data.description,
        factionId: data.factionId,
        gender: data.gender,
        name: data.name,
        raceId: data.raceId,
        securityStatus: data.securityStatus,
        title: data.title,
      },
    ],
    ['characterId']
  );
}

/**
 * Bulk store character data (for backfill/import)
 */
export async function storeCharactersBulk(
  characters: Array<{
    characterId: number;
    allianceId: number | null;
    birthday: string | null;
    bloodlineId: number;
    corporationId: number;
    description: string;
    gender: string;
    name: string;
    raceId: number;
    securityStatus: number;
  }>
): Promise<void> {
  if (characters.length === 0) return;

  const records = characters.map((char) => ({
    characterId: char.characterId,
    allianceId: char.allianceId,
    birthday: char.birthday,
    bloodlineId: char.bloodlineId,
    corporationId: char.corporationId,
    description: char.description,
    gender: char.gender,
    name: char.name,
    raceId: char.raceId,
    securityStatus: char.securityStatus,
  }));

  await database.bulkUpsert('characters', records, ['characterId']);
}

/**
 * Check if character exists
 */
export async function characterExists(characterId: number): Promise<boolean> {
  const result = await database.findOne<{ count: number }>(
    'SELECT count(*) as count FROM characters WHERE "characterId" = :characterId',
    { characterId }
  );
  return Number(result?.count) > 0;
}

/**
 * Get approximate character count (very fast, uses PostgreSQL statistics)
 */
export async function getApproximateCharacterCount(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COALESCE(reltuples::bigint, 0) as count
     FROM pg_class
     WHERE relname = 'characters'`
  );
  return Number(result?.count || 0);
}

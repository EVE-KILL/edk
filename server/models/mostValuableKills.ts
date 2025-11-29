import { database } from '../helpers/database';

/**
 * Most Valuable Kills Model
 *
 * Queries killmails table directly instead of most_valuable_kills view.
 */

export interface MostValuableKill {
  periodType: 'hour' | 'day' | 'week' | '14d' | 'month' | 'all';
  killmailId: number;
  killmailTime: Date;
  solarSystemId: number;
  solarSystemName?: string | null;
  victimCharacterId: number | null;
  victimCharacterName: string;
  victimCorporationId: number;
  victimCorporationName: string;
  victimCorporationTicker: string;
  victimAllianceId: number | null;
  victimAllianceName: string | null;
  victimAllianceTicker: string | null;
  victimShipTypeId: number;
  victimShipName?: string;
  victimShipGroup?: string;
  totalValue: number;
  attackerCount: number;
  npc: boolean;
  solo: boolean;
  attackerCharacterId: number | null;
  attackerCharacterName: string | null;
  attackerCorporationId: number | null;
  attackerCorporationName: string | null;
  attackerCorporationTicker: string | null;
  attackerAllianceId: number | null;
  attackerAllianceName: string | null;
  attackerAllianceTicker?: string | null;
  regionName?: string | null;
}

const getSelectClause = (periodType: string) => `
  '${periodType}' as "periodType",
  k."killmailId",
  k."killmailTime",
  k."solarSystemId",
  ss.name as "solarSystemName",
  k."victimCharacterId",
  vc.name as "victimCharacterName",
  k."victimCorporationId",
  vcorp.name as "victimCorporationName",
  vcorp.ticker as "victimCorporationTicker",
  k."victimAllianceId",
  valliance.name as "victimAllianceName",
  valliance.ticker as "victimAllianceTicker",
  k."victimShipTypeId",
  vship.name as "victimShipName",
  vshipgroup.name as "victimShipGroup",
  k."totalValue",
  k."attackerCount",
  k.npc,
  k.solo,
  k."topAttackerCharacterId" as "attackerCharacterId",
  ac.name as "attackerCharacterName",
  k."topAttackerCorporationId" as "attackerCorporationId",
  acorp.name as "attackerCorporationName",
  acorp.ticker as "attackerCorporationTicker",
  k."topAttackerAllianceId" as "attackerAllianceId",
  aalliance.name as "attackerAllianceName",
  aalliance.ticker as "attackerAllianceTicker",
  reg.name as "regionName"
`;

const JOIN_CLAUSE = `
  FROM killmails k
  LEFT JOIN solarSystems ss ON k."solarSystemId" = ss."solarSystemId"
  LEFT JOIN regions reg ON ss."regionId" = reg."regionId"
  LEFT JOIN characters vc ON k."victimCharacterId" = vc."characterId"
  LEFT JOIN corporations vcorp ON k."victimCorporationId" = vcorp."corporationId"
  LEFT JOIN alliances valliance ON k."victimAllianceId" = valliance."allianceId"
  LEFT JOIN types vship ON k."victimShipTypeId" = vship."typeId"
  LEFT JOIN groups vshipgroup ON vship."groupId" = vshipgroup."groupId"
  LEFT JOIN characters ac ON k."topAttackerCharacterId" = ac."characterId"
  LEFT JOIN corporations acorp ON k."topAttackerCorporationId" = acorp."corporationId"
  LEFT JOIN alliances aalliance ON k."topAttackerAllianceId" = aalliance."allianceId"
`;

function getHoursAgo(periodType: string): number {
  switch (periodType) {
    case 'hour':
      return 1;
    case 'day':
      return 24;
    case 'week':
      return 168;
    case '14d':
      return 336; // 14 days * 24 hours
    case 'month':
      return 720;
    case 'all':
      return 876000;
    default:
      return 168;
  }
}

/**
 * Get most valuable kills for a period
 */
export async function getMostValuableKillsByPeriod(
  periodType: 'hour' | 'day' | 'week' | '14d' | 'month' | 'all',
  limit: number = 50,
  options?: {
    excludeStructures?: boolean;
    structuresOnly?: boolean;
  }
): Promise<MostValuableKill[]> {
  const hoursAgo = getHoursAgo(periodType);
  const selectClause = getSelectClause(periodType);

  // Actual structures and deployables (for Structures tab)
  const actualStructureGroupIds = [
    1657,
    1406,
    1404,
    1408,
    2017,
    2016, // Citadels, Engineering Complex, Refinery, Jump Bridge, Cyno Jammer/Beacon
    4744, // Upwell Moon Drill
    1246,
    1247,
    1249,
    1250,
    1274,
    1275,
    1276,
    1297, // Mobile Depot, Siphon, Cyno Inhibitor, Tractor, Decoy, Scan Inhibitor, Micro Jump, Vault
    4093,
    4107,
    4137,
    4913, // Mobile Cyno Beacon, Observatory, Analysis Beacon, Phase Anchor
    336,
    361,
    364,
    414,
    417,
    418,
    426,
    430,
    438,
    449,
    1149, // Mobile Sentries, Warp Disruptor, Storage, Power Core, Shield Gen, Reactor, Jump Disruptor
  ];

  // All non-combat ships and structures (for Ships tab exclusion)
  const nonCombatGroupIds = [
    ...actualStructureGroupIds,
    513,
    902, // Freighter, Jump Freighter
    28,
    380,
    883,
    941,
    1895,
    1925,
    4975, // Hauler (T1 Industrial), Deep Space Transport (Bustard etc), Capital Industrial (Bowhead), Industrial Command Ship (Orca/Porpoise), Irregular variants
    1202, // Blockade Runner (Viator, Deluge, etc)
    463,
    543,
    1762, // Mining Barge, Exhumer, Irregular Mining Barge
    1283,
    4902,
    4945, // Expedition Frigate (Prospect, Endurance), Expedition Command Ship (Magus, Squall), Irregular variants
  ];

  let structureFilter = '';
  if (options?.excludeStructures) {
    structureFilter = `AND vship."groupId" NOT IN (${nonCombatGroupIds.join(',')})`;
  } else if (options?.structuresOnly) {
    structureFilter = `AND vship."groupId" IN (${actualStructureGroupIds.join(',')})`;
  }

  return database.find<MostValuableKill>(
    `SELECT
      ${selectClause}
    ${JOIN_CLAUSE}
    WHERE k."killmailTime" >= NOW() - (:hoursAgo || ' hours')::interval
      AND k."attackerCount" > 0
      ${structureFilter}
    ORDER BY k."totalValue" DESC, k."killmailTime" DESC, k."killmailId"
    LIMIT :limit`,
    { hoursAgo, limit }
  );
}

/**
 * Get most valuable kills for a specific character (as attacker)
 */
export async function getMostValuableKillsByCharacter(
  characterId: number,
  periodType: 'hour' | 'day' | 'week' | '14d' | 'month' | 'all',
  limit: number = 50
): Promise<MostValuableKill[]> {
  const hoursAgo = getHoursAgo(periodType);
  const selectClause = getSelectClause(periodType);

  return database.find<MostValuableKill>(
    `SELECT ${selectClause}
     ${JOIN_CLAUSE}
     WHERE k."topAttackerCharacterId" = :characterId
       AND k."killmailTime" >= NOW() - (:hoursAgo || ' hours')::interval
     ORDER BY k."totalValue" DESC, k."killmailTime" DESC, k."killmailId"
     LIMIT :limit`,
    { characterId, hoursAgo, limit }
  );
}

/**
 * Get most valuable kills for a specific corporation (as attacker)
 */
export async function getMostValuableKillsByCorporation(
  corporationId: number,
  periodType: 'hour' | 'day' | 'week' | '14d' | 'month' | 'all',
  limit: number = 50
): Promise<MostValuableKill[]> {
  const hoursAgo = getHoursAgo(periodType);
  const selectClause = getSelectClause(periodType);

  return database.find<MostValuableKill>(
    `SELECT ${selectClause}
     ${JOIN_CLAUSE}
     WHERE k."topAttackerCorporationId" = :corporationId
       AND k."killmailTime" >= NOW() - (:hoursAgo || ' hours')::interval
     ORDER BY k."totalValue" DESC, k."killmailTime" DESC, k."killmailId"
     LIMIT :limit`,
    { corporationId, hoursAgo, limit }
  );
}

/**
 * Get most valuable kills for a specific alliance (as attacker)
 */
export async function getMostValuableKillsByAlliance(
  allianceId: number,
  periodType: 'hour' | 'day' | 'week' | '14d' | 'month' | 'all',
  limit: number = 50
): Promise<MostValuableKill[]> {
  const hoursAgo = getHoursAgo(periodType);
  const selectClause = getSelectClause(periodType);

  return database.find<MostValuableKill>(
    `SELECT ${selectClause}
     ${JOIN_CLAUSE}
     WHERE k."topAttackerAllianceId" = :allianceId
       AND k."killmailTime" >= NOW() - (:hoursAgo || ' hours')::interval
     ORDER BY k."totalValue" DESC, k."killmailTime" DESC, k."killmailId"
     LIMIT :limit`,
    { allianceId, hoursAgo, limit }
  );
}

/**
 * Get most valuable solo kills
 */
export async function getMostValuableSoloKills(
  periodType: 'hour' | 'day' | 'week' | '14d' | 'month' | 'all',
  limit: number = 50
): Promise<MostValuableKill[]> {
  const hoursAgo = getHoursAgo(periodType);
  const selectClause = getSelectClause(periodType);

  return database.find<MostValuableKill>(
    `SELECT ${selectClause}
     ${JOIN_CLAUSE}
     WHERE k.solo = true
       AND k."killmailTime" >= NOW() - (:hoursAgo || ' hours')::interval
     ORDER BY k."totalValue" DESC, k."killmailTime" DESC, k."killmailId"
     LIMIT :limit`,
    { hoursAgo, limit }
  );
}

/**
 * Get most valuable kills for a specific solar system
 */
export async function getMostValuableKillsBySystem(
  solarSystemId: number,
  periodType: 'hour' | 'day' | 'week' | '14d' | 'month' | 'all',
  limit: number = 50
): Promise<MostValuableKill[]> {
  const hoursAgo = getHoursAgo(periodType);
  const selectClause = getSelectClause(periodType);

  return database.find<MostValuableKill>(
    `SELECT ${selectClause}
     ${JOIN_CLAUSE}
     WHERE k."solarSystemId" = :solarSystemId
       AND k."killmailTime" >= NOW() - (:hoursAgo || ' hours')::interval
       AND k."attackerCount" > 0
     ORDER BY k."totalValue" DESC, k."killmailTime" DESC, k."killmailId"
     LIMIT :limit`,
    { solarSystemId, hoursAgo, limit }
  );
}

/**
 * Get most valuable kills for a specific constellation
 */
export async function getMostValuableKillsByConstellation(
  constellationId: number,
  periodType: 'hour' | 'day' | 'week' | '14d' | 'month' | 'all',
  limit: number = 50
): Promise<MostValuableKill[]> {
  const hoursAgo = getHoursAgo(periodType);
  const selectClause = getSelectClause(periodType);

  return database.find<MostValuableKill>(
    `SELECT ${selectClause}
     ${JOIN_CLAUSE}
     WHERE ss."constellationId" = :constellationId
       AND k."killmailTime" >= NOW() - (:hoursAgo || ' hours')::interval
       AND k."attackerCount" > 0
     ORDER BY k."totalValue" DESC, k."killmailTime" DESC, k."killmailId"
     LIMIT :limit`,
    { constellationId, hoursAgo, limit }
  );
}

/**
 * Get most valuable kills for a specific region
 */
export async function getMostValuableKillsByRegion(
  regionId: number,
  periodType: 'hour' | 'day' | 'week' | '14d' | 'month' | 'all',
  limit: number = 50
): Promise<MostValuableKill[]> {
  const hoursAgo = getHoursAgo(periodType);
  const selectClause = getSelectClause(periodType);

  return database.find<MostValuableKill>(
    `SELECT ${selectClause}
     ${JOIN_CLAUSE}
     WHERE ss."regionId" = :regionId
       AND k."killmailTime" >= NOW() - (:hoursAgo || ' hours')::interval
       AND k."attackerCount" > 0
     ORDER BY k."totalValue" DESC, k."killmailTime" DESC, k."killmailId"
     LIMIT :limit`,
    { regionId, hoursAgo, limit }
  );
}

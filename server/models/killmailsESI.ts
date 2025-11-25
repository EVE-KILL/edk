import { database } from '../helpers/database';

/**
 * Killmails ESI Model
 *
 * Simulates ESI format response by querying base tables
 * (Since materialized view killmails_esi was removed)
 */

export interface KillmailESI {
  killmailId: number;
  killmailTime: Date;
  solarSystemId: number;

  // Victim data
  victimCharacterId: number;
  victimCorporationId: number;
  victimAllianceId: number;
  victimShipTypeId: number;
  victimDamageTaken: number;
  victimPosition: string; // JSON: {x, y, z}

  // Pre-serialized arrays
  attackers: string; // JSON array
  items: string; // JSON array

  // Metadata
  totalValue: number;
  attackerCount: number;
  npc: boolean;
  solo: boolean;
  awox: boolean;

  version: number;
}

// Helper to construct the base query fragment as a string
const BASE_QUERY = `
SELECT
  k."killmailId",
  k."killmailTime",
  k."solarSystemId",
  k."victimCharacterId",
  k."victimCorporationId",
  k."victimAllianceId",
  k."victimShipTypeId",
  k."victimDamageTaken",
  json_build_object('x', k."positionX", 'y', k."positionY", 'z', k."positionZ") as "victimPosition",

  COALESCE((
    SELECT json_agg(json_build_object(
      'character_id', a."characterId",
      'corporation_id', a."corporationId",
      'alliance_id', a."allianceId",
      'damage_done', a."damageDone",
      'final_blow', a."finalBlow",
      'security_status', a."securityStatus",
      'ship_type_id', a."shipTypeId",
      'weapon_type_id', a."weaponTypeId"
    ))
    FROM attackers a
    WHERE a."killmailId" = k."killmailId" AND a."killmailTime" = k."killmailTime"
  ), '[]'::json) as attackers,

  COALESCE((
    SELECT json_agg(json_build_object(
      'item_type_id', i."itemTypeId",
      'flag', i.flag,
      'quantity_dropped', i."quantityDropped",
      'quantity_destroyed', i."quantityDestroyed",
      'singleton', i.singleton
    ))
    FROM items i
    WHERE i."killmailId" = k."killmailId" AND i."killmailTime" = k."killmailTime"
  ), '[]'::json) as items,

  k."totalValue",
  k."attackerCount",
  k.npc,
  k.solo,
  k.awox,
  k.version
FROM killmails k
`;

/**
 * Get killmail in ESI format (simulated)
 */
export async function getKillmailESI(
  killmailId: number
): Promise<KillmailESI | null> {
  return database.findOne<KillmailESI>(
    `${BASE_QUERY} WHERE k."killmailId" = :killmailId`,
    { killmailId }
  );
}

/**
 * Get multiple killmails in ESI format
 */
export async function getKillmailsESI(
  killmailIds: number[]
): Promise<KillmailESI[]> {
  if (killmailIds.length === 0) return [];

  return database.find<KillmailESI>(
    `${BASE_QUERY}
     WHERE k."killmailId" = ANY(:killmailIds)
     ORDER BY k."killmailTime" DESC`,
    { killmailIds }
  );
}

/**
 * Get recent killmails in ESI format
 */
export async function getRecentKillmailsESI(
  limit: number = 50
): Promise<KillmailESI[]> {
  return database.find<KillmailESI>(
    `${BASE_QUERY}
     ORDER BY k."killmailTime" DESC, k."killmailId" DESC
     LIMIT :limit`,
    { limit }
  );
}

/**
 * Check if killmail exists
 */
export async function killmailESIExists(killmailId: number): Promise<boolean> {
  const result = await database.findOne<{ count: number }>(
    `SELECT count(*) as count FROM killmails WHERE "killmailId" = :killmailId`,
    { killmailId }
  );
  return Number(result?.count || 0) > 0;
}

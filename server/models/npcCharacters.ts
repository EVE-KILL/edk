import { database } from '../helpers/database';

/**
 * NPC Characters Model
 *
 * Provides query methods for npcCharacters SDE table
 */

export interface NPCCharacter {
  characterId: number;
  name: string;
  corporationId?: number;
  allianceId?: number;
  bloodlineId?: number;
  ancestryId?: number;
  gender?: number;
  raceId?: number;
}

/**
 * Get a single NPC character by ID
 */
export async function getNPCCharacter(
  characterId: number
): Promise<NPCCharacter | null> {
  return database.findOne<NPCCharacter>(
    'SELECT * FROM "npcCharacters" WHERE "characterId" = :characterId',
    { characterId }
  );
}

/**
 * Get all NPC characters in a corporation
 */
export async function getNPCCharactersByCorporation(
  corporationId: number
): Promise<NPCCharacter[]> {
  return database.find<NPCCharacter>(
    'SELECT * FROM "npcCharacters" WHERE "corporationId" = :corporationId ORDER BY name',
    { corporationId }
  );
}

/**
 * Get all NPC characters of a bloodline
 */
export async function getNPCCharactersByBloodline(
  bloodlineId: number
): Promise<NPCCharacter[]> {
  return database.find<NPCCharacter>(
    'SELECT * FROM "npcCharacters" WHERE "bloodlineId" = :bloodlineId ORDER BY name',
    { bloodlineId }
  );
}

/**
 * Search NPC characters by name
 */
export async function searchNPCCharacters(
  namePattern: string,
  limit: number = 10
): Promise<NPCCharacter[]> {
  return database.find<NPCCharacter>(
    `SELECT * FROM "npcCharacters"
     WHERE name ILIKE :pattern
     ORDER BY name
     LIMIT :limit`,
    { pattern: `%${namePattern}%`, limit }
  );
}

/**
 * Get NPC character name by ID
 */
export async function getNPCCharacterName(
  characterId: number
): Promise<string | null> {
  const result = await database.findOne<{ name: string }>(
    'SELECT name FROM "npcCharacters" WHERE "characterId" = :characterId',
    { characterId }
  );
  return result?.name || null;
}

/**
 * Count total NPC characters
 */
export async function countNPCCharacters(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    'SELECT count(*) as count FROM "npcCharacters"'
  );
  return Number(result?.count || 0);
}

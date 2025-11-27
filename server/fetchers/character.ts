import { fetchESI } from '../helpers/esi';
import {
  storeCharacter as storeCharacterInDB,
  getCharacter,
} from '../models/characters';
import { logger } from '../helpers/logger';

/**
 * ESI Character Data - Fields we store
 * Only contains fields from the official ESI API
 */
export interface ESICharacter {
  alliance_id: number | null;
  birthday: string;
  bloodline_id: number;
  corporation_id: number;
  description: string;
  faction_id: number | null;
  gender: string;
  name: string;
  race_id: number;
  security_status: number;
  title: string | null;
}

/**
 * Fetch character data from ESI
 * Stores only ESI-compatible fields in the database
 */
export async function fetchAndStoreCharacter(
  characterId: number
): Promise<ESICharacter | null> {
  try {
    const characterData = await fetchFromESI(characterId);

    if (!characterData) {
      return null;
    }

    // Extract only ESI fields
    const esiCharacter = extractESIFields(characterData);

    // Store in database
    await storeCharacter(characterId, esiCharacter);

    return esiCharacter;
  } catch (error) {
    logger.error(`ESI fetch failed for character ${characterId}`, {
      error: String(error),
    });
    return null;
  }
}

/**
 * Fetch character data from ESI API
 */
async function fetchFromESI(characterId: number): Promise<any | null> {
  try {
    const response = await fetchESI(`/characters/${characterId}`);

    if (!response.ok) {
      if (response.status === 404) {
        // Check if error message indicates character is deleted
        if (
          response.data &&
          response.data.error === 'Character has been deleted!'
        ) {
          await markCharacterAsDeleted(characterId);
          return null;
        }
      }
      throw new Error(`ESI API error: ${response.statusText}`);
    }

    // Character exists - ensure deleted flag is false (in case it was restored)
    await unmarkCharacterAsDeleted(characterId);

    return response.data;
  } catch (error) {
    logger.error(`ESI fetch failed for character ${characterId}`, {
      error: String(error),
    });
    return null;
  }
}

/**
 * Mark a character as deleted in the database
 */
async function markCharacterAsDeleted(characterId: number): Promise<void> {
  const { database } = await import('../helpers/database');

  await database.execute(
    `UPDATE characters
     SET deleted = TRUE, "updatedAt" = NOW()
     WHERE "characterId" = :characterId`,
    { characterId }
  );

  logger.info(`Marked character ${characterId} as deleted`);
}

/**
 * Unmark a character as deleted (in case it was restored)
 */
async function unmarkCharacterAsDeleted(characterId: number): Promise<void> {
  const { database } = await import('../helpers/database');

  await database.execute(
    `UPDATE characters
     SET deleted = FALSE, "updatedAt" = NOW()
     WHERE "characterId" = :characterId AND deleted = TRUE`,
    { characterId }
  );
}

/**
 * Extract only ESI-compatible fields from character data
 */
function extractESIFields(data: any): ESICharacter {
  return {
    alliance_id: data.alliance_id ?? null,
    birthday: data.birthday,
    bloodline_id: data.bloodline_id,
    corporation_id: data.corporation_id,
    description: data.description ?? '',
    faction_id: data.faction_id ?? null,
    gender: data.gender,
    name: data.name,
    race_id: data.race_id,
    security_status: data.security_status ?? 0,
    title: data.title ?? null,
  };
}

/**
 * Store character in database
 */
async function storeCharacter(
  characterId: number,
  character: ESICharacter
): Promise<void> {
  await storeCharacterInDB(characterId, {
    allianceId: character.alliance_id,
    birthday: character.birthday,
    bloodlineId: character.bloodline_id,
    corporationId: character.corporation_id,
    description: character.description,
    factionId: character.faction_id,
    gender: character.gender,
    name: character.name,
    raceId: character.race_id,
    securityStatus: character.security_status,
    title: character.title,
  });
}

/**
 * Get cached character from database
 */
export async function getCachedCharacter(
  characterId: number
): Promise<ESICharacter | null> {
  try {
    const result = await getCharacter(characterId);

    if (!result) {
      return null;
    }

    return {
      alliance_id: result.allianceId,
      birthday: result.birthday,
      bloodline_id: result.bloodlineId,
      corporation_id: result.corporationId,
      description: result.description,
      faction_id: result.factionId,
      gender: result.gender,
      name: result.name,
      race_id: result.raceId,
      security_status: result.securityStatus,
      title: result.title,
    };
  } catch {
    return null;
  }
}

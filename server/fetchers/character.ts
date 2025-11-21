import { fetchESI } from '../helpers/esi'
import { storeCharacter as storeCharacterInDB, getCharacter } from '../models/characters'

/**
 * ESI Character Data - Fields we store
 * Only contains fields from the official ESI API
 */
export interface ESICharacter {
  alliance_id: number | null
  birthday: string
  bloodline_id: number
  corporation_id: number
  description: string
  gender: string
  name: string
  race_id: number
  security_status: number
}

/**
 * Fetch character data from ESI
 * Stores only ESI-compatible fields in the database
 */
export async function fetchAndStoreCharacter(characterId: number): Promise<ESICharacter | null> {
  try {
    const characterData = await fetchFromESI(characterId)

    if (!characterData) {
      return null
    }

    // Extract only ESI fields
    const esiCharacter = extractESIFields(characterData)

    // Store in database
    await storeCharacter(characterId, esiCharacter)

    return esiCharacter
  } catch (error) {
    console.error(`ESI fetch failed for character ${characterId}:`, error)
    return null
  }
}

/**
 * Fetch character data from ESI API
 */
async function fetchFromESI(characterId: number): Promise<any | null> {
  try {
    const response = await fetchESI(`/characters/${characterId}`)

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`ESI API error: ${response.statusText}`)
    }

    return response.data
  } catch (error) {
    console.error(`ESI fetch failed for character ${characterId}:`, error)
    return null
  }
}

/**
 * Extract only ESI-compatible fields from character data
 */
function extractESIFields(data: any): ESICharacter {
  return {
    alliance_id: data.alliance_id || null,
    birthday: data.birthday,
    bloodline_id: data.bloodline_id,
    corporation_id: data.corporation_id,
    description: data.description || '',
    gender: data.gender,
    name: data.name,
    race_id: data.race_id,
    security_status: data.security_status || 0
  }
}

/**
 * Store character in database
 */
async function storeCharacter(characterId: number, character: ESICharacter): Promise<void> {
  await storeCharacterInDB(characterId, {
    allianceId: character.alliance_id,
    birthday: character.birthday,
    bloodlineId: character.bloodline_id,
    corporationId: character.corporation_id,
    description: character.description,
    gender: character.gender,
    name: character.name,
    raceId: character.race_id,
    securityStatus: character.security_status
  })
}

/**
 * Get cached character from database
 */
export async function getCachedCharacter(characterId: number): Promise<ESICharacter | null> {
  try {
    const result = await getCharacter(characterId)

    if (!result) {
      return null
    }

    return {
      alliance_id: result.allianceId,
      birthday: result.birthday,
      bloodline_id: result.bloodlineId,
      corporation_id: result.corporationId,
      description: result.description,
      gender: result.gender,
      name: result.name,
      race_id: result.raceId,
      security_status: result.securityStatus
    }
  } catch (error) {
    return null
  }
}

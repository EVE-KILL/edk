import { database } from '../helpers/database'
import { fetchEveKill, fetchESI } from '../helpers/fetcher'

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
 * Fetch character data from EVE-KILL with fallback to ESI
 * Stores only ESI-compatible fields in the database
 */
export async function fetchAndStoreCharacter(characterId: number): Promise<ESICharacter | null> {
  try {
    // Try EVE-KILL first
    let characterData = await fetchFromEveKill(characterId)

    // Fallback to ESI if EVE-KILL fails
    if (!characterData) {
      console.log(`⚠️  EVE-KILL failed for character ${characterId}, falling back to ESI`)
      characterData = await fetchFromESI(characterId)
    }

    if (!characterData) {
      console.error(`❌ Failed to fetch character ${characterId} from both sources`)
      return null
    }

    // Extract only ESI fields
    const esiCharacter = extractESIFields(characterData)

    // Store in database
    await storeCharacter(characterId, esiCharacter)

    return esiCharacter
  } catch (error) {
    console.error(`❌ Error fetching character ${characterId}:`, error)
    return null
  }
}

/**
 * Fetch character data from EVE-KILL API
 */
async function fetchFromEveKill(characterId: number): Promise<any | null> {
  try {
    const response = await fetchEveKill(`/characters/${characterId}`)

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`EVE-KILL API error: ${response.statusText}`)
    }

    return response.data
  } catch (error) {
    console.warn(`⚠️  EVE-KILL fetch failed for character ${characterId}:`, error)
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
    console.warn(`⚠️  ESI fetch failed for character ${characterId}:`, error)
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
  const now = Math.floor(Date.now() / 1000)

  await database.bulkInsert('edk.characters', [
    {
      character_id: characterId,
      alliance_id: character.alliance_id,
      birthday: character.birthday,
      bloodline_id: character.bloodline_id,
      corporation_id: character.corporation_id,
      description: character.description,
      gender: character.gender,
      name: character.name,
      race_id: character.race_id,
      security_status: character.security_status,
      updated_at: now,
      version: now
    }
  ])
}

/**
 * Get cached character from database
 */
export async function getCachedCharacter(characterId: number): Promise<ESICharacter | null> {
  try {
    const result = await database.queryOne<any>(
      'SELECT * FROM edk.characters WHERE character_id = {id:UInt32}',
      { id: characterId }
    )

    if (!result) {
      return null
    }

    return {
      alliance_id: result.alliance_id,
      birthday: result.birthday,
      bloodline_id: result.bloodline_id,
      corporation_id: result.corporation_id,
      description: result.description,
      gender: result.gender,
      name: result.name,
      race_id: result.race_id,
      security_status: result.security_status
    }
  } catch (error) {
    console.warn(`⚠️  Failed to get cached character ${characterId}:`, error)
    return null
  }
}

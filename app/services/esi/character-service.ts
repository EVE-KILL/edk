import { db } from "../../../src/db";
import { characters } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../../../src/utils/logger";
import { BaseESIService, ESINotFoundError } from "../../../src/services/esi/base-service";
import type { Character, NewCharacter } from "../../db/schema/characters";

/**
 * ESI Character Response
 */
interface ESICharacterResponse {
  alliance_id?: number;
  birthday: string;
  bloodline_id: number;
  corporation_id: number;
  description?: string;
  faction_id?: number;
  gender: string;
  name: string;
  race_id: number;
  security_status?: number;
  title?: string;
}

/**
 * Character Service
 * Fetches and caches character data from ESI
 */
export class CharacterService extends BaseESIService {
  /**
   * Get character by ID (from database or ESI)
   */
  async getCharacter(characterId: number): Promise<Character> {
    // Check database first
    const cached = await this.getFromDatabase(characterId);
    if (cached) {
      return cached;
    }

    // Fetch from ESI
    logger.info(`Fetching character ${characterId} from ESI`);
    return await this.fetchAndStore(characterId);
  }

  /**
   * Fetch character from ESI and store in database
   */
  private async fetchAndStore(characterId: number): Promise<Character> {
    try {
      const esiData = await this.fetchFromESI<ESICharacterResponse>(
        `/characters/${characterId}/`,
        `character:${characterId}`
      );

      // Transform and store
      const character = this.transformESIData(characterId, esiData);
      await this.storeInDatabase(character);

      // Fetch the stored character from database to get all fields
      const stored = await this.getFromDatabase(characterId);
      if (!stored) {
        throw new Error(`Failed to store character ${characterId}`);
      }

      return stored;
    } catch (error) {
      if (error instanceof ESINotFoundError) {
        logger.error(`Character ${characterId} not found in ESI`);
        throw new Error(`Character ${characterId} does not exist`);
      }
      throw error;
    }
  }

  /**
   * Get character from database
   */
  private async getFromDatabase(
    characterId: number
  ): Promise<Character | null> {
    try {
      const [character] = await db
        .select()
        .from(characters)
        .where(eq(characters.characterId, characterId))
        .limit(1);

      return character || null;
    } catch (error) {
      logger.error(`Failed to get character ${characterId} from database:`, error);
      return null;
    }
  }

  /**
   * Store character in database
   */
  private async storeInDatabase(character: NewCharacter): Promise<void> {
    try {
      await db
        .insert(characters)
        .values(character)
        .onConflictDoUpdate({
          target: characters.characterId,
          set: {
            name: character.name,
            corporationId: character.corporationId,
            allianceId: character.allianceId,
            factionId: character.factionId,
            securityStatus: character.securityStatus,
            title: character.title,
            rawData: character.rawData,
            updatedAt: new Date(),
          },
        });

      logger.info(`Stored character ${character.characterId} in database`);
    } catch (error) {
      logger.error(`Failed to store character ${character.characterId}:`, error);
      throw error;
    }
  }

  /**
   * Transform ESI data to database format
   */
  private transformESIData(
    characterId: number,
    esiData: ESICharacterResponse
  ): NewCharacter {
    return {
      characterId,
      name: esiData.name,
      corporationId: esiData.corporation_id,
      allianceId: esiData.alliance_id,
      factionId: esiData.faction_id,
      birthday: new Date(esiData.birthday),
      securityStatus: esiData.security_status?.toString(),
      title: esiData.title,
      rawData: esiData,
    };
  }

  /**
   * Refresh character data from ESI (force update)
   */
  async refreshCharacter(characterId: number): Promise<Character> {
    logger.info(`Force refreshing character ${characterId} from ESI`);
    return await this.fetchAndStore(characterId);
  }
}

// Export singleton instance
export const characterService = new CharacterService();

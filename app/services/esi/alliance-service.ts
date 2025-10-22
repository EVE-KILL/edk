import { db } from "../../../src/db";
import { alliances } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../../../src/utils/logger";
import { EveKillProxyService } from "../../../src/services/esi/eve-kill-proxy-service";
import { ESINotFoundError } from "../../../src/services/esi/base-service";
import type { Alliance, NewAlliance } from "../../../db/schema/alliances";

/**
 * ESI Alliance Response
 */
interface ESIAllianceResponse {
  creator_corporation_id: number;
  creator_id: number;
  date_founded: string;
  executor_corporation_id?: number;
  faction_id?: number;
  name: string;
  ticker: string;
}

/**
 * Alliance Service
 * Fetches alliance data from EVE-KILL (with ESI fallback) and caches in database
 */
export class AllianceService extends EveKillProxyService {
  /**
   * Get alliance by ID (from database or ESI)
   */
  async getAlliance(allianceId: number): Promise<Alliance> {
    // Check database first
    const cached = await this.getFromDatabase(allianceId);
    if (cached) {
      return cached;
    }

    // Fetch from EVE-KILL/ESI
    logger.info(`Fetching alliance ${allianceId}`);
    return await this.fetchAndStore(allianceId);
  }

  /**
   * Fetch alliance from EVE-KILL (with ESI fallback) and store in database
   */
  private async fetchAndStore(allianceId: number): Promise<Alliance> {
    try {
      const esiData = await this.fetchWithFallback<ESIAllianceResponse>(
        `/alliances/${allianceId}`,      // EVE-KILL endpoint
        `/alliances/${allianceId}/`,     // ESI endpoint
        `alliance:${allianceId}`         // Cache key
      );

      // Transform and store
      const alliance = this.transformESIData(allianceId, esiData);
      await this.storeInDatabase(alliance);

      // Fetch the stored alliance from database to get all fields
      const stored = await this.getFromDatabase(allianceId);
      if (!stored) {
        throw new Error(`Failed to store alliance ${allianceId}`);
      }

      return stored;
    } catch (error) {
      if (error instanceof ESINotFoundError) {
        logger.error(`Alliance ${allianceId} not found`);
        throw new Error(`Alliance ${allianceId} does not exist`);
      }
      throw error;
    }
  }

  /**
   * Get alliance from database
   */
  private async getFromDatabase(allianceId: number): Promise<Alliance | null> {
    try {
      const [alliance] = await db
        .select()
        .from(alliances)
        .where(eq(alliances.allianceId, allianceId))
        .limit(1);

      return alliance || null;
    } catch (error) {
      logger.error(`Failed to get alliance ${allianceId} from database:`, error);
      return null;
    }
  }

  /**
   * Store alliance in database
   */
  private async storeInDatabase(alliance: NewAlliance): Promise<void> {
    try {
      await db
        .insert(alliances)
        .values(alliance)
        .onConflictDoUpdate({
          target: alliances.allianceId,
          set: {
            name: alliance.name,
            ticker: alliance.ticker,
            creatorCorporationId: alliance.creatorCorporationId,
            creatorId: alliance.creatorId,
            dateFounded: alliance.dateFounded,
            executorCorporationId: alliance.executorCorporationId,
            factionId: alliance.factionId,
            rawData: alliance.rawData,
            updatedAt: new Date(),
          },
        });

      logger.info(`Stored alliance ${alliance.allianceId} in database`);
    } catch (error) {
      logger.error(`Failed to store alliance ${alliance.allianceId}:`, error);
      throw error;
    }
  }

  /**
   * Transform ESI data to database format
   */
  private transformESIData(
    allianceId: number,
    esiData: ESIAllianceResponse
  ): NewAlliance {
    return {
      allianceId,
      name: esiData.name,
      ticker: esiData.ticker,
      creatorCorporationId: esiData.creator_corporation_id,
      creatorId: esiData.creator_id,
      dateFounded: new Date(esiData.date_founded),
      executorCorporationId: esiData.executor_corporation_id,
      factionId: esiData.faction_id,
      rawData: esiData,
    };
  }

  /**
   * Refresh alliance data from ESI (force update)
   */
  async refreshAlliance(allianceId: number): Promise<Alliance> {
    logger.info(`Force refreshing alliance ${allianceId} from ESI`);
    return await this.fetchAndStore(allianceId);
  }
}

// Export singleton instance
export const allianceService = new AllianceService();

import { db } from "../../db";
import { corporations } from "../../db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../../utils/logger";
import { BaseESIService, ESINotFoundError } from "./base-service";
import type { Corporation, NewCorporation } from "../../db/schema/corporations";

/**
 * ESI Corporation Response
 */
interface ESICorporationResponse {
  alliance_id?: number;
  ceo_id: number;
  creator_id: number;
  date_founded?: string;
  description?: string;
  faction_id?: number;
  home_station_id?: number;
  member_count: number;
  name: string;
  shares?: number;
  tax_rate: number;
  ticker: string;
  url?: string;
  war_eligible?: boolean;
}

/**
 * Corporation Service
 * Fetches and caches corporation data from ESI
 */
export class CorporationService extends BaseESIService {
  /**
   * Get corporation by ID (from database or ESI)
   */
  async getCorporation(corporationId: number): Promise<Corporation> {
    // Check database first
    const cached = await this.getFromDatabase(corporationId);
    if (cached) {
      logger.info(`Found corporation ${corporationId} in database`);
      return cached;
    }

    // Fetch from ESI
    logger.info(`Fetching corporation ${corporationId} from ESI`);
    return await this.fetchAndStore(corporationId);
  }

  /**
   * Fetch corporation from ESI and store in database
   */
  private async fetchAndStore(corporationId: number): Promise<Corporation> {
    try {
      const esiData = await this.fetchFromESI<ESICorporationResponse>(
        `/corporations/${corporationId}/`,
        `corporation:${corporationId}`
      );

      // Transform and store
      const corporation = this.transformESIData(corporationId, esiData);
      await this.storeInDatabase(corporation);

      // Fetch the stored corporation from database to get all fields
      const stored = await this.getFromDatabase(corporationId);
      if (!stored) {
        throw new Error(`Failed to store corporation ${corporationId}`);
      }

      return stored;
    } catch (error) {
      if (error instanceof ESINotFoundError) {
        logger.error(`Corporation ${corporationId} not found in ESI`);
        throw new Error(`Corporation ${corporationId} does not exist`);
      }
      throw error;
    }
  }

  /**
   * Get corporation from database
   */
  private async getFromDatabase(
    corporationId: number
  ): Promise<Corporation | null> {
    try {
      const [corporation] = await db
        .select()
        .from(corporations)
        .where(eq(corporations.corporationId, corporationId))
        .limit(1);

      return corporation || null;
    } catch (error) {
      logger.error(`Failed to get corporation ${corporationId} from database:`, error);
      return null;
    }
  }

  /**
   * Store corporation in database
   */
  private async storeInDatabase(corporation: NewCorporation): Promise<void> {
    try {
      await db
        .insert(corporations)
        .values(corporation)
        .onConflictDoUpdate({
          target: corporations.corporationId,
          set: {
            name: corporation.name,
            ticker: corporation.ticker,
            ceoId: corporation.ceoId,
            creatorId: corporation.creatorId,
            dateFounded: corporation.dateFounded,
            homeStationId: corporation.homeStationId,
            memberCount: corporation.memberCount,
            allianceId: corporation.allianceId,
            factionId: corporation.factionId,
            taxRate: corporation.taxRate,
            description: corporation.description,
            url: corporation.url,
            warEligible: corporation.warEligible,
            rawData: corporation.rawData,
            updatedAt: new Date(),
          },
        });

      logger.info(`Stored corporation ${corporation.corporationId} in database`);
    } catch (error) {
      logger.error(`Failed to store corporation ${corporation.corporationId}:`, error);
      throw error;
    }
  }

  /**
   * Transform ESI data to database format
   */
  private transformESIData(
    corporationId: number,
    esiData: ESICorporationResponse
  ): NewCorporation {
    return {
      corporationId,
      name: esiData.name,
      ticker: esiData.ticker,
      ceoId: esiData.ceo_id,
      creatorId: esiData.creator_id,
      dateFounded: esiData.date_founded ? new Date(esiData.date_founded) : undefined,
      homeStationId: esiData.home_station_id,
      memberCount: esiData.member_count,
      allianceId: esiData.alliance_id,
      factionId: esiData.faction_id,
      taxRate: esiData.tax_rate.toString(),
      description: esiData.description,
      url: esiData.url,
      warEligible: esiData.war_eligible,
      rawData: esiData,
    };
  }

  /**
   * Refresh corporation data from ESI (force update)
   */
  async refreshCorporation(corporationId: number): Promise<Corporation> {
    logger.info(`Force refreshing corporation ${corporationId} from ESI`);
    return await this.fetchAndStore(corporationId);
  }
}

// Export singleton instance
export const corporationService = new CorporationService();

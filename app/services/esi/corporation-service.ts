import { db } from "../../../src/db";
import { corporations } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../../../src/utils/logger";
import { EveKillProxyService } from "../../../src/services/esi/eve-kill-proxy-service";
import { ESINotFoundError } from "../../../src/services/esi/base-service";
import { sendEvent } from "../../../src/utils/event-client";
import type { Corporation, NewCorporation } from "../../../db/schema/corporations";

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
 * Fetches corporation data from EVE-KILL (with ESI fallback) and caches in database
 */
export class CorporationService extends EveKillProxyService {
  /**
   * Get corporation by ID (from database or ESI)
   */
  async getCorporation(corporationId: number): Promise<Corporation> {
    // Check database first
    const cached = await this.getFromDatabase(corporationId);
    if (cached) {
      return cached;
    }

    // Fetch from eve-kill.com (with ESI fallback)
    return await this.fetchAndStore(corporationId);
  }

  /**
   * Fetch corporation from EVE-KILL (with ESI fallback) and store in database
   */
  private async fetchAndStore(corporationId: number): Promise<Corporation> {
    try {
      const esiData = await this.fetchWithFallback<ESICorporationResponse>(
        `/corporations/${corporationId}`,    // EVE-KILL endpoint
        `/corporations/${corporationId}/`,   // ESI endpoint
        `corporation:${corporationId}`       // Cache key
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
        logger.error(`Corporation ${corporationId} not found`);
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

      // Emit entity update event to management API (which will broadcast to websocket)
      if (corporation.corporationId && corporation.name) {
        await sendEvent("entity-update", {
          entityType: "corporation",
          id: corporation.corporationId,
          name: corporation.name,
        });
      }
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

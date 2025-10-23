import { BaseWorker } from "../../src/queue/base-worker";
import type { Job } from "../../db/schema/jobs";
import { logger } from "../../src/utils/logger";
import { CharacterService } from "../services/esi/character-service";
import { CorporationService } from "../services/esi/corporation-service";
import { AllianceService } from "../services/esi/alliance-service";

/**
 * ESI Fetcher Worker
 *
 * Fetches dynamic data from EVE Swagger Interface (ESI):
 * - Character names and info
 * - Corporation info
 * - Alliance info
 *
 * Note: Type and System data is static and imported at startup,
 * so no need to fetch them on-demand.
 *
 * Uses proper ESI services with rate limiting and database caching
 */
export class ESIFetcher extends BaseWorker<{
  type: "character" | "corporation" | "alliance";
  id: number;
}> {
  override queueName = "esi";
  override concurrency = 10; // ESI allows good concurrency
  override pollInterval = 500; // Poll faster for ESI jobs

  private characterService = new CharacterService();
  private corporationService = new CorporationService();
  private allianceService = new AllianceService();

  override async handle(payload: { type: string; id: number }, job: Job) {
    const { type, id } = payload;

    try {
      let result;
      switch (type) {
        case "character":
          result = await this.characterService.getCharacter(id);
          break;
        case "corporation":
          result = await this.corporationService.getCorporation(id);
          break;
        case "alliance":
          result = await this.allianceService.getAlliance(id);
          break;
        default:
          throw new Error(`Unknown ESI type: ${type}`);
      }

      if (!result) {
        logger.warn(`⚠️  [ESIFetcher] ESI ${type} ${id} not found`);
      }
    } catch (error) {
      logger.error(`❌ [ESIFetcher] Failed to fetch ESI ${type} ${id}:`, error);
      throw error;
    }
  }
}

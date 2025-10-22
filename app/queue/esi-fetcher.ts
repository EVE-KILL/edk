import { BaseWorker } from "../../src/queue/base-worker";
import type { Job } from "../../db/schema/jobs";
import { logger } from "../../src/utils/logger";
import { CharacterService } from "../services/esi/character-service";
import { CorporationService } from "../services/esi/corporation-service";
import { AllianceService } from "../services/esi/alliance-service";
import { TypeService } from "../services/esi/type-service";
import { SolarSystemService } from "../services/esi/solar-system-service";

/**
 * ESI Fetcher Worker
 *
 * Fetches data from EVE Swagger Interface (ESI):
 * - Character names and info
 * - Corporation info
 * - Alliance info
 * - Ship types
 * - Solar systems
 *
 * Uses proper ESI services with rate limiting and database caching
 */
export class ESIFetcher extends BaseWorker<{
  type: "character" | "corporation" | "alliance" | "type" | "system";
  id: number;
}> {
  override queueName = "esi";
  override concurrency = 10; // ESI allows good concurrency
  override pollInterval = 500; // Poll faster for ESI jobs

  private characterService = new CharacterService();
  private corporationService = new CorporationService();
  private allianceService = new AllianceService();
  private typeService = new TypeService();
  private systemService = new SolarSystemService();

  override async handle(payload: { type: string; id: number }, job: Job) {
    const { type, id } = payload;

    logger.info(`🔍 [ESIFetcher] Processing ESI job: type=${type}, id=${id}`);

    try {
      let result;
      switch (type) {
        case "character":
          logger.info(`⬇️  [ESIFetcher] Fetching character ${id}...`);
          result = await this.characterService.getCharacter(id);
          logger.info(`✅ [ESIFetcher] Fetched character ${id}: ${result?.name || "Unknown"}`);
          break;
        case "corporation":
          logger.info(`⬇️  [ESIFetcher] Fetching corporation ${id}...`);
          result = await this.corporationService.getCorporation(id);
          logger.info(`✅ [ESIFetcher] Fetched corporation ${id}: ${result?.name || "Unknown"}`);
          break;
        case "alliance":
          logger.info(`⬇️  [ESIFetcher] Fetching alliance ${id}...`);
          result = await this.allianceService.getAlliance(id);
          logger.info(`✅ [ESIFetcher] Fetched alliance ${id}: ${result?.name || "Unknown"}`);
          break;
        case "type":
          logger.info(`⬇️  [ESIFetcher] Fetching type ${id}...`);
          result = await this.typeService.getType(id);
          logger.info(`✅ [ESIFetcher] Fetched type ${id}: ${result?.name || "Unknown"}`);
          break;
        case "system":
          logger.info(`⬇️  [ESIFetcher] Fetching system ${id}...`);
          result = await this.systemService.getSolarSystem(id);
          logger.info(`✅ [ESIFetcher] Fetched system ${id}: ${result?.name || "Unknown"}`);
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

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

    try {
      let result;
      switch (type) {
        case "character":
          result = await this.characterService.getCharacter(id);
          logger.debug(`  ↳ Fetched character ${id}: ${result?.name || "Unknown"}`);
          break;
        case "corporation":
          result = await this.corporationService.getCorporation(id);
          logger.debug(`  ↳ Fetched corporation ${id}: ${result?.name || "Unknown"}`);
          break;
        case "alliance":
          result = await this.allianceService.getAlliance(id);
          logger.debug(`  ↳ Fetched alliance ${id}: ${result?.name || "Unknown"}`);
          break;
        case "type":
          result = await this.typeService.getType(id);
          logger.debug(`  ↳ Fetched type ${id}: ${result?.name || "Unknown"}`);
          break;
        case "system":
          result = await this.systemService.getSolarSystem(id);
          logger.debug(`  ↳ Fetched system ${id}: ${result?.name || "Unknown"}`);
          break;
        default:
          throw new Error(`Unknown ESI type: ${type}`);
      }

      if (!result) {
        logger.debug(`  ↳ ESI ${type} ${id} not found`);
      }
    } catch (error) {
      logger.error(`  ↳ Failed to fetch ESI ${type} ${id}:`, error);
      throw error;
    }
  }
}

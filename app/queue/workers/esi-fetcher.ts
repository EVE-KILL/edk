import { BaseWorker } from "./base-worker";
import type { Job } from "../schema/jobs";
import { cache } from "../../utils/cache";
import { logger } from "../../utils/logger";

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
 * Caches results to avoid repeated API calls
 */
export class ESIFetcher extends BaseWorker<{
  type: "character" | "corporation" | "alliance" | "type" | "system";
  id: number;
}> {
  override queueName = "esi";
  override concurrency = 10; // ESI allows good concurrency
  override pollInterval = 500; // Poll faster for ESI jobs

  private readonly ESI_BASE = "https://esi.evetech.net/latest";
  private readonly USER_AGENT = "EVE-Kill/4.0 (https://eve-kill.com)";

  override async handle(payload: { type: string; id: number }, job: Job) {
    const { type, id } = payload;

    // Check cache first
    const cacheKey = `esi:${type}:${id}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      logger.debug(`  ↳ ESI ${type} ${id} from cache`);
      return;
    }

    // Fetch from ESI
    const url = this.getUrl(type, id);
    const response = await fetch(url, {
      headers: {
        "User-Agent": this.USER_AGENT,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        logger.debug(`  ↳ ESI ${type} ${id} not found (404)`);
        // Cache the "not found" result to avoid repeated lookups
        await cache.set(cacheKey, { notFound: true }, 86400); // 24 hours
        return;
      }

      throw new Error(`ESI returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    // Cache for 1 hour (ESI data doesn't change often)
    await cache.set(cacheKey, data, 3600);

    logger.debug(`  ↳ Fetched ESI ${type} ${id}: ${this.getDisplayName(type, data)}`);
  }

  /**
   * Get ESI URL for the given type and ID
   */
  private getUrl(type: string, id: number): string {
    switch (type) {
      case "character":
        return `${this.ESI_BASE}/characters/${id}`;
      case "corporation":
        return `${this.ESI_BASE}/corporations/${id}`;
      case "alliance":
        return `${this.ESI_BASE}/alliances/${id}`;
      case "type":
        return `${this.ESI_BASE}/universe/types/${id}`;
      case "system":
        return `${this.ESI_BASE}/universe/systems/${id}`;
      default:
        throw new Error(`Unknown ESI type: ${type}`);
    }
  }

  /**
   * Extract display name from ESI response
   */
  private getDisplayName(type: string, data: any): string {
    switch (type) {
      case "character":
      case "corporation":
      case "alliance":
        return data.name || "Unknown";
      case "type":
        return data.name || "Unknown";
      case "system":
        return data.name || "Unknown";
      default:
        return "Unknown";
    }
  }

  /**
   * Optional: Add rate limiting to respect ESI's limits
   * ESI allows 150 requests/second, but we should be conservative
   */
  private async rateLimit() {
    // Add small delay to avoid hammering ESI
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

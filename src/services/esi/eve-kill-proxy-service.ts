import { logger } from "../../utils/logger";
import { BaseESIService } from "./base-service";

/**
 * EVE-KILL Proxy Service Base
 *
 * Tries to fetch data from EVE-KILL API first (to reduce ESI load),
 * falls back to ESI if EVE-KILL fails or is unavailable.
 *
 * EVE-KILL API endpoints return the same data format as ESI,
 * so no data transformation is needed.
 */
export abstract class EveKillProxyService extends BaseESIService {
  private readonly EVE_KILL_BASE_URL = "https://eve-kill.com/api";
  private readonly EVE_KILL_TIMEOUT = 3000; // 3 second timeout for EVE-KILL

  /**
   * Try to fetch from EVE-KILL first, fall back to ESI
   *
   * @param eveKillEndpoint - EVE-KILL API endpoint (e.g., "/characters/123")
   * @param esiEndpoint - ESI endpoint (e.g., "/characters/123/")
   * @param cacheKey - Cache key for ESI caching
   * @returns Data from EVE-KILL or ESI
   */
  protected async fetchWithFallback<T>(
    eveKillEndpoint: string,
    esiEndpoint: string,
    cacheKey: string
  ): Promise<T> {
    // Try EVE-KILL first
    try {
      const data = await this.fetchFromEveKill<T>(eveKillEndpoint);
      logger.info(`Fetched from EVE-KILL: ${eveKillEndpoint}`);
      return data;
    } catch (error: any) {
      logger.warn(
        `EVE-KILL fetch failed for ${eveKillEndpoint}: ${error.message}. Falling back to ESI.`
      );

      // Fall back to ESI
      return await this.fetchFromESI<T>(esiEndpoint, cacheKey);
    }
  }

  /**
   * Fetch data from EVE-KILL API
   */
  private async fetchFromEveKill<T>(endpoint: string): Promise<T> {
    const url = `${this.EVE_KILL_BASE_URL}${endpoint}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.EVE_KILL_TIMEOUT);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "EVE-Kill/4.0 (https://eve-kill.com)",
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error: any) {
      clearTimeout(timeout);

      if (error.name === "AbortError") {
        throw new Error("EVE-KILL request timeout");
      }

      throw error;
    }
  }
}

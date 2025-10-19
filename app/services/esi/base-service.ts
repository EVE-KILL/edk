import { db } from "../../db";
import { esiCache } from "../../db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../../utils/logger";
import { esiRateLimiter } from "./rate-limiter";

/**
 * ESI Configuration
 */
const ESI_BASE_URL = process.env.ESI_BASE_URL || "https://esi.evetech.net/latest";
const ESI_COMPATIBILITY_DATE = process.env.ESI_COMPATIBILITY_DATE || "2020-01-01";

/**
 * ESI Error - thrown when entity doesn't exist (404)
 */
export class ESINotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ESINotFoundError";
  }
}

/**
 * Base ESI Service
 * Handles common ESI patterns: rate limiting, caching, headers
 */
export abstract class BaseESIService {
  protected baseUrl: string = ESI_BASE_URL;

  /**
   * Fetch data from ESI with caching and rate limiting
   */
  protected async fetchFromESI<T>(
    endpoint: string,
    cacheKey: string
  ): Promise<T> {
    // Wait for rate limiting if needed
    await esiRateLimiter.waitIfNeeded();

    // Check cache first
    const cached = await this.getCachedData(cacheKey);
    if (cached) {
      const { etag, expiresAt, data } = cached;

      // If not expired, return cached data
      if (expiresAt && new Date(expiresAt) > new Date()) {
        logger.info(`Using cached data for ${cacheKey}`);
        return data as T;
      }

      // If expired, try conditional request with ETag
      if (etag) {
        return await this.fetchWithETag<T>(endpoint, cacheKey, etag);
      }
    }

    // Fresh request
    return await this.fetchFresh<T>(endpoint, cacheKey);
  }

  /**
   * Fetch with ETag (conditional request)
   */
  private async fetchWithETag<T>(
    endpoint: string,
    cacheKey: string,
    etag: string
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.getHeaders();
    headers.set("If-None-Match", etag);

    try {
      const response = await fetch(url, { headers });

      // Update rate limiter
      esiRateLimiter.updateFromHeaders(response.headers);

      // 304 Not Modified - use cached data
      if (response.status === 304) {
        logger.info(`ETag match for ${cacheKey}, using cached data`);
        const cached = await this.getCachedData(cacheKey);
        return cached!.data as T;
      }

      // Handle response
      return await this.handleResponse<T>(response, cacheKey);
    } catch (error) {
      logger.error(`ESI fetch error for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Fresh fetch without ETag
   */
  private async fetchFresh<T>(
    endpoint: string,
    cacheKey: string
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.getHeaders();

    try {
      const response = await fetch(url, { headers });

      // Update rate limiter
      esiRateLimiter.updateFromHeaders(response.headers);

      return await this.handleResponse<T>(response, cacheKey);
    } catch (error) {
      logger.error(`ESI fetch error for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Handle ESI response
   */
  private async handleResponse<T>(
    response: Response,
    cacheKey: string
  ): Promise<T> {
    // 404 Not Found - entity doesn't exist
    if (response.status === 404) {
      throw new ESINotFoundError(`Entity not found: ${cacheKey}`);
    }

    // 5xx Server Error - pause for 1 minute
    if (response.status >= 500) {
      logger.error(`ESI server error (${response.status}), pausing for 1 minute`);
      esiRateLimiter.pauseForESIDown();
      throw new Error(`ESI server error: ${response.status}`);
    }

    // Other errors
    if (!response.ok) {
      throw new Error(`ESI request failed: ${response.status} ${response.statusText}`);
    }

    // Parse response
    const data = await response.json();

    // Cache the response
    await this.cacheResponse(cacheKey, response, data);

    return data as T;
  }

  /**
   * Get standard ESI headers
   */
  private getHeaders(): Headers {
    const headers = new Headers();
    headers.set("Accept", "application/json");
    headers.set("X-Compatibility-Date", ESI_COMPATIBILITY_DATE);
    return headers;
  }

  /**
   * Cache ESI response
   */
  private async cacheResponse(
    cacheKey: string,
    response: Response,
    data: any
  ): Promise<void> {
    const etag = response.headers.get("ETag");
    const expires = response.headers.get("Expires");
    const lastModified = response.headers.get("Last-Modified");

    const expiresAt = expires ? new Date(expires) : null;
    const lastModifiedAt = lastModified ? new Date(lastModified) : null;

    try {
      // Upsert cache entry
      await db
        .insert(esiCache)
        .values({
          cacheKey,
          etag: etag || undefined,
          expiresAt: expiresAt || undefined,
          lastModified: lastModifiedAt || undefined,
          data,
        })
        .onConflictDoUpdate({
          target: esiCache.cacheKey,
          set: {
            etag: etag || undefined,
            expiresAt: expiresAt || undefined,
            lastModified: lastModifiedAt || undefined,
            data,
            updatedAt: new Date(),
          },
        });

      logger.info(`Cached ESI response for ${cacheKey}`);
    } catch (error) {
      logger.error(`Failed to cache ESI response for ${cacheKey}:`, error);
    }
  }

  /**
   * Get cached data
   */
  private async getCachedData(cacheKey: string): Promise<{
    etag?: string;
    expiresAt?: Date;
    data: any;
  } | null> {
    try {
      const [cached] = await db
        .select()
        .from(esiCache)
        .where(eq(esiCache.cacheKey, cacheKey))
        .limit(1);

      if (!cached) return null;

      return {
        etag: cached.etag || undefined,
        expiresAt: cached.expiresAt || undefined,
        data: cached.data,
      };
    } catch (error) {
      logger.error(`Failed to get cached data for ${cacheKey}:`, error);
      return null;
    }
  }

  /**
   * Clear expired cache entries (to be called by a cleaner job)
   */
  static async clearExpiredCache(): Promise<number> {
    try {
      const result = await db
        .delete(esiCache)
        .where(eq(esiCache.expiresAt, new Date()))
        .returning();

      logger.info(`Cleared ${result.length} expired ESI cache entries`);
      return result.length;
    } catch (error) {
      logger.error("Failed to clear expired cache:", error);
      return 0;
    }
  }
}

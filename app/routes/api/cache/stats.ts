import { ApiController } from "../../../../src/controllers/api-controller";
import { cache } from "../../../../src/cache";

/**
 * Cache statistics endpoint
 * GET /api/cache/stats
 */
export class Controller extends ApiController {
  // Cache statistics endpoint with SWR
  static cacheConfig = {
    ttl: 10,                     // Fresh for 10 seconds
    staleWhileRevalidate: 20,    // Serve stale for 20 more seconds while refreshing
  };

  override async get(): Promise<Response> {
    const stats = await cache.getStats();
    const driver = process.env.CACHE_DRIVER || "lru";
    const cacheEnabled = process.env.CACHE_ENABLED !== "false";
    const responseCacheEnabled = process.env.RESPONSE_CACHE_ENABLED !== "false";
    const isDevelopment = process.env.NODE_ENV !== "production";

    return this.json({
      cache: {
        driver,
        enabled: cacheEnabled && !isDevelopment,
        responseCacheEnabled: responseCacheEnabled && !isDevelopment,
      },
      stats: {
        size: stats.size,
        maxSize: stats.maxSize,
        hits: stats.hits,
        misses: stats.misses,
        hitRate: `${stats.hitRate}%`,
        memoryUsage: stats.memoryUsage
          ? `${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB`
          : "N/A",
      },
      config: {
        maxSize: process.env.CACHE_MAX_SIZE || "1000",
        maxMemory: `${process.env.CACHE_MAX_MEMORY || "512"} MB`,
        defaultTTL: `${process.env.CACHE_DEFAULT_TTL || "300"}s`,
        responseCacheTTL: `${process.env.RESPONSE_CACHE_DEFAULT_TTL || "60"}s`,
        maxResponseSize: `${
          parseInt(process.env.CACHE_MAX_RESPONSE_SIZE || "1048576", 10) / 1024 / 1024
        } MB`,
      },
    });
  }
}

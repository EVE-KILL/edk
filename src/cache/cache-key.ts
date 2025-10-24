import type { CacheConfig } from "../../app/types/cache.d";
import type {} from "../../app/types/request.d";

/**
 * Build a cache key for response caching
 */
export function buildResponseCacheKey(
  req: Request,
  config: CacheConfig,
  params?: Record<string, string>
): string {
  // Custom key generator
  if (typeof config.key === "function") {
    return config.key(req);
  }
  if (typeof config.key === "string") {
    return config.key;
  }

  const url = req.parsedUrl || new URL(req.url);
  const method = req.method;
  const pathname = url.pathname;

  // Start with method and pathname
  let key = `route:${method}:${pathname}`;

  // Add varying parameters
  if (config.vary) {
    for (const varKey of config.vary) {
      if (varKey === "query") {
        // Include all query parameters
        const queryString = url.search;
        if (queryString) {
          key += `:${queryString}`;
        }
      } else if (params && params[varKey]) {
        // Include specific route parameter (like :id)
        key += `:${varKey}=${params[varKey]}`;
      } else {
        // Check if it's a query string parameter
        const queryValue = url.searchParams.get(varKey);
        if (queryValue) {
          key += `:${varKey}=${queryValue}`;
        }
      }
    }
  }

  // For user-specific cache, include user identifier
  if (config.private) {
    // TODO: Extract user ID from auth when implemented
    // For now, use a placeholder
    const userId = getUserIdFromRequest(req);
    if (userId) {
      key += `:user=${userId}`;
    }
  }

  return key;
}

/**
 * Build a cache key for application data
 */
export function buildDataCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `data:${prefix}:${parts.join(":")}`;
}

/**
 * Extract user ID from request (placeholder for auth implementation)
 */
function getUserIdFromRequest(req: Request): string | null {
  // TODO: Implement when auth is added
  // Could check session, JWT, or cookies
  return null;
}

/**
 * Check if response should be cached based on size limit
 */
export function shouldCacheResponse(response: Response): boolean {
  const maxSize = parseInt(process.env.CACHE_MAX_RESPONSE_SIZE || "1048576", 10); // 1MB default

  // Check Content-Length header
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > maxSize) {
      return false;
    }
  }

  return true;
}

/**
 * Serialize response for caching
 */
export async function serializeResponse(response: Response): Promise<{
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value: string, key: string) => {
    headers[key] = value;
  });

  return {
    status: response.status,
    statusText: response.statusText,
    headers,
    body: await response.text(),
  };
}

/**
 * Wrapped cache entry with metadata for stale-while-revalidate
 */
export interface CachedResponseEntry {
  data: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
  };
  cachedAt: number;       // Timestamp when cached
  ttl: number;            // Fresh period in seconds
  swr?: number;           // Stale-while-revalidate period in seconds
  staleIfError?: number;  // Stale-if-error period in seconds
  accessCount?: number;   // Number of accesses in current monitoring window
  lastAccessTime?: number; // Last access timestamp
}

/**
 * Wrap response with cache metadata
 */
export function wrapCacheEntry(
  serializedResponse: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
  },
  config: CacheConfig
): CachedResponseEntry {
  return {
    data: serializedResponse,
    cachedAt: Date.now(),
    ttl: config.ttl || 60,
    swr: config.staleWhileRevalidate,
    staleIfError: config.staleIfError,
  };
}

/**
 * Check if cached entry is fresh, stale, or expired
 */
export function getCacheEntryState(entry: CachedResponseEntry): {
  state: "fresh" | "stale" | "expired";
  age: number;
} {
  const age = (Date.now() - entry.cachedAt) / 1000; // Age in seconds

  if (age < entry.ttl) {
    return { state: "fresh", age };
  }

  if (entry.swr && age < entry.ttl + entry.swr) {
    return { state: "stale", age };
  }

  return { state: "expired", age };
}

/**
 * Deserialize cached response data
 */
export function deserializeResponse(data: {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}, cacheState?: "fresh" | "stale"): Response {
  const headers = new Headers(data.headers);

  // Add cache headers
  if (cacheState === "fresh") {
    headers.set("X-Cache", "HIT");
  } else if (cacheState === "stale") {
    headers.set("X-Cache", "STALE");
  } else {
    headers.set("X-Cache", "HIT");
  }

  return new Response(data.body, {
    status: data.status,
    statusText: data.statusText,
    headers,
  });
}

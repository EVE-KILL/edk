import type { CacheConfig } from "../../types/cache.d";
import type {} from "../../types/request.d";

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
        // Include specific route parameter
        key += `:${varKey}=${params[varKey]}`;
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
 * Deserialize cached response data
 */
export function deserializeResponse(data: {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}): Response {
  const headers = new Headers(data.headers);
  // Add cache hit header
  headers.set("X-Cache", "HIT");

  return new Response(data.body, {
    status: data.status,
    statusText: data.statusText,
    headers,
  });
}

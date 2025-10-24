import { readdir } from "fs/promises";
import { join, extname, relative } from "path";
import { requestLogger, performanceMonitor, rateLimit } from "./middleware";
import { createErrorResponse } from "./error-handler";
import type { HttpMethod, MethodHandler } from "../../app/types/request";
import type { CacheConfig } from "../../app/types/cache.d";
import {
  buildResponseCacheKey,
  shouldCacheResponse,
  serializeResponse,
  deserializeResponse,
  wrapCacheEntry,
  getCacheEntryState,
  type CachedResponseEntry,
} from "../cache/cache-key";
import { cache } from "../cache";
import { cacheWarmingCoordinator } from "../cache/warming-coordinator";
import { applyOptimalHeaders, getDefaultStaticHeaders } from "../utils/headers";

// Cache environment variables
const IS_DEVELOPMENT = process.env.NODE_ENV !== "production";
const VERBOSE_MODE = globalThis.VERBOSE_MODE || false;
const THEME = process.env.THEME || "default";
const API_RATE_LIMIT = parseInt(process.env.API_RATE_LIMIT || "100");
const RESPONSE_CACHE_ENABLED =
  process.env.RESPONSE_CACHE_ENABLED !== "false" && process.env.NODE_ENV === "production";

export interface RouteHandler {
  Controller: new (req: Request) => { handle(): Promise<Response> } & { methods?: string[] };
}

export interface Route {
  path: string;
  ControllerClass: new (req: Request) => { handle(): Promise<Response> };
  methods: string[];
}

/**
 * Optimized route index for O(1) method lookup
 */
export interface RouteIndex {
  staticRoutes: Map<string, Map<string, Route>>; // method -> path -> route
  dynamicRoutes: Array<{ route: Route; pathParts: string[] }>; // routes with params
}

/**
 * Build an optimized route index from discovered routes
 */
export function buildRouteIndex(routes: Route[]): RouteIndex {
  const staticRoutes = new Map<string, Map<string, Route>>();
  const dynamicRoutes: Array<{ route: Route; pathParts: string[] }> = [];

  for (const route of routes) {
    const pathParts = route.path.split("/").filter(Boolean);
    const hasDynamicParams = pathParts.some(part => part.startsWith(":"));

    if (hasDynamicParams || route.path === "/") {
      // Dynamic route - keep for pattern matching
      dynamicRoutes.push({ route, pathParts });
    } else {
      // Static route - index by method and path
      for (const method of route.methods) {
        if (!staticRoutes.has(method)) {
          staticRoutes.set(method, new Map());
        }
        staticRoutes.get(method)!.set(route.path, route);
      }
    }
  }

  return { staticRoutes, dynamicRoutes };
}

/**
 * Recursively discovers all route files in the specified directory
 * @param dir - The directory to scan for routes
 * @param baseUrl - The base URL path for the current directory
 * @returns Array of discovered routes
 */
export async function discoverRoutes(dir: string = "./app/routes", baseUrl: string = ""): Promise<Route[]> {
  const routes: Route[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subRoutes = await discoverRoutes(fullPath, `${baseUrl}/${entry.name}`);
        routes.push(...subRoutes);
      } else if (entry.isFile() && (extname(entry.name) === ".ts" || extname(entry.name) === ".js")) {
        // Import the route handler
        try {
          const absolutePath = `file://${process.cwd()}/${relative(".", fullPath)}`;
          const module = await import(absolutePath);
                    // Convert file path to URL path
          let routePath = baseUrl;
          const fileName = entry.name.replace(/\.(ts|js)$/, "");

          if (fileName === "index") {
            // index files map to the directory path
            routePath = baseUrl || "/";
          } else {
            routePath = `${baseUrl}/${fileName}`;
          }

          // Handle dynamic routes [param] syntax
          routePath = routePath.replace(/\[([^\]]+)\]/g, ":$1");

          // Clean up the path
          routePath = routePath.replace(/\/+/g, "/");
          if (routePath !== "/" && routePath.endsWith("/")) {
            routePath = routePath.slice(0, -1);
          }

          // Check if module exports a Controller class
          if (module.Controller) {
            // Auto-detect supported methods from the controller prototype
            let methods = module.Controller.methods;

            if (!methods) {
              // If no static methods defined, detect from prototype
              methods = [];
              const prototype = module.Controller.prototype;
              const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];

              for (const method of httpMethods) {
                if (typeof prototype[method] === 'function') {
                  methods.push(method.toUpperCase());
                }
              }

              // If no HTTP methods found and has handle method, default to GET
              if (methods.length === 0 && typeof prototype.handle === 'function') {
                methods = ["GET"];
              }
            }

            routes.push({
              path: routePath,
              ControllerClass: module.Controller,
              methods: methods
            });
          } else {
            console.warn(`Route ${fullPath} does not export a Controller class`);
          }
        } catch (error) {
          console.warn(`Failed to import route ${fullPath}:`, error);
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to read directory ${dir}:`, error);
  }

  return routes;
}

/**
 * Matches a request path and method to a discovered route (optimized)
 * @param index - Pre-built route index
 * @param pathname - The request pathname
 * @param method - The HTTP method
 * @returns Matched route and extracted parameters, or null if no match
 */
export function matchRoute(index: RouteIndex, pathname: string, method: string): { route: Route; params: Record<string, string> } | null {
  // First, try O(1) lookup for static routes
  const methodMap = index.staticRoutes.get(method);
  if (methodMap) {
    const staticRoute = methodMap.get(pathname);
    if (staticRoute) {
      return { route: staticRoute, params: {} };
    }
  }

  // Then check dynamic routes (cached path parts)
  const pathParts = pathname.split("/").filter(Boolean);

  for (const { route, pathParts: routeParts } of index.dynamicRoutes) {
    // Check if this route supports the HTTP method
    if (!route.methods.includes(method)) {
      continue;
    }

    // Special case for root path
    if (route.path === "/" && pathname === "/") {
      return { route, params: {} };
    }

    // Length must match
    if (routeParts.length !== pathParts.length) {
      continue;
    }

    const params: Record<string, string> = {};
    let matches = true;

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const pathPart = pathParts[i];

      if (!routePart || !pathPart) {
        matches = false;
        break;
      }

      if (routePart.startsWith(":")) {
        // Dynamic parameter
        params[routePart.slice(1)] = pathPart;
      } else if (routePart !== pathPart) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return { route, params };
    }
  }

  return null;
}

/**
 * Handles the incoming request by matching it to a route and instantiating the controller
 * @param index - Pre-built route index
 * @param req - The incoming request
 * @returns Response from the matched controller
 */
export async function handleRequest(index: RouteIndex, req: Request): Promise<Response> {
  // Parse URL once and attach to request
  const url = new URL(req.url);
  req.parsedUrl = url;

  // Serve static assets with theme support and fallback
  // Try theme-specific files first, then fall back to default theme
  if (url.pathname.startsWith("/static/") || url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico)$/i)) {
    try {
      let filePath: string;

      if (url.pathname.startsWith("/static/")) {
        // Direct /static/ requests
        filePath = `.${url.pathname}`;
      } else {
        // Asset requests (CSS, JS, images) - check theme directories
        // Try theme-specific directory first
        const themeFilePath = `./templates/${THEME}/static${url.pathname}`;
        const themeFile = Bun.file(themeFilePath);

        if (await themeFile.exists()) {
          const response = new Response(themeFile);
          return applyOptimalHeaders(response, getDefaultStaticHeaders());
        }

        // Fall back to default theme
        const defaultFilePath = `./templates/default/static${url.pathname}`;
        const defaultFile = Bun.file(defaultFilePath);

        if (await defaultFile.exists()) {
          const response = new Response(defaultFile);
          return applyOptimalHeaders(response, getDefaultStaticHeaders());
        }

        // Fall back to legacy ./static directory for backward compatibility
        filePath = `./static${url.pathname}`;
      }

      const file = Bun.file(filePath);
      if (await file.exists()) {
        const response = new Response(file);
        return applyOptimalHeaders(response, getDefaultStaticHeaders());
      }
    } catch (error) {
      // File doesn't exist or error reading, continue to 404
    }
  }

  // Start request logging
  const logCompletion = requestLogger(req);

  // Start performance monitoring
  const addPerformanceHeaders = performanceMonitor(req);

  // Check rate limiting for API routes
  if (url.pathname.startsWith("/api")) {
    const rateLimitResponse = rateLimit(req, API_RATE_LIMIT);
    if (rateLimitResponse) {
      logCompletion(rateLimitResponse.status);
      return addPerformanceHeaders(rateLimitResponse);
    }
  }

  const match = matchRoute(index, url.pathname, req.method);

  if (!match) {
    // Use the error handler for 404
    const notFoundResponse = await createErrorResponse(
      req,
      404,
      `The page "${url.pathname}" could not be found.`,
      {
        path: url.pathname,
        method: req.method,
      }
    );
    logCompletion(404);
    return addPerformanceHeaders(notFoundResponse);
  }  const { route, params } = match;

  // Add params to request for easy access (now properly typed via request.d.ts)
  req.params = params;

  // Check response cache if enabled and controller has cache config
  const cacheConfig = (route.ControllerClass as any).cacheConfig as CacheConfig | undefined;
  let cacheKey: string | null = null;
  let isCacheHit = false;

  if (RESPONSE_CACHE_ENABLED && cacheConfig && req.method === "GET") {
    // Check if we should skip caching
    const shouldSkip = cacheConfig.skipIf ? cacheConfig.skipIf(req) : false;
    const hasNoCacheHeader = req.headers.get("cache-control") === "no-cache";

    if (!shouldSkip && !hasNoCacheHeader) {
      cacheKey = buildResponseCacheKey(req, cacheConfig, params);
      const cachedEntry = await cache.get<CachedResponseEntry>(cacheKey);

      if (cachedEntry) {
        const { state, age } = getCacheEntryState(cachedEntry);

        // Track visit for proactive cache warming (don't await)
        trackCacheAccess(cacheKey, cachedEntry).catch((error) => {
          console.error("Cache access tracking failed:", error);
        });

        if (state === "fresh") {
          // Fresh cache: serve immediately
          const response = deserializeResponse(cachedEntry.data, "fresh");
          isCacheHit = true;
          logCompletion(response.status, isCacheHit);
          return addPerformanceHeaders(response);
        } else if (state === "stale") {
          // Stale cache: serve immediately + revalidate in background
          const response = deserializeResponse(cachedEntry.data, "stale");
          isCacheHit = true;

          // Trigger background revalidation (don't await)
          revalidateInBackground(cacheKey, route, req, cacheConfig).catch((error) => {
            console.error("Background revalidation failed:", error);
          });

          logCompletion(response.status, isCacheHit);
          return addPerformanceHeaders(response);
        }
        // If expired, fall through to fetch fresh (blocking)
      }
    }
  }

  try {
    // Instantiate the controller and call its handle method
    const controller = new route.ControllerClass(req);
    const response = await controller.handle();

    // Cache the response if applicable
    if (RESPONSE_CACHE_ENABLED && cacheConfig && cacheKey && req.method === "GET") {
      // Only cache successful responses
      if (response.status >= 200 && response.status < 300 && shouldCacheResponse(response)) {
        const ttl =
          cacheConfig.ttl || parseInt(process.env.RESPONSE_CACHE_DEFAULT_TTL || "60", 10);
        const swr = cacheConfig.staleWhileRevalidate;

        // Clone response before reading body
        const responseClone = response.clone();
        const serialized = await serializeResponse(responseClone);

        // Wrap with cache metadata for SWR
        const cacheEntry = wrapCacheEntry(serialized, cacheConfig);

        // Add cache control headers
        const headers = new Headers(response.headers);
        headers.set("X-Cache", "MISS");
        if (cacheConfig.private) {
          headers.set("Cache-Control", `private, max-age=${ttl}`);
        } else {
          const cacheControl = swr
            ? `public, max-age=${ttl}, stale-while-revalidate=${swr}`
            : `public, max-age=${ttl}`;
          headers.set("Cache-Control", cacheControl);
        }

        // Store in cache with extended TTL (ttl + swr) so stale entries remain available
        const cacheTTL = swr ? ttl + swr : ttl;
        await cache.set(cacheKey, cacheEntry, cacheTTL);

        // Return response with updated headers
        const finalResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });

        logCompletion(finalResponse.status, isCacheHit);
        return addPerformanceHeaders(finalResponse);
      }
    }

    // Log completion with status
    logCompletion(response.status, isCacheHit);

    // Add performance headers
    return addPerformanceHeaders(response);
  } catch (error) {
    console.error("Controller error:", error);

    // Use the error handler for 500 errors
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    const errorResponse = await createErrorResponse(
      req,
      500,
      errorMessage,
      {
        stack: error instanceof Error ? error.stack : undefined,
        path: url.pathname,
        method: req.method,
        timestamp: new Date().toISOString(),
      }
    );

    logCompletion(500);
    return addPerformanceHeaders(errorResponse);
  }
}

/**
 * Revalidate cache entry in the background
 * Uses a lock to prevent multiple simultaneous revalidations of the same key
 */
async function revalidateInBackground(
  cacheKey: string,
  route: Route,
  req: Request,
  cacheConfig: CacheConfig
): Promise<void> {
  // Lock key to prevent multiple concurrent revalidations
  const lockKey = `${cacheKey}:revalidating`;

  // Check if already revalidating
  const isLocked = await cache.get(lockKey);
  if (isLocked) {
    // Already revalidating, skip
    return;
  }

  try {
    // Set lock (10 second timeout)
    await cache.set(lockKey, true, 10);

    // Create new controller instance and fetch fresh data
    const controller = new route.ControllerClass(req);
    const freshResponse = await controller.handle();

    // Only update cache if successful
    if (freshResponse.status >= 200 && freshResponse.status < 300 && shouldCacheResponse(freshResponse)) {
      const ttl = cacheConfig.ttl || 60;
      const swr = cacheConfig.staleWhileRevalidate;

      // Serialize response
      const serialized = await serializeResponse(freshResponse);

      // Wrap with cache metadata
      const cacheEntry = wrapCacheEntry(serialized, cacheConfig);

      // Store with extended TTL
      const cacheTTL = swr ? ttl + swr : ttl;
      await cache.set(cacheKey, cacheEntry, cacheTTL);

      console.log(`[SWR] Revalidated cache key: ${cacheKey}`);
    }
  } catch (error) {
    console.error(`[SWR] Revalidation failed for ${cacheKey}:`, error);
    // Failed to revalidate, but user already got stale response
    // Could implement stale-if-error here
  } finally {
    // Release lock
    await cache.delete(lockKey);
  }
}

/**
 * Track cache access for proactive cache warming
 */
async function trackCacheAccess(
  cacheKey: string,
  entry: CachedResponseEntry
): Promise<void> {
  // Only track in production when cache warming is enabled
  if (process.env.NODE_ENV !== "production" || process.env.CACHE_WARMING_ENABLED === "false") {
    return;
  }

  try {
    // Notify coordinator about this access
    cacheWarmingCoordinator.trackAccess(cacheKey);

    // Optionally update the access count in cache metadata (can be skipped for performance)
    // entry.accessCount = (entry.accessCount || 0) + 1;
    // entry.lastAccessTime = Date.now();
    // const ttl = entry.swr ? entry.ttl + entry.swr : entry.ttl;
    // await cache.set(cacheKey, entry, ttl);
  } catch (error) {
    // Silently fail - tracking should never break the request
  }
}

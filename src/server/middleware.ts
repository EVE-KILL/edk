/**
 * Middleware utilities for request/response processing
 */

// Cache environment variables at module level
const IS_DEVELOPMENT = process.env.NODE_ENV !== "production";
const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const API_RATE_LIMIT = parseInt(process.env.API_RATE_LIMIT || "100");

/**
 * Request logger middleware
 * Logs incoming requests and response times
 */
export function requestLogger(req: Request): (status?: number, cacheHit?: boolean) => void {
  const start = Date.now();
  const { method } = req;
  const path = req.parsedUrl?.pathname || new URL(req.url).pathname;

  // Return a function to log completion (only log once with all the info)
  return (status?: number, cacheHit = false) => {
    if (LOG_LEVEL === "debug" || LOG_LEVEL === "info") {
      const duration = Date.now() - start;
      const statusColor = getStatusColor(status || 200);
      const statusText = status ? `${status}` : "---";
      const timestamp = new Date().toISOString().split('T')[1]?.split('.')[0] || "";
      const cacheStatus = cacheHit ? "\x1b[35m[CACHE HIT]\x1b[0m " : ""; // Magenta for cache hit

      console.log(`[${timestamp}] ${method.padEnd(7)} ${path} ${cacheStatus}${statusColor}${statusText}\x1b[0m ${duration}ms`);
    }
  };
}

/**
 * Get ANSI color code for status code
 */
function getStatusColor(status: number): string {
  if (status >= 500) return "\x1b[31m"; // Red
  if (status >= 400) return "\x1b[33m"; // Yellow
  if (status >= 300) return "\x1b[36m"; // Cyan
  if (status >= 200) return "\x1b[32m"; // Green
  return "\x1b[37m"; // White
}

/**
 * Performance monitoring middleware
 * Adds timing information to responses
 */
export function performanceMonitor(req: Request): (response: Response) => Response {
  const start = Date.now();

  return (response: Response) => {
    const duration = Date.now() - start;

    // Clone response and add timing header
    const headers = new Headers(response.headers);
    headers.set("X-Response-Time", `${duration}ms`);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  };
}

/**
 * Simple rate limiting (in-memory)
 * For production, use Redis or similar
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Background cleanup of expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

export function rateLimit(req: Request, limit: number = 100, windowMs: number = 60000): Response | null {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const now = Date.now();

  // Get or create rate limit entry
  let entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    // Reset the window
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(ip, entry);
  }

  entry.count++;

  // Check if limit exceeded
  if (entry.count > limit) {
    const resetIn = Math.ceil((entry.resetAt - now) / 1000);
    return new Response(
      JSON.stringify({
        error: "Too many requests",
        message: `Rate limit exceeded. Try again in ${resetIn} seconds.`,
        retryAfter: resetIn
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": resetIn.toString(),
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": entry.resetAt.toString()
        }
      }
    );
  }

  return null; // No rate limit response, continue
}

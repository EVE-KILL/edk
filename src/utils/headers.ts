/**
 * HTTP Header Management Utilities
 *
 * Provides optimal headers for:
 * - CDN/Edge caching (Cloudflare, etc.)
 * - Browser performance (preconnect, preload, dns-prefetch)
 * - Security headers
 * - Performance optimization
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const CDN_ENABLED = process.env.CDN_ENABLED !== "false" && IS_PRODUCTION;

export interface HeaderOptions {
  /**
   * Cache control settings
   */
  cacheControl?: {
    maxAge?: number;
    sMaxAge?: number; // CDN cache time
    staleWhileRevalidate?: number;
    staleIfError?: number;
    public?: boolean;
    private?: boolean;
    noCache?: boolean;
    noStore?: boolean;
    mustRevalidate?: boolean;
  };

  /**
   * Resource hints for browser optimization
   */
  preconnect?: string[]; // URLs to preconnect
  dnsPrefetch?: string[]; // URLs to DNS prefetch
  preload?: Array<{
    href: string;
    as: "script" | "style" | "image" | "font" | "fetch";
    type?: string;
    crossorigin?: "anonymous" | "use-credentials";
  }>;

  /**
   * Security headers
   */
  security?: {
    contentSecurityPolicy?: string;
    strictTransportSecurity?: boolean;
    xFrameOptions?: "DENY" | "SAMEORIGIN" | string;
    xContentTypeOptions?: boolean;
    referrerPolicy?: string;
  };

  /**
   * Performance headers
   */
  performance?: {
    serverTiming?: boolean; // Include Server-Timing header
  };

  /**
   * Custom headers to add/override
   */
  custom?: Record<string, string>;
}

/**
 * Default security headers for all responses
 */
const DEFAULT_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

/**
 * Default resource hints for EVE Kill
 */
const DEFAULT_PRECONNECT = [
  "https://images.eve-kill.com", // EVE Online image server
  "https://esi.evetech.net", // ESI API
];

const DEFAULT_DNS_PREFETCH = [
  "https://images.eve-kill.com",
  "https://esi.evetech.net",
];

/**
 * Build Cache-Control header value
 */
export function buildCacheControl(options: HeaderOptions["cacheControl"] = {}): string {
  const directives: string[] = [];

  // Visibility
  if (options.public && !options.private) {
    directives.push("public");
  } else if (options.private) {
    directives.push("private");
  }

  // No-cache/no-store
  if (options.noStore) {
    directives.push("no-store");
    return directives.join(", "); // no-store overrides everything else
  }
  if (options.noCache) {
    directives.push("no-cache");
  }

  // Max ages
  if (options.maxAge !== undefined) {
    directives.push(`max-age=${options.maxAge}`);
  }
  if (options.sMaxAge !== undefined && CDN_ENABLED) {
    directives.push(`s-maxage=${options.sMaxAge}`);
  }

  // Stale directives
  if (options.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }
  if (options.staleIfError !== undefined) {
    directives.push(`stale-if-error=${options.staleIfError}`);
  }

  // Revalidation
  if (options.mustRevalidate) {
    directives.push("must-revalidate");
  }

  return directives.join(", ");
}

/**
 * Build Link header for resource hints
 */
export function buildLinkHeader(options: HeaderOptions): string {
  const links: string[] = [];

  // Preconnect
  const preconnectUrls = options.preconnect || DEFAULT_PRECONNECT;
  for (const url of preconnectUrls) {
    links.push(`<${url}>; rel=preconnect; crossorigin`);
  }

  // DNS Prefetch
  const dnsPrefetchUrls = options.dnsPrefetch || DEFAULT_DNS_PREFETCH;
  for (const url of dnsPrefetchUrls) {
    links.push(`<${url}>; rel=dns-prefetch`);
  }

  // Preload
  if (options.preload) {
    for (const resource of options.preload) {
      let link = `<${resource.href}>; rel=preload; as=${resource.as}`;
      if (resource.type) {
        link += `; type=${resource.type}`;
      }
      if (resource.crossorigin) {
        link += `; crossorigin=${resource.crossorigin}`;
      }
      links.push(link);
    }
  }

  return links.join(", ");
}

/**
 * Build Server-Timing header from performance stats
 */
export function buildServerTiming(stats: {
  duration?: number;
  queries?: number;
  queryTime?: number;
  cached?: boolean;
}): string {
  const timings: string[] = [];

  if (stats.duration !== undefined) {
    timings.push(`total;dur=${stats.duration.toFixed(2)}`);
  }
  if (stats.queries !== undefined) {
    timings.push(`db;desc="queries";dur=${stats.queryTime?.toFixed(2) || 0}`);
  }
  if (stats.cached) {
    timings.push(`cache;desc="hit"`);
  }

  return timings.join(", ");
}

/**
 * Apply optimal headers to a Response
 */
export function applyOptimalHeaders(
  response: Response,
  options: HeaderOptions = {}
): Response {
  const headers = new Headers(response.headers);

  // Security headers (always apply in production)
  if (IS_PRODUCTION) {
    for (const [key, value] of Object.entries(DEFAULT_SECURITY_HEADERS)) {
      if (!headers.has(key)) {
        headers.set(key, value);
      }
    }

    // Custom security options
    if (options.security) {
      if (options.security.contentSecurityPolicy) {
        headers.set("Content-Security-Policy", options.security.contentSecurityPolicy);
      }
      if (options.security.strictTransportSecurity) {
        headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
      }
      if (options.security.xFrameOptions) {
        headers.set("X-Frame-Options", options.security.xFrameOptions);
      }
      if (options.security.xContentTypeOptions !== false) {
        headers.set("X-Content-Type-Options", "nosniff");
      }
      if (options.security.referrerPolicy) {
        headers.set("Referrer-Policy", options.security.referrerPolicy);
      }
    }
  }

  // Cache-Control header
  if (options.cacheControl) {
    const cacheControl = buildCacheControl(options.cacheControl);
    if (cacheControl) {
      headers.set("Cache-Control", cacheControl);
    }
  }

  // CDN-specific headers
  if (CDN_ENABLED) {
    // Cloudflare-specific headers
    if (options.cacheControl?.public && options.cacheControl?.maxAge) {
      // Tell Cloudflare to cache this
      headers.set("CDN-Cache-Control", buildCacheControl({
        public: true,
        maxAge: options.cacheControl.sMaxAge || options.cacheControl.maxAge,
        staleWhileRevalidate: options.cacheControl.staleWhileRevalidate,
      }));
    }
  }

  // Resource hints via Link header
  const linkHeader = buildLinkHeader(options);
  if (linkHeader) {
    headers.set("Link", linkHeader);
  }

  // Performance headers
  if (options.performance?.serverTiming && response.headers.has("X-Response-Time")) {
    const responseTime = parseFloat(response.headers.get("X-Response-Time") || "0");
    const cached = response.headers.get("X-Cache")?.includes("HIT");
    headers.set("Server-Timing", buildServerTiming({
      duration: responseTime,
      cached: !!cached,
    }));
  }

  // Custom headers
  if (options.custom) {
    for (const [key, value] of Object.entries(options.custom)) {
      headers.set(key, value);
    }
  }

  // Vary header - important for CDN caching
  if (!headers.has("Vary")) {
    headers.set("Vary", "Accept-Encoding");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Get default header options for HTML pages
 */
export function getDefaultHtmlHeaders(cacheTime?: number): HeaderOptions {
  return {
    cacheControl: cacheTime
      ? {
          public: true,
          maxAge: cacheTime,
          sMaxAge: cacheTime * 2, // CDN can cache longer
          staleWhileRevalidate: cacheTime,
        }
      : {
          private: true,
          noCache: true,
        },
    preconnect: DEFAULT_PRECONNECT,
    dnsPrefetch: DEFAULT_DNS_PREFETCH,
    // No preload for edk.css - it's inlined as critical CSS in the template
    preload: [],
    security: {
      strictTransportSecurity: IS_PRODUCTION,
    },
    performance: {
      serverTiming: true,
    },
  };
}

/**
 * Get default header options for API responses
 */
export function getDefaultApiHeaders(cacheTime?: number): HeaderOptions {
  return {
    cacheControl: cacheTime
      ? {
          public: true,
          maxAge: cacheTime,
          sMaxAge: cacheTime * 2, // CDN can cache longer
          staleWhileRevalidate: cacheTime,
        }
      : {
          private: true,
          noCache: true,
        },
    security: {
      strictTransportSecurity: IS_PRODUCTION,
    },
    performance: {
      serverTiming: true,
    },
    custom: {
      "Content-Type": "application/json",
    },
  };
}

/**
 * Get default header options for static assets
 */
export function getDefaultStaticHeaders(): HeaderOptions {
  return {
    cacheControl: {
      public: true,
      maxAge: 86400, // 24 hours browser
      sMaxAge: 2592000, // 30 days CDN
      staleWhileRevalidate: 86400,
    },
    security: {
      strictTransportSecurity: IS_PRODUCTION,
    },
  };
}

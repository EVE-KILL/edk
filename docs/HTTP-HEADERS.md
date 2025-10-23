# HTTP Headers Optimization

EVE Kill v4 implements comprehensive HTTP header optimization for performance, caching, and security.

## Overview

The header system provides:
- **CDN/Edge Caching** - Optimized for Cloudflare and other CDNs
- **Browser Performance** - Resource hints (preconnect, dns-prefetch, preload)
- **Security Headers** - Protection against common web vulnerabilities
- **Server Timing** - Performance metrics exposed to browser DevTools

## Architecture

### Core Files

- **`/src/utils/headers.ts`** - Header utilities and builders
- **`/src/controllers/base-controller.ts`** - Base controller with header support
- **`/src/controllers/web-controller.ts`** - HTML pages with default headers
- **`/src/controllers/api-controller.ts`** - API endpoints with default headers

### Automatic Defaults

Controllers automatically receive optimal headers based on their type:

- **Web Pages** - Security headers, resource hints, CDN caching
- **API Endpoints** - CORS, CDN caching, Server-Timing
- **Static Assets** - Long-term caching with stale-while-revalidate

## Header Types

### 1. Cache Control

Cache headers for browser and CDN optimization:

```typescript
cacheControl: {
  public: true,              // Cacheable by CDN
  maxAge: 300,               // Browser cache: 5 minutes
  sMaxAge: 600,              // CDN cache: 10 minutes (longer than browser)
  staleWhileRevalidate: 300, // Serve stale while fetching fresh
  staleIfError: 3600,        // Serve stale if backend down
  mustRevalidate: false,     // Don't force revalidation
}
```

**Production Only**: Cache headers only applied when `NODE_ENV=production`

**CDN Integration**: Automatically includes `CDN-Cache-Control` header for Cloudflare

### 2. Resource Hints

Performance optimization via Link header:

```typescript
preconnect: [
  "https://images.eve-kill.com",
  "https://esi.evetech.net",
],
dnsPrefetch: [
  "https://images.eve-kill.com",
],
preload: [
  {
    href: "/static/edk.css",
    as: "style",
  },
  {
    href: "/static/app.js",
    as: "script",
  },
],
```

**Benefits**:
- `preconnect` - Browser establishes connection early (DNS + TCP + TLS)
- `dns-prefetch` - Browser resolves DNS early (DNS only)
- `preload` - Browser downloads critical resources immediately

### 3. Security Headers

Protection against common attacks:

```typescript
security: {
  strictTransportSecurity: true,  // HSTS: force HTTPS
  xFrameOptions: "SAMEORIGIN",    // Prevent clickjacking
  xContentTypeOptions: true,      // Prevent MIME sniffing
  referrerPolicy: "strict-origin-when-cross-origin",
  contentSecurityPolicy: "...",   // Optional CSP
}
```

**Default Security Headers** (always applied in production):
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

### 4. Performance Headers

Server metrics for debugging:

```typescript
performance: {
  serverTiming: true,  // Include Server-Timing header
}
```

Server-Timing header includes:
- Total request duration
- Database query count and time
- Cache hit/miss status

Visible in browser DevTools → Network → Timing tab

## Usage

### Web Pages (Automatic)

All `WebController` pages get default headers automatically:

```typescript
export class Controller extends WebController {
  override async get(): Promise<Response> {
    // Default headers already applied:
    // - Security headers
    // - Resource hints (preconnect to ESI/images)
    // - CSS preload
    // - Server timing

    return this.render("pages/home", data);
  }
}
```

### API Endpoints (Automatic)

All `ApiController` endpoints get default headers automatically:

```typescript
export class Controller extends ApiController {
  override async get(): Promise<Response> {
    // Default headers already applied:
    // - CORS headers
    // - Security headers
    // - Server timing

    return this.json(data);
  }
}
```

### Custom Headers

Override or extend default headers:

```typescript
export class Controller extends WebController {
  override async get(): Promise<Response> {
    // Add custom preload for page-specific resources
    this.mergeHeaderOptions({
      preload: [
        {
          href: "/static/killmail-viewer.js",
          as: "script",
        },
      ],
    });

    return this.render("pages/killmail", data);
  }
}
```

### Complete Override

Replace all default headers:

```typescript
export class Controller extends WebController {
  override async get(): Promise<Response> {
    // Completely replace header options
    this.setHeaderOptions({
      cacheControl: {
        public: true,
        maxAge: 3600,
        staleWhileRevalidate: 7200,
      },
      preconnect: ["https://custom-cdn.example.com"],
      security: {
        strictTransportSecurity: true,
        contentSecurityPolicy: "default-src 'self'",
      },
    });

    return this.render("pages/custom", data);
  }
}
```

### Static Files (Automatic)

Static assets get optimal caching automatically:

```
GET /static/edk.css
Cache-Control: public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400
```

**Static Asset Strategy**:
- Browser: 24 hours
- CDN: 30 days
- Stale-while-revalidate: 24 hours

## Environment Variables

### `NODE_ENV`

Controls header behavior:

- `production` - Full headers (caching, security, CDN)
- `development` - Minimal headers (no caching)

### `CDN_ENABLED`

Enable/disable CDN-specific headers:

```bash
CDN_ENABLED=true  # Enable CDN headers (default in production)
CDN_ENABLED=false # Disable CDN headers
```

When enabled:
- Adds `CDN-Cache-Control` header
- Includes `s-maxage` directive
- Optimizes for edge caching

## Best Practices

### 1. Cache Times by Content Type

| Content Type | Browser Cache | CDN Cache | SWR |
|-------------|---------------|-----------|-----|
| Homepage | 30s | 60s | 60s |
| Entity pages | 60s | 120s | 120s |
| Killmail detail | 600s (10m) | 1200s (20m) | 3600s (1h) |
| API lists | 30s | 60s | 60s |
| API details | 120s | 240s | 300s |
| Static assets | 86400s (24h) | 2592000s (30d) | 86400s (24h) |

### 2. Resource Hints

**Always preconnect** to external domains used on every page:
```typescript
preconnect: [
  "https://images.eve-kill.com",  // Character/corp/alliance images
  "https://esi.evetech.net",     // ESI API calls
]
```

**Preload critical resources** needed for initial render:
```typescript
preload: [
  { href: "/static/edk.css", as: "style" },           // Main stylesheet
  { href: "/static/fonts/main.woff2", as: "font" },  // Primary font
]
```

**Don't preload** non-critical resources (images, deferred scripts)

### 3. Security Headers

**Always enable HSTS** in production:
```typescript
security: {
  strictTransportSecurity: true, // Enables HSTS
}
```

**Use CSP for sensitive pages**:
```typescript
security: {
  contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'",
}
```

### 4. CDN Caching

**Set CDN cache longer than browser**:
```typescript
cacheControl: {
  maxAge: 60,      // Browser: 1 minute
  sMaxAge: 300,    // CDN: 5 minutes
}
```

Why? CDN invalidation is easier than forcing browser revalidation.

**Use stale-while-revalidate** for better performance:
```typescript
cacheControl: {
  maxAge: 60,
  staleWhileRevalidate: 120, // Serve stale up to 2 minutes old
}
```

## Testing

### 1. Check Headers

```bash
# Check HTML page headers
curl -I https://eve-kill.com/

# Check API headers
curl -I https://eve-kill.com/api/killlist

# Check static asset headers
curl -I https://eve-kill.com/static/edk.css
```

### 2. Verify Resource Hints

Look for `Link` header:
```
Link: <https://images.eve-kill.com>; rel=preconnect; crossorigin,
      <https://esi.evetech.net>; rel=preconnect; crossorigin,
      </static/edk.css>; rel=preload; as=style
```

### 3. Verify Server-Timing

Open browser DevTools:
1. Network tab
2. Select any request
3. Timing tab → Server Timing

Should show:
- `total` - Total request time
- `db` - Database query time
- `cache` - Cache hit status

### 4. Test Cloudflare Caching

```bash
# First request (cache miss)
curl -I https://eve-kill.com/ | grep -i cf-cache-status
# CF-Cache-Status: MISS

# Second request (cache hit)
curl -I https://eve-kill.com/ | grep -i cf-cache-status
# CF-Cache-Status: HIT
```

## Troubleshooting

### Headers Not Applied

**Check environment**:
```bash
echo $NODE_ENV
# Should be "production" for full headers
```

**Check response**:
```typescript
// In controller:
console.log("Header options:", this.headerOptions);
```

### CDN Not Caching

**Check CDN headers**:
```bash
curl -I https://eve-kill.com/ | grep -i cache-control
# Should include s-maxage and public
```

**Check Vary header**:
```
Vary: Accept-Encoding
```
Without proper Vary, CDN may serve wrong cached version.

### Resource Hints Not Working

**Check Link header syntax**:
```
# Correct
Link: <https://images.eve-kill.com>; rel=preconnect; crossorigin

# Wrong
Link: https://images.eve-kill.com; rel=preconnect
```

**Check browser support**:
- Preconnect: All modern browsers
- DNS-prefetch: All browsers
- Preload: Chrome 50+, Firefox 85+, Safari 11.1+

### Server-Timing Not Showing

**Check header exists**:
```bash
curl -I https://eve-kill.com/ | grep -i server-timing
```

**Enable in controller**:
```typescript
this.setHeaderOptions({
  performance: {
    serverTiming: true,
  },
});
```

## Performance Impact

### Resource Hints

**Preconnect savings**:
- DNS: ~20-120ms
- TCP: ~20-100ms
- TLS: ~50-200ms
- **Total: 90-420ms saved** on first request to domain

**Preload savings**:
- Critical CSS: ~50-200ms earlier render
- Critical JS: ~100-500ms earlier interactive

### CDN Caching

**With CDN caching**:
- Origin requests: -95% (only revalidation)
- Response time: ~20-50ms (vs ~150ms origin)
- Origin bandwidth: -95%

**Without CDN caching**:
- Every request hits origin
- Full database queries
- Higher latency for distant users

### Stale-While-Revalidate

**During stale period**:
- User sees response immediately (~2ms from cache)
- Background revalidation happens async
- No user-perceived latency increase

**During fresh period**:
- Normal cache hit (~2ms)

**After expiry**:
- Full fetch (~150ms)
- Repopulates cache

## Migration Guide

If you have existing controllers without header optimization:

### Before
```typescript
export class Controller extends WebController {
  override async get(): Promise<Response> {
    this.setHeader("Cache-Control", "public, max-age=300");
    return this.render("pages/home", data);
  }
}
```

### After
```typescript
export class Controller extends WebController {
  // Headers automatically applied!
  // No changes needed for basic usage

  override async get(): Promise<Response> {
    return this.render("pages/home", data);
  }
}
```

### Custom Headers
```typescript
export class Controller extends WebController {
  override async get(): Promise<Response> {
    // Extend defaults if needed
    this.mergeHeaderOptions({
      preload: [
        { href: "/static/custom.js", as: "script" },
      ],
    });

    return this.render("pages/custom", data);
  }
}
```

## References

- [MDN: HTTP Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- [MDN: Resource Hints](https://developer.mozilla.org/en-US/docs/Web/Performance/dns-prefetch)
- [Cloudflare: Cache-Control](https://developers.cloudflare.com/cache/about/cache-control/)
- [Web.dev: HSTS](https://web.dev/security-headers/)
- [Server-Timing Spec](https://www.w3.org/TR/server-timing/)

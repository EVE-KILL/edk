# Response Caching

EDK implements automatic HTTP response caching to improve performance and reduce database load.

## How It Works

The router automatically caches GET responses when:
1. `NODE_ENV === "production"` (caching disabled in development by default)
2. `RESPONSE_CACHE_ENABLED !== "false"` (can be explicitly disabled)
3. Controller has a `static cacheConfig` property
4. Response status is 2xx (successful)

## Enabling Caching

### In Development

By default, caching is **disabled in development**. To enable it for testing:

```bash
# Using fish shell
env NODE_ENV=production RESPONSE_CACHE_ENABLED=true bun run dev

# Or set for the session
set -x NODE_ENV production
set -x RESPONSE_CACHE_ENABLED true
bun run dev
```

### In Production

Caching is **automatically enabled** when `NODE_ENV=production`. You can disable it with:

```bash
RESPONSE_CACHE_ENABLED=false
```

## Configuring Cache per Route

Add a `static cacheConfig` property to your controller:

```typescript
export class Controller extends WebController {
  static cacheConfig = {
    ttl: 60,              // Cache for 60 seconds
    vary: ["page", "id"], // Vary cache by query param 'page' and route param 'id'
  };

  override async handle(): Promise<Response> {
    // Your route logic...
  }
}
```

### Cache Configuration Options

```typescript
interface CacheConfig {
  /**
   * Time to live in seconds (default: 60)
   * How long to cache the response
   */
  ttl?: number;

  /**
   * Vary cache by request properties
   * - Route params: "id", "characterId", etc.
   * - Query params: "page", "limit", "filter", etc.
   * - Special: "query" to include all query parameters
   */
  vary?: string[];

  /**
   * Mark as private (user-specific) cache
   * Adds Cache-Control: private header
   * Use for authenticated/user-specific content
   */
  private?: boolean;

  /**
   * Skip caching if condition is met
   * Example: skipIf: (req) => req.headers.get("x-no-cache") === "true"
   */
  skipIf?: (req: Request) => boolean;

  /**
   * Custom cache key generator
   * Example: key: (req) => `custom:${req.url}`
   */
  key?: string | ((req: Request) => string);
}
```

## Cache Key Generation

Cache keys are automatically built from:

1. **HTTP Method**: GET, POST, etc.
2. **Pathname**: `/`, `/alliance/123/kills`, etc.
3. **Route Parameters**: From `vary` array (e.g., `:id` from `/alliance/:id`)
4. **Query Parameters**: From `vary` array (e.g., `?page=2` when vary includes "page")
5. **User ID**: If `private: true` (when auth is implemented)

### Examples

```typescript
// Homepage with pagination
static cacheConfig = {
  ttl: 60,
  vary: ["page"],
};
// Cache keys:
// - route:GET:/ (page 1)
// - route:GET:/:page=2 (page 2)
// - route:GET:/:page=3 (page 3)

// Alliance kills page
static cacheConfig = {
  ttl: 120,
  vary: ["id", "page"],
};
// Cache keys:
// - route:GET:/alliance/123/kills:id=123 (page 1)
// - route:GET:/alliance/123/kills:id=123:page=2 (page 2)
// - route:GET:/alliance/456/kills:id=456 (different alliance)

// Include all query params
static cacheConfig = {
  ttl: 60,
  vary: ["query"],
};
// Cache key includes full query string:
// - route:GET:/api/killlist:?limit=20&characterId=123
```

## Current Cache Settings

### Web Pages

| Route | TTL | Vary By | Notes |
|-------|-----|---------|-------|
| `/` (Home) | 60s | page | Homepage with pagination |
| `/entities` | 60s | - | Followed entities dashboard |
| `/alliance/:id` | 300s | id | Alliance detail page |
| `/alliance/:id/kills` | 120s | id, page | Alliance kills with pagination |
| `/alliance/:id/losses` | 120s | id, page | Alliance losses with pagination |
| `/character/:id` | 300s | id | Character detail page |
| `/corporation/:id` | 300s | id | Corporation detail page |

### API Endpoints

| Route | TTL | Vary By | Notes |
|-------|-----|---------|-------|
| `/api/killlist` | 60s | limit, page, before, characterId, corporationId, allianceId, killsOnly, lossesOnly | Killmail list API |
| `/api/killmails/:id` | 300s | id | Individual killmail |
| `/api/characters/:id` | 300s | id | Character info |
| `/api/corporations/:id` | 300s | id | Corporation info |
| `/api/alliances/:id` | 300s | id | Alliance info |

## Verifying Cache

### Check Response Headers

```bash
# First request (cache miss)
curl -i 'http://localhost:3000/' | grep -E 'X-Cache|Cache-Control'
# X-Cache: MISS
# Cache-Control: public, max-age=60

# Second request within TTL (cache hit)
curl -i 'http://localhost:3000/' | grep -E 'X-Cache|Cache-Control'
# X-Cache: HIT
# Cache-Control: public, max-age=60
```

### Test Different Pages

```bash
# These should have different cache keys
curl -i 'http://localhost:3000/?page=1'
curl -i 'http://localhost:3000/?page=2'
curl -i 'http://localhost:3000/?page=3'
```

## Cache Invalidation

Currently, cache entries expire after their TTL. Future improvements:

1. **Tag-based invalidation**: Clear related cache entries when data changes
   ```typescript
   static cacheConfig = {
     ttl: 300,
     tags: ["killmails", "alliance:123"],
   };
   ```

2. **Manual invalidation**: Clear specific cache keys or patterns
   ```typescript
   await cache.delete("route:GET:/alliance/123/kills:id=123");
   ```

3. **Event-based invalidation**: Automatically clear cache when killmails are processed
   ```typescript
   // After processing killmail
   await invalidateCache({ tags: ["killmails"] });
   ```

## Environment Variables

```bash
# Enable/disable caching
RESPONSE_CACHE_ENABLED=true          # Enable (default in production)
RESPONSE_CACHE_ENABLED=false         # Disable

# Default TTL for routes without explicit config
RESPONSE_CACHE_DEFAULT_TTL=60        # Default: 60 seconds

# Maximum response size to cache
CACHE_MAX_RESPONSE_SIZE=1048576      # Default: 1MB
```

## Performance Impact

Caching can significantly reduce:
- **Database queries**: Cached responses don't hit the database
- **Template rendering**: HTML is served from cache
- **Response times**: Sub-millisecond for cache hits vs 50-200ms for database queries

Example metrics:
- Uncached homepage: ~150ms (database + templates)
- Cached homepage: ~2ms (cache lookup)
- **75x faster** with cache hit

## Best Practices

1. **Use shorter TTLs for frequently changing data**
   - Homepage, recent kills: 60s
   - Entity pages: 120-300s

2. **Always vary by pagination parameters**
   ```typescript
   vary: ["page", "limit"]
   ```

3. **Vary by filter parameters**
   ```typescript
   vary: ["characterId", "corporationId", "killsOnly"]
   ```

4. **Use `private: true` for user-specific content**
   ```typescript
   static cacheConfig = {
     ttl: 60,
     private: true, // Don't cache in shared proxies
   };
   ```

5. **Skip caching for admin/debug requests**
   ```typescript
   static cacheConfig = {
     ttl: 60,
     skipIf: (req) => req.headers.get("x-no-cache") === "true",
   };
   ```

## Troubleshooting

### Cache Not Working

1. Check `NODE_ENV` is set to `production`
2. Verify `RESPONSE_CACHE_ENABLED` is not `"false"`
3. Ensure controller has `static cacheConfig`
4. Check response status is 2xx
5. Verify request method is GET

### Wrong Content Being Cached

1. Check `vary` array includes all relevant parameters
2. Use `vary: ["query"]` to include all query parameters
3. Test cache keys: Enable debug logging to see generated keys

### Cache Not Clearing

1. Wait for TTL to expire
2. Restart server to clear in-memory cache
3. Check cache backend (Redis) if using persistent cache

## Future Enhancements

- [ ] Tag-based cache invalidation
- [ ] Automatic invalidation on write operations
- [ ] Cache warming (pre-populate frequently accessed routes)
- [ ] Cache statistics and monitoring
- [ ] Conditional requests (ETag/Last-Modified)
- [ ] Stale-while-revalidate pattern

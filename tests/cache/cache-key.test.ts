import { describe, test, expect } from "bun:test";
import { buildResponseCacheKey, buildDataCacheKey } from "../../src/cache/cache-key";
import type { CacheConfig } from "../../app/types/cache.d";

describe("Cache Key Generation", () => {
  test("should build basic response cache key", () => {
    const req = new Request("http://localhost:3000/api/test");
    const config: CacheConfig = {};

    const key = buildResponseCacheKey(req, config);
    expect(key).toBe("route:GET:/api/test");
  });

  test("should include route parameters in cache key", () => {
    const req = new Request("http://localhost:3000/api/killmails/12345");
    const config: CacheConfig = {
      vary: ["id"],
    };
    const params = { id: "12345" };

    const key = buildResponseCacheKey(req, config, params);
    expect(key).toBe("route:GET:/api/killmails/12345:id=12345");
  });

  test("should include query parameters when varying by query", () => {
    const req = new Request("http://localhost:3000/api/search?q=raven&page=2");
    const config: CacheConfig = {
      vary: ["query"],
    };

    const key = buildResponseCacheKey(req, config);
    expect(key).toBe("route:GET:/api/search:?q=raven&page=2");
  });

  test("should use custom key generator function", () => {
    const req = new Request("http://localhost:3000/api/test");
    const config: CacheConfig = {
      key: (req) => `custom:${req.method}:${new URL(req.url).pathname}`,
    };

    const key = buildResponseCacheKey(req, config);
    expect(key).toBe("custom:GET:/api/test");
  });

  test("should use static custom key string", () => {
    const req = new Request("http://localhost:3000/api/test");
    const config: CacheConfig = {
      key: "static-cache-key",
    };

    const key = buildResponseCacheKey(req, config);
    expect(key).toBe("static-cache-key");
  });

  test("should build data cache keys", () => {
    const key = buildDataCacheKey("killmail", 12345);
    expect(key).toBe("data:killmail:12345");

    const complexKey = buildDataCacheKey("user", 123, "profile", "settings");
    expect(key).toBe("data:killmail:12345");
  });

  test("should handle different HTTP methods", () => {
    const getReq = new Request("http://localhost:3000/api/test", { method: "GET" });
    const postReq = new Request("http://localhost:3000/api/test", { method: "POST" });
    const config: CacheConfig = {};

    const getKey = buildResponseCacheKey(getReq, config);
    const postKey = buildResponseCacheKey(postReq, config);

    expect(getKey).toBe("route:GET:/api/test");
    expect(postKey).toBe("route:POST:/api/test");
  });
});

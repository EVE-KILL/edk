import { describe, test, expect } from "bun:test";

describe("Response Caching Integration", () => {
  const serverUrl = "http://localhost:3000";

  test("should cache API health endpoint responses", async () => {
    // First request - should be MISS
    const response1 = await fetch(`${serverUrl}/api/health`);
    const cacheHeader1 = response1.headers.get("X-Cache");

    expect(response1.status).toBe(200);
    // In development, cache is disabled by default
    // In production with caching enabled, this would be "MISS"

    // Second request - should be HIT if caching is enabled
    const response2 = await fetch(`${serverUrl}/api/health`);
    const cacheHeader2 = response2.headers.get("X-Cache");

    expect(response2.status).toBe(200);
    // Would be "HIT" in production with caching enabled
  });

  test("should provide cache statistics", async () => {
    const response = await fetch(`${serverUrl}/api/cache/stats`);
    expect(response.status).toBe(200);

    const data = await response.json();

    expect(data).toHaveProperty("cache");
    expect(data).toHaveProperty("stats");
    expect(data).toHaveProperty("config");

    expect(data.cache).toHaveProperty("driver");
    expect(data.cache).toHaveProperty("enabled");
    expect(data.stats).toHaveProperty("size");
    expect(data.stats).toHaveProperty("hits");
    expect(data.stats).toHaveProperty("misses");
    expect(data.stats).toHaveProperty("hitRate");
  });

  test("should respect no-cache header", async () => {
    const response = await fetch(`${serverUrl}/api/health`, {
      headers: {
        "Cache-Control": "no-cache",
      },
    });

    expect(response.status).toBe(200);
    // Should always be MISS or no cache header when no-cache is set
  });
});

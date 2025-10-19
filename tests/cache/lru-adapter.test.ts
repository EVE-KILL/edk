import { describe, test, expect, beforeEach } from "bun:test";
import { LRUCacheAdapter } from "../../app/utils/cache/lru-adapter";

describe("LRU Cache Adapter", () => {
  let cache: LRUCacheAdapter;

  beforeEach(() => {
    cache = new LRUCacheAdapter({
      maxSize: 10,
      maxMemory: 1, // 1 MB
      ttl: 60, // 60 seconds
    });
  });

  test("should store and retrieve values", async () => {
    await cache.set("test-key", "test-value");
    const value = await cache.get<string>("test-key");
    expect(value).toBe("test-value");
  });

  test("should return null for non-existent keys", async () => {
    const value = await cache.get("non-existent");
    expect(value).toBeNull();
  });

  test("should check if key exists", async () => {
    await cache.set("test-key", "test-value");
    expect(await cache.has("test-key")).toBe(true);
    expect(await cache.has("non-existent")).toBe(false);
  });

  test("should delete keys", async () => {
    await cache.set("test-key", "test-value");
    const deleted = await cache.delete("test-key");
    expect(deleted).toBe(true);
    expect(await cache.has("test-key")).toBe(false);
  });

  test("should clear all entries", async () => {
    await cache.set("key1", "value1");
    await cache.set("key2", "value2");
    await cache.clear();
    expect(await cache.size()).toBe(0);
  });

  test("should track cache hits and misses", async () => {
    await cache.set("key", "value");

    await cache.get("key"); // hit
    await cache.get("key"); // hit
    await cache.get("missing"); // miss

    const stats = await cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeGreaterThan(0);
  });

  test("should respect TTL", async () => {
    const shortLivedCache = new LRUCacheAdapter({
      maxSize: 10,
      ttl: 1, // 1 second
    });

    await shortLivedCache.set("key", "value");
    const value = await shortLivedCache.get("key");
    expect(value).toBe("value");

    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 1100));

    const expiredValue = await shortLivedCache.get("key");
    expect(expiredValue).toBeNull();
  });

  test("should store complex objects", async () => {
    const complexObject = {
      id: 123,
      name: "Test",
      nested: {
        value: "deep",
        array: [1, 2, 3],
      },
    };

    await cache.set("complex", complexObject);
    const retrieved = await cache.get<typeof complexObject>("complex");

    expect(retrieved).toEqual(complexObject);
  });

  test("should override TTL per key", async () => {
    await cache.set("short-lived", "value", 1); // 1 second TTL
    const value = await cache.get("short-lived");
    expect(value).toBe("value");

    await new Promise(resolve => setTimeout(resolve, 1100));
    const expiredValue = await cache.get("short-lived");
    expect(expiredValue).toBeNull();
  });
});

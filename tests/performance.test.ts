import { describe, test, expect, beforeEach, afterEach } from "bun:test";

describe("Performance Tests", () => {
  let serverUrl: string;

  beforeEach(() => {
    serverUrl = "http://localhost:3000";
  });

  test("should handle static asset requests quickly", async () => {
    const start = performance.now();
    const response = await fetch(`${serverUrl}/static/.keep`);
    const duration = performance.now() - start;

    // Static file serving should be fast (< 50ms)
    expect(duration).toBeLessThan(50);
    // .keep files return 204 No Content (empty file)
    expect(response.status).toBe(204);
  });

  test("should match routes efficiently", async () => {
    const start = performance.now();
    const response = await fetch(`${serverUrl}/`);
    const duration = performance.now() - start;

    // Route matching + rendering should be reasonable (< 100ms in dev)
    expect(duration).toBeLessThan(100);
    expect(response.status).toBe(200);
  });

  test("should handle API requests efficiently", async () => {
    const start = performance.now();
    const response = await fetch(`${serverUrl}/api/health`);
    const duration = performance.now() - start;

    // API requests should be very fast (< 50ms)
    expect(duration).toBeLessThan(50);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe("ok");
  });

  test("should include performance headers", async () => {
    const response = await fetch(`${serverUrl}/`);

    // Should have the X-Response-Time header
    expect(response.headers.has("X-Response-Time")).toBe(true);

    const responseTime = response.headers.get("X-Response-Time");
    expect(responseTime).toMatch(/\d+ms/);
  });

  test("should handle 404 errors efficiently", async () => {
    const start = performance.now();
    const response = await fetch(`${serverUrl}/nonexistent-route`);
    const duration = performance.now() - start;

    // 404 handling should also be fast
    expect(duration).toBeLessThan(100);
    expect(response.status).toBe(404);
  });
});

import { describe, test, expect } from "bun:test";
import { performanceMonitor } from "../src/server/middleware";

describe("Middleware", () => {
  test("performanceMonitor should add X-Response-Time header", async () => {
    const mockRequest = new Request("http://localhost:3000/test");

    // Create a mock response
    const originalResponse = new Response("test body", {
      status: 200,
      headers: { "Content-Type": "text/plain" }
    });

    // Apply performance monitor
    const addPerformanceHeaders = performanceMonitor(mockRequest);

    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 10));

    const enhancedResponse = addPerformanceHeaders(originalResponse);

    // Check if header was added
    expect(enhancedResponse.headers.has("X-Response-Time")).toBe(true);

    const responseTime = enhancedResponse.headers.get("X-Response-Time");
    expect(responseTime).toMatch(/\d+ms/);

    // Verify response is still valid
    expect(enhancedResponse.status).toBe(200);
    expect(await enhancedResponse.text()).toBe("test body");
  });

  test("requestLogger should return completion function", () => {
    const mockRequest = new Request("http://localhost:3000/test");

    // Parse and attach URL (simulating router behavior)
    (mockRequest as any).parsedUrl = new URL(mockRequest.url);

    const logCompletion = require("../src/server/middleware").requestLogger(mockRequest);

    expect(typeof logCompletion).toBe("function");

    // Should not throw when called
    expect(() => logCompletion(200)).not.toThrow();
    expect(() => logCompletion(404)).not.toThrow();
    expect(() => logCompletion(500)).not.toThrow();
  });
});

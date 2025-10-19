import { describe, test, expect } from "bun:test";
import { buildRouteIndex, matchRoute, Route } from "../app/utils/router";

describe("Route Matching", () => {
  test("should match static routes using O(1) lookup", () => {
    const routes: Route[] = [
      {
        path: "/",
        ControllerClass: class {} as any,
        methods: ["GET"]
      },
      {
        path: "/api/health",
        ControllerClass: class {} as any,
        methods: ["GET"]
      },
      {
        path: "/users",
        ControllerClass: class {} as any,
        methods: ["GET", "POST"]
      }
    ];

    const index = buildRouteIndex(routes);

    // Test root route
    const rootMatch = matchRoute(index, "/", "GET");
    expect(rootMatch).not.toBeNull();
    expect(rootMatch?.route.path).toBe("/");

    // Test static API route
    const healthMatch = matchRoute(index, "/api/health", "GET");
    expect(healthMatch).not.toBeNull();
    expect(healthMatch?.route.path).toBe("/api/health");

    // Test method-specific matching
    const usersGetMatch = matchRoute(index, "/users", "GET");
    expect(usersGetMatch).not.toBeNull();

    const usersPostMatch = matchRoute(index, "/users", "POST");
    expect(usersPostMatch).not.toBeNull();

    // Test wrong method
    const usersPutMatch = matchRoute(index, "/users", "PUT");
    expect(usersPutMatch).toBeNull();
  });

  test("should match dynamic routes and extract parameters", () => {
    const routes: Route[] = [
      {
        path: "/users/:id",
        ControllerClass: class {} as any,
        methods: ["GET"]
      },
      {
        path: "/posts/:postId/comments/:commentId",
        ControllerClass: class {} as any,
        methods: ["GET"]
      }
    ];

    const index = buildRouteIndex(routes);

    // Test single parameter
    const userMatch = matchRoute(index, "/users/123", "GET");
    expect(userMatch).not.toBeNull();
    expect(userMatch?.params.id).toBe("123");

    // Test multiple parameters
    const commentMatch = matchRoute(index, "/posts/456/comments/789", "GET");
    expect(commentMatch).not.toBeNull();
    expect(commentMatch?.params.postId).toBe("456");
    expect(commentMatch?.params.commentId).toBe("789");
  });

  test("should return null for non-existent routes", () => {
    const routes: Route[] = [
      {
        path: "/users",
        ControllerClass: class {} as any,
        methods: ["GET"]
      }
    ];

    const index = buildRouteIndex(routes);

    const match = matchRoute(index, "/nonexistent", "GET");
    expect(match).toBeNull();
  });

  test("should handle route index correctly", () => {
    const routes: Route[] = [
      {
        path: "/static-route",
        ControllerClass: class {} as any,
        methods: ["GET"]
      },
      {
        path: "/dynamic/:id",
        ControllerClass: class {} as any,
        methods: ["GET"]
      }
    ];

    const index = buildRouteIndex(routes);

    // Static routes should be in the staticRoutes map
    expect(index.staticRoutes.get("GET")?.has("/static-route")).toBe(true);

    // Dynamic routes should be in the dynamicRoutes array
    expect(index.dynamicRoutes.length).toBe(1);
    expect(index.dynamicRoutes[0].route.path).toBe("/dynamic/:id");
  });
});

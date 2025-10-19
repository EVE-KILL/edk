import { readdir } from "fs/promises";
import { join, extname, relative } from "path";

export interface RouteHandler {
  default?: (req: Request) => Response | Promise<Response>;
  GET?: (req: Request) => Response | Promise<Response>;
  POST?: (req: Request) => Response | Promise<Response>;
  PUT?: (req: Request) => Response | Promise<Response>;
  DELETE?: (req: Request) => Response | Promise<Response>;
  PATCH?: (req: Request) => Response | Promise<Response>;
}

export interface Route {
  path: string;
  handler: RouteHandler;
  methods: string[];
}

/**
 * Recursively discovers all route files in the specified directory
 * @param dir - The directory to scan for routes
 * @param baseUrl - The base URL path for the current directory
 * @returns Array of discovered routes
 */
export async function discoverRoutes(dir: string = "./app/routes", baseUrl: string = ""): Promise<Route[]> {
  const routes: Route[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subRoutes = await discoverRoutes(fullPath, `${baseUrl}/${entry.name}`);
        routes.push(...subRoutes);
      } else if (entry.isFile() && (extname(entry.name) === ".ts" || extname(entry.name) === ".js")) {
        // Import the route handler
        try {
          const absolutePath = `file://${process.cwd()}/${relative(".", fullPath)}`;
          const module = await import(absolutePath);
                    // Convert file path to URL path
          let routePath = baseUrl;
          const fileName = entry.name.replace(/\.(ts|js)$/, "");

          if (fileName === "index") {
            // index files map to the directory path
            routePath = baseUrl || "/";
          } else {
            routePath = `${baseUrl}/${fileName}`;
          }

          // Handle dynamic routes [param] syntax
          routePath = routePath.replace(/\[([^\]]+)\]/g, ":$1");

          // Clean up the path
          routePath = routePath.replace(/\/+/g, "/");
          if (routePath !== "/" && routePath.endsWith("/")) {
            routePath = routePath.slice(0, -1);
          }

          // Determine available methods
          const methods: string[] = [];
          if (module.default) methods.push("ALL");
          if (module.GET) methods.push("GET");
          if (module.POST) methods.push("POST");
          if (module.PUT) methods.push("PUT");
          if (module.DELETE) methods.push("DELETE");
          if (module.PATCH) methods.push("PATCH");

          if (methods.length > 0) {
            routes.push({
              path: routePath,
              handler: module,
              methods
            });
          }
        } catch (error) {
          console.warn(`Failed to import route ${fullPath}:`, error);
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to read directory ${dir}:`, error);
  }

  return routes;
}

/**
 * Matches a request path and method to a discovered route
 * @param routes - Array of discovered routes
 * @param pathname - The request pathname
 * @param method - The HTTP method
 * @returns Matched route and extracted parameters, or null if no match
 */
export function matchRoute(routes: Route[], pathname: string, method: string): { route: Route; params: Record<string, string> } | null {
  for (const route of routes) {
    if (!route.methods.includes("ALL") && !route.methods.includes(method)) {
      continue;
    }

    const params: Record<string, string> = {};
    const routeParts = route.path.split("/").filter(Boolean);
    const pathParts = pathname.split("/").filter(Boolean);

    if (route.path === "/" && pathname === "/") {
      return { route, params };
    }

    if (routeParts.length !== pathParts.length) {
      continue;
    }

    let matches = true;
    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const pathPart = pathParts[i];

      if (routePart && pathPart) {
        if (routePart.startsWith(":")) {
          // Dynamic parameter
          params[routePart.slice(1)] = pathPart;
        } else if (routePart !== pathPart) {
          matches = false;
          break;
        }
      } else {
        matches = false;
        break;
      }
    }

    if (matches) {
      return { route, params };
    }
  }

  return null;
}

/**
 * Handles the incoming request by matching it to a route and calling the appropriate handler
 * @param routes - Array of discovered routes
 * @param req - The incoming request
 * @returns Response from the matched route handler
 */
export async function handleRequest(routes: Route[], req: Request): Promise<Response> {
  const url = new URL(req.url);
  const match = matchRoute(routes, url.pathname, req.method);

  if (!match) {
    return new Response("Not Found", { status: 404 });
  }

  const { route, params } = match;

  // Add params to request for easy access
  (req as any).params = params;

  // Call the appropriate handler
  if (route.handler[req.method as keyof RouteHandler]) {
    return await route.handler[req.method as keyof RouteHandler]!(req);
  } else if (route.handler.default) {
    return await route.handler.default(req);
  }

  return new Response("Method Not Allowed", { status: 405 });
}

import { serve } from "bun";
import { watch } from "fs/promises";

// Declare global VERBOSE_MODE
declare global {
  var VERBOSE_MODE: boolean;
}

/**
 * Parse command-line arguments FIRST before any imports
 */
function parseArgs(): { verbose: boolean } {
  // In Bun, process.argv[0] is the bun executable, argv[1] is the script
  // Anything after that is the actual arguments
  const args = process.argv.slice(2);
  return {
    verbose: args.includes("-v") || args.includes("--verbose"),
  };
}

// Set verbose flag as global BEFORE importing any modules that use it
const cliArgs = parseArgs();
globalThis.VERBOSE_MODE = cliArgs.verbose;

// Dynamic imports to ensure VERBOSE_MODE is set first
let discoverRoutes: any;
let buildRouteIndex: any;
let handleRequest: any;
let registerHelpers: any;
let registerPartials: any;
let clearTemplateCache: any;
let db: any;
let cache: any;
let logger: any;

// Initialize imports
async function loadModules() {
  const routerModule = await import("./src/server/router");
  discoverRoutes = routerModule.discoverRoutes;
  buildRouteIndex = routerModule.buildRouteIndex;
  handleRequest = routerModule.handleRequest;

  const templatesModule = await import("./src/server/templates");
  registerHelpers = templatesModule.registerHelpers;
  registerPartials = templatesModule.registerPartials;
  clearTemplateCache = templatesModule.clearTemplateCache;

  const dbModule = await import("./src/db");
  db = dbModule.db;

  const cacheModule = await import("./src/cache");
  cache = cacheModule.cache;

  const loggerModule = await import("./src/utils/logger");
  logger = loggerModule.logger;

  if (cliArgs.verbose) {
    logger.info("🔍 Verbose mode enabled");
  }
}

/**
 * EVE Kill v4 - Bun server with automatic route injection
 */
async function startServer() {
  await loadModules();

  registerHelpers();
  await registerPartials();

  const routes = await discoverRoutes();

  logger.info("⚡ Building route index...");
  const routeIndex = buildRouteIndex(routes);

  const port = parseInt(process.env.PORT || "3000");
  const isDevelopment = process.env.NODE_ENV !== "production";

  const server = serve({
    port,
    fetch: (req) => handleRequest(routeIndex, req),
  });

  logger.server(`Server running on http://localhost:${port}`);
  logger.info(`Environment: ${isDevelopment ? "development" : "production"}`);

  if (isDevelopment) {
    const watcher = watch("./templates", {
      recursive: true,
      persistent: true,
    });

    (async () => {
      for await (const event of watcher) {
        clearTemplateCache();
        await registerPartials();

        logger.success("✅ Templates reloaded");
      }
    })();
  }

  return server;
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.warn("\n🛑 SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.warn("\n🛑 SIGINT received, shutting down gracefully...");
  process.exit(0);
});

startServer().catch((err) => logger.error(err instanceof Error ? err.message : String(err)));

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
let webSocketManager: any;

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

  const webSocketModule = await import("./src/server/websocket");
  webSocketManager = webSocketModule.webSocketManager;

  if (cliArgs.verbose) {
    logger.info("🔍 Verbose mode enabled");
  }
}

/**
 * Start the management server (for internal event communication)
 */
async function startManagementServer() {
  const managementModule = await import("./src/server/management");
  const port = parseInt(process.env.MANAGEMENT_API_PORT || "3001");
  await managementModule.startManagementServer(port);
}

/**
 * EDK - Bun server with automatic route injection
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
    fetch: (req, server) => {
      // Check for WebSocket upgrade
      if (webSocketManager.shouldUpgrade(req, server)) {
        return undefined; // WebSocket handler takes over
      }
      // Normal HTTP request
      return handleRequest(routeIndex, req);
    },
    websocket: {
      message: (ws: any, message: string | ArrayBuffer | Uint8Array) =>
        webSocketManager.handleMessage(ws, message),
      open: (ws: any) => webSocketManager.handleOpen(ws),
      close: (ws: any, code: number, reason: string) =>
        webSocketManager.handleClose(ws, code, reason),
    },
  });

  logger.server(`Server running on http://localhost:${port}`);
  logger.info(`Environment: ${isDevelopment ? "development" : "production"}`);

  // Start management API server for internal event communication
  await startManagementServer();

  if (isDevelopment) {
    // Watch both template and static files for changes
    const templateWatcher = watch("./templates", {
      recursive: true,
      persistent: true,
    });

    (async () => {
      for await (const event of templateWatcher) {
        const eventPath = event.filename || "";
        
        // Only reload templates if template files changed
        if (eventPath.endsWith(".hbs")) {
          clearTemplateCache();
          await registerPartials();
          logger.success("✅ Templates reloaded");
        } 
        // For static files, just log (browser will fetch updated files)
        else if (eventPath.includes("/static/")) {
          logger.success("✅ Static file updated");
        }
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

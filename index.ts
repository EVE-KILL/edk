import { serve } from "bun";
import { watch } from "fs/promises";
import { discoverRoutes, buildRouteIndex, handleRequest } from "./app/utils/router";
import { registerHelpers, registerPartials, clearTemplateCache } from "./app/utils/templates";
import { queueManager } from "./app/queue";
import { logger } from "./app/utils/logger";

/**
 * EVE Kill v4 - Bun server with automatic route injection
 */
async function startServer() {
  // Register Handlebars helpers and partials
  registerHelpers();
  await registerPartials();

  logger.info("🔍 Discovering routes...");
  const routes = await discoverRoutes();

  logger.info("📋 Discovered routes:");
  routes.forEach(route => {
    logger.info(`  ${route.methods.join(", ").padEnd(12)} ${route.path}`);
  });

  // Build optimized route index
  logger.info("⚡ Building route index...");
  const routeIndex = buildRouteIndex(routes);

  // Start queue manager (if enabled)
  const queueEnabled = process.env.QUEUE_ENABLED !== "false"; // Default: enabled
  if (queueEnabled) {
    logger.loading("Starting queue manager...");
    await queueManager.start();
  }

  const port = parseInt(process.env.PORT || "3000");
  const isDevelopment = process.env.NODE_ENV !== "production";

  const server = serve({
    port,
    fetch: (req) => handleRequest(routeIndex, req),
  });

  logger.server(`Server running on http://localhost:${port}`);
  logger.info(`📦 Environment: ${isDevelopment ? "development" : "production"}`);
  if (queueEnabled) {
    logger.success("Queue manager: running");
  }

  // Hot reload for templates in development
  if (isDevelopment) {
    const watcher = watch("./templates", {
      recursive: true,
      persistent: true,
    });

    logger.info("🔥 Hot reload enabled for templates");

    (async () => {
      for await (const event of watcher) {
        logger.info(`🔄 Template changed: ${event.filename}, reloading...`);

        // Clear the template cache
        clearTemplateCache();

        // Re-register partials to pick up changes
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
  await queueManager.stop();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.warn("\n🛑 SIGINT received, shutting down gracefully...");
  await queueManager.stop();
  process.exit(0);
});

startServer().catch(logger.error);

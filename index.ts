import { serve } from "bun";
import { discoverRoutes, buildRouteIndex, handleRequest } from "./app/utils/router";
import { registerHelpers } from "./app/utils/templates";
import { queueManager } from "./app/queue";

/**
 * EVE Kill v4 - Bun server with automatic route injection
 */
async function startServer() {
  // Register Handlebars helpers
  registerHelpers();

  console.log("🔍 Discovering routes...");
  const routes = await discoverRoutes();

  console.log("📋 Discovered routes:");
  routes.forEach(route => {
    console.log(`  ${route.methods.join(", ").padEnd(12)} ${route.path}`);
  });

  // Build optimized route index
  console.log("⚡ Building route index...");
  const routeIndex = buildRouteIndex(routes);

  // Start queue manager (if enabled)
  const queueEnabled = process.env.QUEUE_ENABLED !== "false"; // Default: enabled
  if (queueEnabled) {
    console.log("🔄 Starting queue manager...");
    await queueManager.start();
  }

  const port = parseInt(process.env.PORT || "3000");
  const isDevelopment = process.env.NODE_ENV !== "production";

  serve({
    port,
    development: {
        hmr: process.env.NODE_ENV !== "production" ? true : false,
        console: process.env.NODE_ENV !== "production" ? true : false
    },
    fetch: (req) => handleRequest(routeIndex, req),
  });

  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📦 Environment: ${isDevelopment ? "development" : "production"}`);
  if (queueEnabled) {
    console.log(`🔄 Queue manager: running`);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("\n🛑 SIGTERM received, shutting down gracefully...");
  await queueManager.stop();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("\n🛑 SIGINT received, shutting down gracefully...");
  await queueManager.stop();
  process.exit(0);
});

startServer().catch(console.error);

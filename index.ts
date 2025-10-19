import { serve } from "bun";
import { discoverRoutes, handleRequest } from "./app/utils/router";

/**
 * EVE Kill v4 - Bun server with automatic route injection
 */
async function startServer() {
  console.log("🔍 Discovering routes...");
  const routes = await discoverRoutes();

  console.log("📋 Discovered routes:");
  routes.forEach(route => {
    console.log(`  ${route.methods.join(", ").padEnd(12)} ${route.path}`);
  });

  serve({
    port: 3000,
    development: process.env.NODE_ENV !== "production",
    fetch: (req) => handleRequest(routes, req),
  });

  console.log("🚀 Server running on http://localhost:3000");
}

startServer().catch(console.error);

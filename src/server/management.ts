import { serve } from "bun";
import { logger } from "../utils/logger";
import { webSocketManager } from "./websocket";

/**
 * Management Server
 *
 * Internal-only HTTP server that receives events from queue workers
 * and other background processes, then broadcasts them to WebSocket clients.
 *
 * Runs on a separate port (default 3001) and only accepts localhost connections.
 */

interface EventPayload {
  type: string;
  data: any;
}

export async function startManagementServer(port: number = 3001): Promise<void> {
  const server = serve({
    port,
    hostname: "127.0.0.1", // Only listen on localhost
    fetch: async (req) => handleManagementRequest(req),
  });

  logger.server(`🔧 Management API running on http://127.0.0.1:${port}`);
}

/**
 * Handle management API requests
 */
async function handleManagementRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method.toUpperCase();

  // Only POST /events endpoint
  if (method !== "POST" || url.pathname !== "/events") {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Parse JSON body
    const payload = await req.json() as EventPayload;

    // Validate payload
    if (!payload.type) {
      return new Response(JSON.stringify({ error: "Missing 'type' field" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (globalThis.VERBOSE_MODE) {
      logger.debug(`[Management] Received event: ${payload.type}`);
    }

    // Broadcast to WebSocket clients
    webSocketManager.broadcast(payload.type, payload.data || {});

    // Return success
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error(`[Management] Error processing event:`, error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}

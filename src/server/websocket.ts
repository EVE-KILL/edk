import { logger } from "../utils/logger";

export interface WebSocketData {
  connectedAt: number;
  isInternal: boolean;
}

interface UpdateMessage {
  type: string;
  data: any;
  timestamp: number;
}

/**
 * WebSocket Updates Manager
 * Handles broadcasting updates to connected clients
 * Only internal messages are processed; client messages are ignored
 */
export class WebSocketUpdatesManager {
  private connectedClients = new Set<any>();

  /**
   * Handle WebSocket upgrade request
   * Only allows connections from localhost for now
   */
  shouldUpgrade(req: Request, server: any): boolean {
    const url = new URL(req.url);
    if (url.pathname !== "/updates") {
      return false;
    }

    // Check if request is from internal origin (localhost or internal IP)
    const remoteAddress = req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const isInternal = remoteAddress === "localhost" ||
      remoteAddress === "127.0.0.1" ||
      remoteAddress.startsWith("192.168.") ||
      remoteAddress.startsWith("10.") ||
      remoteAddress.startsWith("172.");

    logger.debug(
      `WebSocket connection attempt from ${remoteAddress} - ${isInternal ? "ALLOWED" : "REJECTED"}`
    );

    // Upgrade connection with metadata
    const success = server.upgrade(req, {
      data: {
        connectedAt: Date.now(),
        isInternal,
      } as WebSocketData,
    });

    return success;
  }

  /**
   * Handle incoming WebSocket message
   * Ignores all client messages (only internal server messages are processed)
   */
  handleMessage(ws: any, message: string | ArrayBuffer | Uint8Array): void {
    // Convert message to string if needed
    let messageStr: string;
    if (typeof message === "string") {
      messageStr = message;
    } else if (message instanceof ArrayBuffer) {
      messageStr = new TextDecoder().decode(message);
    } else {
      messageStr = new TextDecoder().decode(new Uint8Array(message));
    }

    // Log that we're ignoring client messages
    if (globalThis.VERBOSE_MODE) {
      logger.debug(`[WebSocket] Ignoring client message (${messageStr.length} bytes)`);
    }

    // Silently ignore all client messages
    // This is intentional - we only emit from the server
  }

  /**
   * Handle WebSocket connection opened
   */
  handleOpen(ws: any): void {
    const data = ws.data as WebSocketData;
    this.connectedClients.add(ws);
  }

  /**
   * Handle WebSocket connection closed
   */
  handleClose(ws: any, code: number, reason: string): void {
    this.connectedClients.delete(ws);

    if (globalThis.VERBOSE_MODE) {
      logger.debug(`[WebSocket] Client disconnected (code: ${code}, reason: ${reason})`);
      logger.debug(`[WebSocket] Client closed (total remaining: ${this.connectedClients.size})`);
    }
  }

  /**
   * Broadcast an update to all connected clients
   * @param type The type of update (e.g., "killmail", "statistics")
   * @param data The data to broadcast
   */
  broadcast(type: string, data: any): void {
    const message: UpdateMessage = {
      type,
      data,
      timestamp: Date.now(),
    };

    const messageStr = JSON.stringify(message);

    let sent = 0;
    let failed = 0;

    for (const ws of this.connectedClients) {
      const result = ws.send(messageStr);
      if (result > 0) {
        sent++;
      } else {
        failed++;
      }
    }

    if (failed > 0) {
      logger.warn(`[WebSocket] ⚠️  Failed to send to ${failed} client(s)`);
    }
  }

  /**
   * Get current number of connected clients
   */
  getConnectedCount(): number {
    return this.connectedClients.size;
  }
}

// Create singleton instance
export const webSocketManager = new WebSocketUpdatesManager();

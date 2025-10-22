import { webSocketManager } from "../server/websocket";
import { logger } from "../utils/logger";

export interface EntityUpdate {
  entityType: "character" | "corporation" | "alliance" | "type" | "system" | "region";
  id: number;
  name: string;
  [key: string]: any;
}

/**
 * Broadcast an entity update to all connected WebSocket clients
 * This allows frontends to replace "Unknown" placeholders with actual names
 * when entity data becomes available
 */
export function broadcastEntityUpdate(update: EntityUpdate): void {
  try {
    logger.info(`[EntityBroadcast.broadcastEntityUpdate] CALLED with: type=${update.entityType}, id=${update.id}, name=${update.name}`);

    const messageData = {
      entityType: update.entityType,
      id: update.id,
      name: update.name,
      timestamp: new Date().toISOString(),
    };

    logger.info(`[EntityBroadcast.broadcastEntityUpdate] MESSAGE DATA READY: ${JSON.stringify(messageData)}`);
    logger.info(`[EntityBroadcast.broadcastEntityUpdate] CALLING webSocketManager.broadcast()`);

    webSocketManager.broadcast("entity-update", messageData);

    logger.info(`[EntityBroadcast.broadcastEntityUpdate] ✅ webSocketManager.broadcast() returned - COMPLETE`);
    logger.info(`[EntityBroadcast] 📡 Broadcast ${update.entityType}:${update.id} = "${update.name}"`);
  } catch (error) {
    logger.error("[EntityBroadcast] ❌ Failed to broadcast entity update:", { update, error });
  }
}

/**
 * Batch broadcast multiple entity updates
 */
export function broadcastEntityUpdates(updates: EntityUpdate[]): void {
  for (const update of updates) {
    broadcastEntityUpdate(update);
  }
}

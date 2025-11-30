#!/usr/bin/env bun
/**
 * EVE-KILL WebSocket Server
 *
 * Runs independently from the Nitro HTTP server.
 * Handles real-time killmail broadcasts via Redis pub/sub.
 *
 * Usage: bun ws.ts
 */

import type { ServerWebSocket } from 'bun';
import { randomUUID } from 'crypto';
import { createRedisClient } from './server/helpers/redis';
import { logger } from './server/helpers/logger';
import type { ClientData, WebSocketMessage } from './ws/common';
import { killmailMessageHandler } from './ws/handlers/killmails';
import { env } from './server/helpers/env';

// Server configuration
const PORT = env.WS_PORT;
const HOST = env.WS_HOST;
const PING_INTERVAL = env.WS_PING_INTERVAL; // 30 seconds
const PING_TIMEOUT = env.WS_PING_TIMEOUT; // 10 seconds
const CLEANUP_INTERVAL = env.WS_CLEANUP_INTERVAL; // 1 minute
const CLIENT_COOKIE = 'edk_ws_id';
const DIRECT_CHANNEL = 'site-direct';

type KillmailSocket = ServerWebSocket;

const clients = new Map<KillmailSocket, ClientData>();
const clientIndex = new Map<string, Set<KillmailSocket>>();
let redis: ReturnType<typeof createRedisClient>; // Subscriber client (pub/sub only)
let redisWriter: ReturnType<typeof createRedisClient>; // Writer client (for stats, etc)
let pingInterval: Timer | null = null;
let cleanupInterval: Timer | null = null;

/**
 * Setup Redis subscriber
 */
async function setupRedis(): Promise<void> {
  // Create subscriber client (for pub/sub)
  redis = createRedisClient();

  redis.on('error', (error) => {
    logger.error('Redis subscriber error:', { error });
  });

  // Create separate writer client (for normal commands like setex)
  redisWriter = createRedisClient();

  redisWriter.on('error', (error) => {
    logger.error('Redis writer error:', { error });
  });

  // Subscribe to killmails channel
  redis.subscribe('killmails', (err, count) => {
    if (err) {
      logger.error('Failed to subscribe to Redis channel:', err);
      process.exit(1);
    }
    logger.info(`Subscribed to ${count} Redis channel(s)`);
  });

  // Subscribe to direct channel for targeted events
  redis.subscribe(DIRECT_CHANNEL, (err) => {
    if (err) {
      logger.error('Failed to subscribe to direct channel:', err);
    } else {
      logger.info('Subscribed to site-direct channel');
    }
  });

  // Handle Redis messages
  redis.on('message', (channel, message) => {
    try {
      const data = JSON.parse(message);
      if (channel === 'killmails') {
        const normalizedKillmail = data.normalizedKillmail || data.data || data;
        if (normalizedKillmail) {
          broadcastKillmail(normalizedKillmail);
        }
      }
      if (channel === DIRECT_CHANNEL) {
        broadcastDirect(data);
      }
    } catch (error) {
      logger.error('Failed to process Redis message:', { error });
    }
  });
}

/**
 * Broadcast killmail to subscribed clients
 */
function broadcastKillmail(killmail: any): void {
  let sentCount = 0;
  const messageType =
    killmailMessageHandler.getMessageType?.(killmail) || 'killmail';
  const logId =
    killmailMessageHandler.getLogIdentifier?.(killmail) || 'unknown';
  const correlationId = randomUUID();

  for (const [ws, clientData] of clients.entries()) {
    if (ws.readyState === 1) {
      // OPEN
      const shouldSend =
        killmailMessageHandler.shouldSendToClient?.(killmail, clientData) ??
        false;

      if (shouldSend) {
        try {
          ws.send(
            JSON.stringify({
              type: messageType,
              data: killmail,
              _meta: {
                correlationId,
              },
            })
          );
          sentCount++;
        } catch (error) {
          logger.error('Error sending to client:', { error });
        }
      }
    }
  }

  if (sentCount > 0) {
    logger.debug(
      `Broadcasted ${messageType} ${logId} to ${sentCount}/${clients.size} clients`,
      { correlationId }
    );
  }
}

function broadcastDirect(event: any): void {
  const targetIds: string[] = Array.isArray(event?.clientIds)
    ? event.clientIds
    : event?.clientId
      ? [event.clientId]
      : [];

  // If no specific clients, broadcast to all (for dev reload events)
  if (targetIds.length === 0) {
    let sent = 0;
    for (const [ws] of clients.entries()) {
      if (ws.readyState === 1) {
        try {
          ws.send(
            JSON.stringify({ type: 'direct', data: event.data ?? event })
          );
          sent++;
        } catch (error) {
          logger.error('Error broadcasting direct event', { error });
        }
      }
    }
    if (sent > 0) {
      logger.debug(`Broadcasted direct event to all ${sent} client(s)`, {
        eventType: event.type,
      });
    }
    return;
  }

  // Targeted delivery
  let sent = 0;
  for (const id of targetIds) {
    const sockets = clientIndex.get(id);
    if (!sockets) continue;
    for (const ws of sockets) {
      if (ws.readyState === 1) {
        try {
          ws.send(
            JSON.stringify({ type: 'direct', data: event.data ?? event })
          );
          sent++;
        } catch (error) {
          logger.error('Error sending direct event', { error });
        }
      }
    }
  }

  if (sent > 0) {
    logger.debug(`Sent direct event to ${sent} socket(s)`, { targetIds });
  }
}

/**
 * Handle incoming client message
 */
function handleMessage(ws: KillmailSocket, message: string): void {
  try {
    const data: WebSocketMessage = JSON.parse(message);
    const clientData = clients.get(ws);
    if (!clientData) return;

    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      case 'pong':
        clientData.lastPong = new Date();
        logger.debug('Received pong from client', {
          clientId: clientData.clientId,
          lastPing: clientData.lastPing?.toISOString(),
          lastPong: clientData.lastPong.toISOString(),
        });
        break;

      case 'subscribe':
        if (Array.isArray(data.topics)) {
          const validTopics = data.topics.filter(
            (topic) => killmailMessageHandler.isValidTopic?.(topic) ?? false
          );
          const invalidTopics = data.topics.filter(
            (topic) => !(killmailMessageHandler.isValidTopic?.(topic) ?? false)
          );

          if (invalidTopics.length > 0) {
            ws.send(
              JSON.stringify({
                type: 'error',
                message: `Invalid topics: ${invalidTopics.join(', ')}`,
              })
            );
          }

          if (validTopics.length > 0) {
            for (const topic of validTopics) {
              if (!clientData.topics.includes(topic)) {
                clientData.topics.push(topic);
              }
            }
            ws.send(
              JSON.stringify({
                type: 'subscribed',
                topics: validTopics,
              })
            );
            logger.info(`Client subscribed to: ${validTopics.join(', ')}`);
          }
        }
        break;

      case 'unsubscribe':
        if (Array.isArray(data.topics)) {
          clientData.topics = clientData.topics.filter(
            (t) => !data.topics!.includes(t)
          );
          ws.send(
            JSON.stringify({
              type: 'unsubscribed',
              topics: data.topics,
            })
          );
          logger.info(`Client unsubscribed from: ${data.topics.join(', ')}`);
        }
        break;
    }
  } catch (error) {
    logger.error('Failed to handle message:', { error });
    ws.send(
      JSON.stringify({ type: 'error', message: 'Invalid message format' })
    );
  }
}

/**
 * Update WebSocket stats in Redis
 */
async function updateWebSocketStats(): Promise<void> {
  try {
    if (!redisWriter) {
      logger.warn('Redis writer not initialized, skipping stats update');
      return;
    }

    const stats = {
      connectedClients: clients.size,
      timestamp: Date.now(),
    };

    // Store in Redis with 10 second TTL (in case WS server crashes)
    await redisWriter.setex('ws:stats', 10, JSON.stringify(stats));
    logger.debug(`Updated WebSocket stats: ${clients.size} clients`);
  } catch (error) {
    logger.error('Failed to update WebSocket stats', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

/**
 * Send ping to all clients
 */
function sendPingToAllClients(): void {
  const now = new Date();
  let pingsSent = 0;

  for (const [ws, clientData] of clients.entries()) {
    if (ws.readyState === 1) {
      // OPEN
      try {
        ws.send(
          JSON.stringify({
            type: 'ping',
            timestamp: now.toISOString(),
          })
        );
        clientData.lastPing = now;
        pingsSent++;
      } catch (error) {
        logger.error('Error sending ping:', { error });
      }
    }
  }

  if (pingsSent > 0) {
    logger.debug(`Sent ping to ${pingsSent} client(s)`);
  }

  // Update stats after ping
  updateWebSocketStats();
}

/**
 * Cleanup unresponsive clients
 */
function cleanupUnresponsiveClients(): void {
  const now = new Date();
  const clientsToRemove: any[] = [];

  for (const [ws, clientData] of clients.entries()) {
    if (clientData.lastPing) {
      const timeSincePing = now.getTime() - clientData.lastPing.getTime();

      if (timeSincePing > PING_TIMEOUT) {
        const hasRecentPong =
          clientData.lastPong &&
          clientData.lastPong.getTime() >= clientData.lastPing.getTime();

        if (!hasRecentPong) {
          logger.info(
            `Removing unresponsive client (${timeSincePing}ms since ping)`
          );
          clientsToRemove.push(ws);
        }
      }
    }
  }

  for (const ws of clientsToRemove) {
    try {
      ws.close(1000, 'Unresponsive to ping');
    } catch {
      // Ignore errors when closing
    }
    clients.delete(ws);
  }

  if (clientsToRemove.length > 0) {
    logger.info(`Cleaned up ${clientsToRemove.length} unresponsive client(s)`);
  }

  // Update stats after cleanup
  updateWebSocketStats();
}

/**
 * Start ping/pong monitoring
 */
function startPingPongMonitoring(): void {
  pingInterval = setInterval(sendPingToAllClients, PING_INTERVAL);
  cleanupInterval = setInterval(cleanupUnresponsiveClients, CLEANUP_INTERVAL);
  logger.info(
    `Started ping/pong monitoring (interval: ${PING_INTERVAL}ms, timeout: ${PING_TIMEOUT}ms)`
  );
}

/**
 * Start Bun WebSocket server
 */
async function startServer(): Promise<void> {
  await setupRedis();

  Bun.serve({
    port: PORT,
    hostname: HOST,
    fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname === '/ws' || url.pathname === '/killmails') {
        const clientId = extractClientId(req);
        const upgraded = server.upgrade(req, {
          data: { clientId },
        });
        if (!upgraded) {
          return new Response('WebSocket upgrade failed', { status: 400 });
        }
        return undefined;
      }

      if (url.pathname === '/health') {
        return new Response(
          JSON.stringify({
            status: 'ok',
            clients: clients.size,
            uptime: process.uptime(),
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response('Not found', { status: 404 });
    },

    websocket: {
      open(ws: KillmailSocket) {
        clients.set(ws, {
          topics: ['all'], // Default subscription
          connectedAt: new Date(),
          clientId: (ws.data as any)?.clientId,
        });
        const cid = (ws.data as any)?.clientId;
        if (cid) {
          if (!clientIndex.has(cid)) clientIndex.set(cid, new Set());
          clientIndex.get(cid)!.add(ws);
        }

        ws.send(
          JSON.stringify({
            type: 'connected',
            message: 'Welcome to EVE-KILL WebSocket',
            clientId: (ws.data as any)?.clientId,
          })
        );

        logger.info(`Client connected. Total: ${clients.size}`);

        // Update stats
        updateWebSocketStats();
      },

      message(ws: KillmailSocket, message: string | ArrayBuffer | Uint8Array) {
        const text =
          typeof message === 'string'
            ? message
            : new TextDecoder().decode(message);

        logger.debug(`Received: ${text}`);
        handleMessage(ws, text);
      },

      close(ws: KillmailSocket) {
        clients.delete(ws);
        const cid = (ws.data as any)?.clientId;
        if (cid) {
          const set = clientIndex.get(cid);
          if (set) {
            set.delete(ws);
            if (set.size === 0) clientIndex.delete(cid);
          }
        }
        logger.info(`Client disconnected. Total: ${clients.size}`);

        // Update stats
        updateWebSocketStats();
      },
    },
  });

  startPingPongMonitoring();

  logger.success(`🚀 WebSocket server started on ws://${HOST}:${PORT}/ws`);
  logger.info(`📊 Health check available at http://${HOST}:${PORT}/health`);
}

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down WebSocket server...');

  if (pingInterval) clearInterval(pingInterval);
  if (cleanupInterval) clearInterval(cleanupInterval);

  redis?.quit();
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  logger.error('Failed to start server:', { error });
  process.exit(1);
});
/**
 * Parse cookies from incoming request
 */
function parseCookies(req: Request): Record<string, string> {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return {};
  const entries = cookieHeader
    .split(';')
    .map((part) => part.trim().split('=' as any))
    .filter((pair) => pair.length === 2) as [string, string][];
  const map: Record<string, string> = {};
  for (const [k, v] of entries) {
    map[k] = decodeURIComponent(v);
  }
  return map;
}

/**
 * Extract or generate client identifier
 */
function extractClientId(req: Request): string {
  const cookies = parseCookies(req);
  if (cookies[CLIENT_COOKIE]) return cookies[CLIENT_COOKIE];

  // Fallback to query param if present
  try {
    const url = new URL(req.url);
    if (url.searchParams.has('cid'))
      return url.searchParams.get('cid') || randomUUID();
  } catch {
    // ignore
  }

  return randomUUID();
}

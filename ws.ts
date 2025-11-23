#!/usr/bin/env bun
/**
 * EVE-KILL WebSocket Server
 *
 * Runs independently from the Nitro HTTP server.
 * Handles real-time killmail broadcasts via Redis pub/sub.
 *
 * Usage: bun ws.ts
 */

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

const clients = new Map<any, ClientData>();
let redis: ReturnType<typeof createRedisClient>;
let pingInterval: Timer | null = null;
let cleanupInterval: Timer | null = null;

/**
 * Setup Redis subscriber
 */
async function setupRedis(): Promise<void> {
  redis = createRedisClient();

  redis.on('error', (error) => {
    logger.error('Redis error:', error);
  });

  // Subscribe to killmails channel
  redis.subscribe('killmails', (err, count) => {
    if (err) {
      logger.error('Failed to subscribe to Redis channel:', err);
      process.exit(1);
    }
    logger.info(`Subscribed to ${count} Redis channel(s)`);
  });

  // Handle Redis messages
  redis.on('message', (channel, message) => {
    try {
      const data = JSON.parse(message);
      const normalizedKillmail = data.normalizedKillmail || data.data || data;

      if (normalizedKillmail) {
        broadcastKillmail(normalizedKillmail);
      }
    } catch (error) {
      logger.error('Failed to process Redis message:', error);
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
            })
          );
          sentCount++;
        } catch (error) {
          logger.error('Error sending to client:', error);
        }
      }
    }
  }

  if (sentCount > 0) {
    logger.debug(
      `Broadcasted ${messageType} ${logId} to ${sentCount}/${clients.size} clients`
    );
  }
}

/**
 * Handle incoming client message
 */
function handleMessage(ws: any, message: string): void {
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
    logger.error('Failed to handle message:', error);
    ws.send(
      JSON.stringify({ type: 'error', message: 'Invalid message format' })
    );
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
        logger.error('Error sending ping:', error);
      }
    }
  }

  if (pingsSent > 0) {
    logger.debug(`Sent ping to ${pingsSent} client(s)`);
  }
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
    } catch (error) {
      // Ignore errors when closing
    }
    clients.delete(ws);
  }

  if (clientsToRemove.length > 0) {
    logger.info(`Cleaned up ${clientsToRemove.length} unresponsive client(s)`);
  }
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

  const server = Bun.serve({
    port: PORT,
    hostname: HOST,
    fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname === '/ws' || url.pathname === '/killmails') {
        const upgraded = server.upgrade(req);
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
      open(ws) {
        clients.set(ws, {
          topics: ['all'], // Default subscription
          connectedAt: new Date(),
        });

        ws.send(
          JSON.stringify({
            type: 'connected',
            message: 'Welcome to EVE-KILL WebSocket',
          })
        );

        logger.info(`Client connected. Total: ${clients.size}`);
      },

      message(ws, message) {
        const text =
          typeof message === 'string'
            ? message
            : new TextDecoder().decode(message);

        logger.debug(`Received: ${text}`);
        handleMessage(ws, text);
      },

      close(ws) {
        clients.delete(ws);
        logger.info(`Client disconnected. Total: ${clients.size}`);
      },

      error(ws, error) {
        logger.error('WebSocket error:', error);
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
  logger.error('Failed to start server:', error);
  process.exit(1);
});

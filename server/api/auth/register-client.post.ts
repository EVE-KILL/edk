/**
 * @openapi
 * /api/auth/register-client:
 *   post:
 *     summary: Register WebSocket client
 *     description: Registers a client for WebSocket connections. Requires authentication. Associates a clientId with the authenticated user session.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientId
 *             properties:
 *               clientId:
 *                 type: string
 *                 description: Unique client identifier
 *                 example: "client-abc123xyz"
 *               userAgent:
 *                 type: string
 *                 description: Client user agent (max 180 chars)
 *                 example: "Mozilla/5.0..."
 *               lastSeen:
 *                 type: number
 *                 description: Timestamp of last activity (ms)
 *                 example: 1701388800000
 *     responses:
 *       '200':
 *         description: Client registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *       '400':
 *         description: Missing clientId
 *       '401':
 *         description: Unauthorized - authentication required
 */
import { createError, readBody, setResponseHeaders } from 'h3';
import { createRedisClient } from '../../helpers/redis';

const ONE_WEEK_SECONDS = 7 * 24 * 60 * 60;

export default defineEventHandler(async (event) => {
  const user = event.context.authUser;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const body = await readBody<{
    clientId?: string;
    userAgent?: string;
    lastSeen?: number;
  }>(event);
  const clientId = body?.clientId?.trim();

  if (!clientId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing clientId' });
  }

  const ua = (body?.userAgent || '').slice(0, 180) || 'Unknown';
  const lastSeen =
    body?.lastSeen && Number.isFinite(body.lastSeen)
      ? body.lastSeen
      : Date.now();

  const redis = createRedisClient();

  const userSetKey = `ws:user:${user.id}:clients`;
  const reverseKey = `ws:client:${clientId}:user`;
  const clientMetaKey = `ws:client:${clientId}:meta`;

  await Promise.all([
    redis.sadd(userSetKey, clientId),
    redis.expire(userSetKey, ONE_WEEK_SECONDS),
    redis.set(reverseKey, String(user.id), 'EX', ONE_WEEK_SECONDS),
    redis.hset(clientMetaKey, {
      userId: String(user.id),
      userAgent: ua,
      lastSeen: String(lastSeen),
    }),
    redis.expire(clientMetaKey, ONE_WEEK_SECONDS),
  ]);

  setResponseHeaders(event, {
    'Cache-Control': 'private, no-store, max-age=0',
    Vary: 'Cookie',
  });

  return { ok: true };
});

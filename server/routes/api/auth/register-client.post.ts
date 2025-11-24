import { createError, readBody, setResponseHeaders } from 'h3';
import { createRedisClient } from '../../../helpers/redis';

const ONE_WEEK_SECONDS = 7 * 24 * 60 * 60;

export default defineEventHandler(async (event) => {
  const user = event.context.authUser;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const body = await readBody<{ clientId?: string; userAgent?: string; lastSeen?: number }>(event);
  const clientId = body?.clientId?.trim();

  if (!clientId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing clientId' });
  }

  const ua = (body?.userAgent || '').slice(0, 180) || 'Unknown';
  const lastSeen = body?.lastSeen && Number.isFinite(body.lastSeen)
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

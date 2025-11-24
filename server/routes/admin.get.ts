export default defineEventHandler(async (event) => {
  const user = event.context.user;

  if (!user || !user.admin) {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required' });
  }

  const pageContext = {
    title: 'Admin',
    description: 'Administrative tools and panels',
  };

  const data = {
    sidebar: [
      { label: 'Admin Home', href: '/admin', active: true },
    ],
    user: {
      name: user.characterName,
      characterId: user.characterId,
    },
    devices: await getAllUserDevices(),
  };

  return render('pages/admin.hbs', pageContext, data, event);
});

import { createRedisClient } from '../helpers/redis';

async function getAllUserDevices() {
  const redis = createRedisClient();
  // Scan keys matching ws:user:*:clients
  const keys = await redis.keys('ws:user:*:clients');
  const devices: { userId: string; clientId: string; userAgent: string; lastSeen: Date | null }[] = [];

  for (const key of keys) {
    const match = key.match(/^ws:user:(\d+):clients$/);
    if (!match) continue;
    const userId = match[1];
    const ids = await redis.smembers(key);
    for (const id of ids) {
      const meta = await redis.hgetall(`ws:client:${id}:meta`);
      const userAgent = meta?.userAgent || 'Unknown';
      const lastSeen = meta?.lastSeen ? new Date(Number(meta.lastSeen)) : null;
      devices.push({ userId, clientId: id, userAgent, lastSeen });
    }
  }

  return devices;
}

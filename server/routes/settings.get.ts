import { createRedisClient } from '../helpers/redis';

export default defineEventHandler(async (event) => {
  const user = event.context.user;

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required',
    });
  }

  const pageContext = {
    title: 'Settings',
    description: 'Manage your EDK account settings',
  };

  const data = {
    sidebar: [{ label: 'Overview', href: '/settings', active: true }],
    user: {
      name: user.characterName,
      characterId: user.characterId,
      corporationName: user.corporationName,
      allianceName: user.allianceName,
      admin: Boolean(user.admin),
    },
    devices: await getUserDevices(user.id),
  };

  return render('pages/settings.hbs', pageContext, data, event);
});

async function getUserDevices(userId: number) {
  const redis = createRedisClient();
  const key = `ws:user:${userId}:clients`;
  const ids = await redis.smembers(key);
  const results = [];
  for (const id of ids) {
    const meta = await redis.hgetall(`ws:client:${id}:meta`);
    const userAgent = meta?.userAgent || 'Unknown';
    const lastSeen = meta?.lastSeen ? new Date(Number(meta.lastSeen)) : null;
    results.push({ clientId: id, userAgent, lastSeen });
  }
  return results;
}

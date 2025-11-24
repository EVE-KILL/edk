export default defineEventHandler((event) => {
  const user = event.context.authUser;

  // Always mark response as private/no-store
  setResponseHeaders(event, {
    'Cache-Control': 'private, no-store, max-age=0',
    Vary: 'Cookie',
  });

  if (!user) {
    return { authenticated: false };
  }

  return {
    authenticated: true,
    user: {
      id: user.id,
      characterId: user.characterId,
      characterName: user.characterName,
      corporationId: user.corporationId,
      corporationName: user.corporationName,
      allianceId: user.allianceId,
      allianceName: user.allianceName,
      admin: Boolean(user.admin),
    },
  };
});

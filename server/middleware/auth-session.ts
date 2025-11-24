import { deleteCookie, getCookie } from 'h3';
import { env } from '../helpers/env';
import { logger } from '../helpers/logger';
import {
  deleteSessionByToken,
  findSessionWithUser,
  refreshUserTokens,
  shouldRefreshToken,
  touchSession,
} from '../models/user-auth';

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60,
};

export default defineEventHandler(async (event) => {
  const cookieName = env.SESSION_COOKIE_NAME;
  const token = getCookie(event, cookieName);
  if (!token) return;

  try {
    const sessionData = await findSessionWithUser(token);

    if (!sessionData) {
      deleteCookie(event, cookieName, cookieOptions);
      await deleteSessionByToken(token);
      return;
    }

    const safeUser = {
      id: sessionData.user.id,
      characterId: sessionData.user.characterId,
      characterName: sessionData.user.characterName,
      admin: Boolean(sessionData.user.admin),
      corporationId: sessionData.user.corporationId,
      corporationName: sessionData.user.corporationName,
      allianceId: sessionData.user.allianceId,
      allianceName: sessionData.user.allianceName,
      canFetchCorporationKillmails:
        sessionData.user.canFetchCorporationKillmails,
    };

    event.context.user = sessionData.user;
    event.context.authUser = safeUser;
    event.context.session = sessionData.session;

    await touchSession(sessionData.session.id);

    if (shouldRefreshToken(sessionData.user)) {
      const refreshed = await refreshUserTokens(sessionData.user);
      if (refreshed) {
        event.context.user = refreshed;
        event.context.authUser = {
          ...safeUser,
          characterName: refreshed.characterName,
          corporationId: refreshed.corporationId,
          corporationName: refreshed.corporationName,
          allianceId: refreshed.allianceId,
          allianceName: refreshed.allianceName,
          admin: Boolean(refreshed.admin),
          canFetchCorporationKillmails:
            refreshed.canFetchCorporationKillmails,
        };
      }
    }
  } catch (error) {
    logger.warn('Failed to hydrate session', { error: String(error) });
    deleteCookie(event, cookieName, cookieOptions);
  }
});

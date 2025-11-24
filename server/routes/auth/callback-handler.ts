import {
  createError,
  getQuery,
  getRequestHeader,
  getRequestIP,
  readBody,
  setCookie,
  type H3Event,
} from 'h3';
import {
  consumeLoginState,
  exchangeCodeForToken,
  verifyAccessToken,
} from '../../helpers/eve-sso';
import { env } from '../../helpers/env';
import { logger } from '../../helpers/logger';
import { createSession, upsertUserLogin } from '../../models/user-auth';

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60,
};

export async function handleAuthCallback(event: H3Event) {
  try {
    const query = getQuery(event);
    const body =
      event.method === 'POST' ? ((await readBody(event)) as any) : undefined;
    const code =
      (body?.code as string | undefined) || (query.code as string | undefined);
    const stateParam =
      (body?.state as string | undefined) ||
      (query.state as string | undefined);

    if (!code || !stateParam) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing authorization parameters',
      });
    }

    const state = await consumeLoginState(stateParam);
    if (!state) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid or expired state',
      });
    }

    const tokenResponse = await exchangeCodeForToken(code);
    if (!tokenResponse.refresh_token) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing refresh token from provider',
      });
    }
    const verified = await verifyAccessToken(tokenResponse.access_token);
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

    const killmailAccess = state.killmailAccess ?? true;

    const user = await upsertUserLogin({
      characterId: verified.characterId,
      characterName: verified.characterName,
      characterOwnerHash: verified.characterOwnerHash,
      tokenType: verified.tokenType || tokenResponse.token_type || 'Bearer',
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      tokenExpiresAt: expiresAt,
      scopes: killmailAccess ? verified.scopes : ['publicData'],
      killmailDelay: state.killmailDelay,
      corporationId: null,
      corporationName: '',
      allianceId: null,
      allianceName: '',
    });

    const { token: sessionToken, session } = await createSession(user.id, {
      userAgent: getRequestHeader(event, 'user-agent') || undefined,
      ipAddress: getRequestIP(event) || undefined,
    });

    const safeUser = {
      id: user.id,
      characterId: user.characterId,
      characterName: user.characterName,
      admin: Boolean(user.admin),
      corporationId: user.corporationId,
      corporationName: user.corporationName,
      allianceId: user.allianceId,
      allianceName: user.allianceName,
      canFetchCorporationKillmails: user.canFetchCorporationKillmails,
    };

    setCookie(event, env.SESSION_COOKIE_NAME, sessionToken, cookieOptions);

    event.context.user = user;
    event.context.authUser = safeUser;
    event.context.session = session;

    // Server-driven redirect
    setResponseStatus(event, 302);
    setResponseHeader(event, 'Location', '/');
    return null;
  } catch (error) {
    logger.error('Failed to complete EVE SSO callback', {
      error: String(error),
    });
    if (error && typeof (error as any).statusCode === 'number') {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Authentication failed',
    });
  }
}

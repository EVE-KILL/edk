import { createError, getCookie, getQuery, sendRedirect, setCookie } from 'h3';
import { buildAuthorizeUrl, createLoginState } from '../helpers/eve-sso';
import { logger } from '../helpers/logger';
import { env } from '../helpers/env';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const redirectUrl =
      typeof query.redirect === 'string' && query.redirect.length > 0
        ? query.redirect
        : '/';
    const killmailDelay = query.killmailDelay
      ? Number.parseInt(query.killmailDelay as string, 10)
      : undefined;
    const cookieChoice = getCookie(event, 'killmail_access');
    const killmailAccess =
      typeof query.killmailAccess === 'string'
        ? query.killmailAccess === '1'
        : cookieChoice === '0'
          ? false
          : true;

    setCookie(event, 'killmail_access', killmailAccess ? '1' : '0', {
      httpOnly: false,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });

    const { encoded } = await createLoginState({
      redirectUrl,
      killmailDelay: Number.isNaN(killmailDelay) ? undefined : killmailDelay,
      killmailAccess,
    });

    const scopes = killmailAccess ? env.EVE_CLIENT_SCOPES : 'publicData';

    const authorizeUrl = buildAuthorizeUrl(encoded, scopes);
    return sendRedirect(event, authorizeUrl);
  } catch (error) {
    logger.error('Failed to start EVE SSO login', { error: String(error) });
    throw createError({
      statusCode: 500,
      statusMessage: 'Unable to start login flow',
    });
  }
});

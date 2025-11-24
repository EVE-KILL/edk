import { deleteCookie, getCookie, type H3Event } from 'h3';
import { env } from '../helpers/env';
import { deleteSessionByToken } from '../models/user-auth';

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60,
};

export default defineEventHandler(async (event: H3Event) => {
  const token = getCookie(event, env.SESSION_COOKIE_NAME);

  if (token) {
    await deleteSessionByToken(token);
  }

  // Clear session cookie regardless of whether it was present
  deleteCookie(event, env.SESSION_COOKIE_NAME, cookieOptions);
  setCookie(event, env.SESSION_COOKIE_NAME, '', {
    ...cookieOptions,
    maxAge: 0,
    expires: new Date(0),
  });

  // Clear killmail choice cookie as well
  deleteCookie(event, 'killmail_access', {
    httpOnly: false,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  });

  // Server-driven redirect
  setResponseStatus(event, 302);
  setResponseHeader(event, 'Location', '/');
  return null;
});

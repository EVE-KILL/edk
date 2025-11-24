import { getCookie, setResponseHeaders } from 'h3';
import { env } from '../helpers/env';

/**
 * Cache guard for authenticated users
 *
 * If the session cookie is present, mark the response as private/no-store
 * to prevent shared caching of user-specific HTML.
 */
export default defineEventHandler((event) => {
  const token = getCookie(event, env.SESSION_COOKIE_NAME);
  if (!token) return;

  setResponseHeaders(event, {
    'Cache-Control': 'private, no-store, max-age=0',
    Vary: 'Cookie',
  });
});

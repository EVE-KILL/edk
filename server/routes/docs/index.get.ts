import type { H3Event } from 'h3';
import { createError, sendRedirect } from 'h3';
import { getDocsIndex } from '../../helpers/docs';
import { handleError } from '../../utils/error';
import { track } from '../../utils/performance-decorators';
import { env } from '../../helpers/env';

export default defineCachedEventHandler(
  async (event: H3Event) => {
    try {
      const docsIndex = await track('docs:load_index', 'application', () =>
        getDocsIndex()
      );

      return sendRedirect(event, `/docs/index`, 302);
    } catch (error) {
      return handleError(event, error);
    }
  },
  {
    maxAge: 3600,
    staleMaxAge: 7200,
    base: 'redis',
    shouldBypassCache: () => env.NODE_ENV !== 'production',
  }
);

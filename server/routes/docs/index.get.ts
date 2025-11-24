import type { H3Event } from 'h3';
import { createError, sendRedirect } from 'h3';
import { getDocsIndex } from '../../helpers/docs';
import { handleError } from '../../utils/error';
import { track } from '../../utils/performance-decorators';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const docsIndex = await track('docs:load_index', 'application', () =>
      getDocsIndex()
    );

    const defaultSlug = docsIndex.defaultSlug;
    if (!defaultSlug) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Documentation not found',
      });
    }

    return sendRedirect(event, `/docs/${defaultSlug}`, 302);
  } catch (error) {
    return handleError(event, error);
  }
});

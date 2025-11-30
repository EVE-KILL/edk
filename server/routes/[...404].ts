/**
 * Catch-all 404 handler
 * This route catches all unmatched paths and renders a 404 page
 */
import { renderErrorPage } from '../utils/error';

export default defineEventHandler(async (event) => {
  // Skip API routes - let them return JSON 404
  if (event.path.startsWith('/api/')) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'The requested resource was not found',
    });
  }

  // Render 404 page for all other routes
  return renderErrorPage(event, 404);
});

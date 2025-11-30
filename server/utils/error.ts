import { H3Event, createError, setResponseStatus } from 'h3';
import { logger } from '../helpers/logger';
import { render } from '../helpers/templates';

export function handleError(event: H3Event, error: any) {
  const message = error.message || 'Internal Server Error';
  const statusCode = error.statusCode || 500;

  logger.error(`Route error on ${event.path}`, {
    error: {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
      statusMessage: error.statusMessage,
      data: error.data,
    },
    path: event.path,
    method: event.method,
    context: event.context,
  });

  throw createError({
    statusCode,
    message,
  });
}

/**
 * Render an error page for the user
 * Use this for user-facing routes (not API routes)
 */
export async function renderErrorPage(
  event: H3Event,
  statusCode: number,
  message?: string,
  description?: string
) {
  let errorMessage = message;
  let errorDescription = description;

  if (!errorMessage) {
    if (statusCode === 404) {
      errorMessage = 'Page Not Found';
      errorDescription = `The page you're looking for doesn't exist or has been moved.`;
    } else if (statusCode === 500) {
      errorMessage = 'Internal Server Error';
      errorDescription =
        'Something went wrong on our end. Please try again later.';
    } else if (statusCode === 403) {
      errorMessage = 'Forbidden';
      errorDescription = "You don't have permission to access this resource.";
    } else if (statusCode === 401) {
      errorMessage = 'Unauthorized';
      errorDescription = 'You need to log in to access this page.';
    } else {
      errorMessage = 'Error';
      errorDescription = 'An unexpected error occurred.';
    }
  }

  setResponseStatus(event, statusCode);

  return render('pages/error', {
    title: `Error ${statusCode}`,
    statusCode,
    message: errorMessage,
    description: errorDescription,
    path: event.path,
  });
}

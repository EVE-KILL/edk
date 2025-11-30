import { requestContext } from '../utils/request-context';

/**
 * Performance Context Middleware
 *
 * Establishes AsyncLocalStorage context for performance tracking across async operations.
 * The performance tracker is created in the performance plugin's request hook and stored
 * in event.context. This middleware propagates it to AsyncLocalStorage so that deeply
 * nested async operations (like database queries) can access it without explicit passing.
 *
 * This must run early in the middleware chain to ensure all subsequent operations
 * have access to the performance tracker.
 */
export default defineEventHandler((event) => {
  const performance = event.context.performance;

  if (performance) {
    // Propagate performance tracker to AsyncLocalStorage
    // This allows database helpers and other utilities to access it via requestContext.getStore()
    requestContext.enterWith({ performance });
  }
});

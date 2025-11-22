import { defineEventHandler, getRequestURL } from 'h3';

/**
 * Route Tracking Middleware
 * 
 * Automatically creates a parent span for each route handler.
 * All subsequent tracking operations (database queries, cache operations, etc.)
 * will inherit this span as their parent, creating a hierarchical view of the
 * entire request lifecycle.
 * 
 * This runs after performance-context.ts to ensure the performance tracker is available.
 */
export default defineEventHandler(async (event) => {
  // Skip in production
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const performance = event.context.performance;
  
  if (!performance) {
    return;
  }

  const url = getRequestURL(event);
  const routeName = `route:${url.pathname}`;
  
  // Start a span for this route
  const spanId = performance.startSpan(routeName, 'application', {
    method: event.method,
    path: url.pathname,
  });
  
  // Set as current span so all operations inherit it as parent
  performance['currentSpanId'] = spanId;
  
  // Store the span ID so we can end it after the route handler completes
  event.context.routeSpanId = spanId;
  
  // Hook into the response to end the span when the handler completes
  event.node.res.once('finish', () => {
    performance.endSpan(spanId);
    performance['currentSpanId'] = undefined;
  });
});

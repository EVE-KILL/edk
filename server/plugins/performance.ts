import { defineNitroPlugin } from 'nitropack/runtime';
import { PerformanceTracker } from '../helpers/performance';
import { env } from '../helpers/env';

export default defineNitroPlugin((nitroApp) => {
  // Initialize performance tracker at the very start of the request
  // The tracker is stored in event.context and later propagated to AsyncLocalStorage by middleware
  nitroApp.hooks.hook('request', (event) => {
    const performance = new PerformanceTracker(true);

    // Store in event.context - this is the primary storage mechanism
    event.context.performance = performance;
  });

  // Finalize timing just before response is sent
  nitroApp.hooks.hook('beforeResponse', (event) => {
    const performance = event.context?.performance;
    if (performance) {
      // Mark the end of request processing
      performance.mark('response_ready');
    }
  });

  // Log performance metrics after response is sent (only when DEBUG is enabled)
  nitroApp.hooks.hook('afterResponse', (event) => {
    const isDebug = env.DEBUG === '1' || env.DEBUG === 'true';
    if (!isDebug) {
      return;
    }

    const performance = event.context?.performance;
    if (performance) {
      const summary = performance.getSummary();
      logger.info(
        `${event.path} | ${summary.totalTime}ms | ${summary.queryCount} queries (${summary.dbTime}ms avg)`
      );

      if (summary.queries.length > 0) {
        for (const q of summary.queries) {
          logger.debug(`  ${q.query} | ${q.duration}ms`);
        }
      }
    }
  });
});

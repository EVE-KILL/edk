import { defineNitroPlugin } from 'nitropack/runtime';
import { PerformanceTracker } from '../helpers/performance';
import { requestContext } from '../utils/request-context';
import { getQuery, getRequestHeader } from 'h3';

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    const accept = getRequestHeader(event, 'accept');
    if (!accept || !accept.includes('text/html')) {
      return;
    }

    const query = getQuery(event);
    const debug = query.debug === 'true';
    const performance = new PerformanceTracker(debug);

    requestContext.enterWith({ performance });
  });

  nitroApp.hooks.hook('afterResponse', (event) => {
    const performance = requestContext.getStore()?.performance;
    if (performance) {
      const summary = performance.getSummary();
      console.log(
        `[Request Performance] URL: ${event.node.req.url} | Total: ${summary.totalTime}ms | DB: ${summary.dbTime}ms (${summary.queryCount} queries)`
      );

      if (summary.queries.length > 0) {
        for (const q of summary.queries) {
          console.log(`  [DB Query] ${q.query} | ${q.duration}ms`);
        }
      }
    }
  });
});

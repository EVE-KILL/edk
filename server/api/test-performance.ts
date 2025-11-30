/**
 * Performance Test Route
 *
 * Exercises all performance tracking categories to demonstrate
 * the tracking system with real operations.
 */

import { storage } from '../helpers/redis';
import { fetchESI } from '../helpers/esi';
import { updateSearchEntity } from '../helpers/typesense';
import { trackBlock } from '../utils/performance-decorators';

export default defineEventHandler(async (event) => {
  const perf = event.context.performance;

  try {
    // 1. Database operation (already tracked automatically)
    perf?.startTimer('database_ops');
    const killmails = await database.query(
      'SELECT "killmailId", "killmailTime" FROM killmails ORDER BY "killmailTime" DESC LIMIT 5'
    );
    perf?.endTimer('database_ops');

    // 2. Redis cache operation (tracked automatically)
    perf?.startTimer('cache_ops');
    await storage.setItem('test:performance', { timestamp: Date.now() });
    const cachedData = await storage.getItem('test:performance');
    perf?.endTimer('cache_ops');

    // 3. External HTTP call via ESI (tracked automatically)
    perf?.startTimer('http_ops');
    const systemInfo = await fetchESI('/universe/systems/30000142/');
    perf?.endTimer('http_ops');

    // 4. Typesense search operation (tracked automatically)
    if (killmails.length > 0) {
      perf?.startTimer('search_ops');
      await updateSearchEntity(12345, 'Test Character', 'character').catch(
        () => {}
      ); // Ignore errors for demo
      perf?.endTimer('search_ops');
    }

    // 5. Application code with trackBlock (manual tracking)
    const processedData = await trackBlock(
      'process_results',
      'application',
      async () => {
        // Simulate some processing
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          killmailCount: killmails.length,
          cacheHit: !!cachedData,
          system: systemInfo.data?.name || 'Unknown',
        };
      }
    );

    // Return results with performance summary
    const summary = perf?.getSummary();

    return {
      success: true,
      data: processedData,
      performance: {
        totalTime: summary?.totalTime,
        categories: summary?.categoryBreakdown,
        breakdown: {
          database: `${summary?.categoryBreakdown?.database?.count || 0} operations, ${summary?.categoryBreakdown?.database?.total || '0'}ms`,
          cache: `${summary?.categoryBreakdown?.cache?.count || 0} operations, ${summary?.categoryBreakdown?.cache?.total || '0'}ms`,
          search: `${summary?.categoryBreakdown?.search?.count || 0} operations, ${summary?.categoryBreakdown?.search?.total || '0'}ms`,
          http: `${summary?.categoryBreakdown?.http?.count || 0} requests, ${summary?.categoryBreakdown?.http?.total || '0'}ms`,
          application: `${summary?.categoryBreakdown?.application?.count || 0} operations, ${summary?.categoryBreakdown?.application?.total || '0'}ms`,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

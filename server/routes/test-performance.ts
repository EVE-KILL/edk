/**
 * Performance Test Page
 *
 * Demonstrates all performance tracking categories with a visual debug bar
 */

import { storage } from '../helpers/redis';
import { fetchESI } from '../helpers/esi';
import { updateSearchEntity } from '../helpers/typesense';
import { trackBlock } from '../utils/performance-decorators';

export default defineEventHandler(async (event) => {
  try {
    // Database operation (tracked automatically)
    const killmails = await database.query(
      'SELECT "killmailId", "killmailTime" FROM killmails ORDER BY "killmailTime" DESC LIMIT 3'
    );

    // Redis cache operations (tracked automatically)
    await storage.setItem('test:demo', {
      timestamp: Date.now(),
      message: 'Performance tracking demo',
    });
    const cachedData = await storage.getItem('test:demo');

    // External HTTP call via ESI (tracked automatically)
    const systemInfo = await fetchESI('/universe/systems/30000142/');

    // Typesense search operation (tracked automatically)
    if (killmails.length > 0) {
      await updateSearchEntity(99999, 'Demo Character', 'character').catch(
        () => {}
      ); // Ignore errors for demo
    }

    // Application code with trackBlock (manual tracking)
    const results = await trackBlock(
      'process_demo_data',
      'application',
      async () => {
        // Simulate some processing
        await new Promise((resolve) => setTimeout(resolve, 15));

        return {
          killmails: killmails.length,
          cached: !!cachedData,
          system: systemInfo.data?.name || 'Unknown',
          timestamp: new Date().toISOString(),
        };
      }
    );

    // Render page with results
    return await render(
      'pages/performance-test.hbs',
      {
        title: 'Performance Tracking Demo',
        description: 'Demonstrates all performance tracking categories',
      },
      {
        results,
        categories: [
          { name: 'Database', icon: '🗄️', description: 'PostgreSQL queries' },
          { name: 'Cache', icon: '💾', description: 'Redis operations' },
          { name: 'Search', icon: '🔍', description: 'Typesense operations' },
          { name: 'HTTP', icon: '🌐', description: 'External API calls (ESI)' },
          { name: 'Template', icon: '🎨', description: 'Handlebars rendering' },
          {
            name: 'Application',
            icon: '⚙️',
            description: 'Custom application code',
          },
        ],
      },
      event
    );
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

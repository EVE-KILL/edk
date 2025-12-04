import type { H3Event } from 'h3';
import { getQuery } from 'h3';
import { database } from '../helpers/database';
import { logger } from '../helpers/logger';
import { render } from '../helpers/templates';
import { handleError } from '../utils/error';
import { track } from '../utils/performance-decorators';
import { env } from '../helpers/env';

export default defineCachedEventHandler(
  async (event: H3Event) => {
    try {
      const query = getQuery(event);
      const easterEggEnabled = Boolean(query.itwasallplannedbybob);

      const pageContext = {
        title: 'About - EVE Killboard',
        activeNav: 'about',
      };

      const pageHeader = {
        breadcrumbs: [
          { label: 'Home', url: '/' },
          { label: 'About', url: '/about' },
        ],
        meta: [
          { type: 'pill', text: 'Overview' },
          { type: 'text', text: `Updated ${new Date().toLocaleDateString()}` },
        ],
      };

      // Get simple counts (fast queries using table statistics)
      const counts = await track(
        'about:get_db_counts',
        'database',
        async () => {
          return await getDatabaseCounts();
        }
      );

      logger.info('About page counts', { counts });

      // Build data object
      const data = await track('about:build_data', 'application', async () => {
        return {
          counts,
          updatedAt: new Date().toISOString(),
          easterEggEnabled,
          pageHeader,
        };
      });

      // Render template
      return render('pages/about.hbs', pageContext, data, event);
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

/**
 * Get database counts for all major tables (using fast estimates from pg_class)
 * Note: These are approximate counts based on PostgreSQL statistics.
 * For partitioned tables, reltuples on the parent table includes child partitions.
 */
async function getDatabaseCounts() {
  // Use reltuples from pg_class for super fast approximate counts
  // For partitioned tables, the parent table's reltuples includes all partitions
  const result = await database.query<{
    killmails: string;
    attackers: string;
    items: string;
    characters: string;
    corporations: string;
    alliances: string;
    systems: string;
    regions: string;
    constellations: string;
    types: string;
    groups: string;
    categories: string;
  }>(`
    SELECT 
      COALESCE((SELECT reltuples::bigint FROM pg_class WHERE relname = 'killmails'), 0) as killmails,
      COALESCE((SELECT reltuples::bigint FROM pg_class WHERE relname = 'attackers'), 0) as attackers,
      COALESCE((SELECT reltuples::bigint FROM pg_class WHERE relname = 'items'), 0) as items,
      COALESCE((SELECT reltuples::bigint FROM pg_class WHERE relname = 'characters'), 0) as characters,
      COALESCE((SELECT reltuples::bigint FROM pg_class WHERE relname = 'corporations'), 0) as corporations,
      COALESCE((SELECT reltuples::bigint FROM pg_class WHERE relname = 'alliances'), 0) as alliances,
      COALESCE((SELECT reltuples::bigint FROM pg_class WHERE relname = 'solarsystems'), 0) as systems,
      COALESCE((SELECT reltuples::bigint FROM pg_class WHERE relname = 'regions'), 0) as regions,
      COALESCE((SELECT reltuples::bigint FROM pg_class WHERE relname = 'constellations'), 0) as constellations,
      COALESCE((SELECT reltuples::bigint FROM pg_class WHERE relname = 'types'), 0) as types,
      COALESCE((SELECT reltuples::bigint FROM pg_class WHERE relname = 'groups'), 0) as groups,
      COALESCE((SELECT reltuples::bigint FROM pg_class WHERE relname = 'categories'), 0) as categories
  `);

  return {
    killmails: Number(result[0]?.killmails) || 0,
    attackers: Number(result[0]?.attackers) || 0,
    items: Number(result[0]?.items) || 0,
    characters: Number(result[0]?.characters) || 0,
    corporations: Number(result[0]?.corporations) || 0,
    alliances: Number(result[0]?.alliances) || 0,
    systems: Number(result[0]?.systems) || 0,
    regions: Number(result[0]?.regions) || 0,
    constellations: Number(result[0]?.constellations) || 0,
    types: Number(result[0]?.types) || 0,
    groups: Number(result[0]?.groups) || 0,
    categories: Number(result[0]?.categories) || 0,
  };
}

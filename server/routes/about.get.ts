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
 * For partitioned tables, we sum partition reltuples (more accurate than stale parent stats).
 */
async function getDatabaseCounts() {
  // For partitioned tables (killmails, attackers, items), sum partition reltuples
  // For non-partitioned tables, use direct reltuples lookup
  // This is much faster than COUNT(*) and more accurate than parent table reltuples
  const result = await database.query<{
    killmails: string;
    attackers: string;
    items: string;
    prices: string;
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
      -- Single scan with CASE for much better performance (4x faster than multiple subqueries)
      -- Partitioned tables: sum all yearly/monthly partitions (killmails_2024, killmails_2025_06, killmails_2025_pre_06)
      COALESCE(SUM(CASE WHEN relname ~ '^killmails_[0-9]{4}' AND relkind = 'r' THEN reltuples ELSE 0 END)::bigint, 0) as killmails,
      COALESCE(SUM(CASE WHEN relname ~ '^attackers_[0-9]{4}' AND relkind = 'r' THEN reltuples ELSE 0 END)::bigint, 0) as attackers,
      COALESCE(SUM(CASE WHEN relname ~ '^items_[0-9]{4}' AND relkind = 'r' THEN reltuples ELSE 0 END)::bigint, 0) as items,
      COALESCE(SUM(CASE WHEN relname ~ '^prices_[0-9]{4}' AND relkind = 'r' THEN reltuples ELSE 0 END)::bigint, 0) as prices,
      
      -- Non-partitioned tables: direct lookup
      COALESCE(MAX(CASE WHEN relname = 'characters' THEN reltuples ELSE 0 END)::bigint, 0) as characters,
      COALESCE(MAX(CASE WHEN relname = 'corporations' THEN reltuples ELSE 0 END)::bigint, 0) as corporations,
      COALESCE(MAX(CASE WHEN relname = 'alliances' THEN reltuples ELSE 0 END)::bigint, 0) as alliances,
      COALESCE(MAX(CASE WHEN relname = 'solarsystems' THEN reltuples ELSE 0 END)::bigint, 0) as systems,
      COALESCE(MAX(CASE WHEN relname = 'regions' THEN reltuples ELSE 0 END)::bigint, 0) as regions,
      COALESCE(MAX(CASE WHEN relname = 'constellations' THEN reltuples ELSE 0 END)::bigint, 0) as constellations,
      COALESCE(MAX(CASE WHEN relname = 'types' THEN reltuples ELSE 0 END)::bigint, 0) as types,
      COALESCE(MAX(CASE WHEN relname = 'groups' THEN reltuples ELSE 0 END)::bigint, 0) as groups,
      COALESCE(MAX(CASE WHEN relname = 'categories' THEN reltuples ELSE 0 END)::bigint, 0) as categories
    FROM pg_class
    WHERE (
      relname ~ '^(killmails|attackers|items|prices)_[0-9]{4}' AND relkind = 'r'
    ) OR relname IN (
      'characters', 'corporations', 'alliances', 'solarsystems', 
      'regions', 'constellations', 'types', 'groups', 'categories'
    )
  `);

  return {
    killmails: Number(result[0]?.killmails) || 0,
    attackers: Number(result[0]?.attackers) || 0,
    items: Number(result[0]?.items) || 0,
    prices: Number(result[0]?.prices) || 0,
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

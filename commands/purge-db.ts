import { database } from '../server/helpers/database';
import { logger } from '../server/helpers/logger';

export const description = 'Purge and reset the database (Use with caution!)';

export async function action() {
  // Ask for confirmation unless --force is passed (if we had args parsing here, but we can just log a warning)
  // Since this is a dev tool, we assume the user knows what they are doing.
  logger.warn('⚠️  Purging database! All data will be lost.');

  try {
    // 1. Drop all known tables
    const tables = [
      'killmails',
      'attackers',
      'items',
      'characters',
      'corporations',
      'alliances',
      'prices',
      'regions',
      'constellations',
      'solarSystems',
      'stargates',
      'stars',
      'planets',
      'moons',
      'asteroidBelts',
      'categories',
      'groups',
      'types',
      'marketGroups',
      'metaGroups',
      'npcCorporations',
      'npcStations',
      'npcCharacters',
      'factions',
      'races',
      'bloodlines',
      'ancestries',
      'dogmaAttributes',
      'dogmaEffects',
      'skins',
      'stationOperations',
      'config',
      // 'migrations' // Optionally keep migrations or drop them too to force re-run
    ];

    // Also drop migrations table to force a fresh schema apply on next start
    tables.push('migrations');

    for (const table of tables) {
      logger.info(`Dropping table: ${table}`);
      await database.sql.unsafe(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }

    // 2. Verify cleanup
    const remaining = await database.sql<{ name: string }[]>`
      SELECT table_name as name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;

    if (remaining.length === 0) {
      logger.success('✅ Database purged successfully.');
    } else {
      logger.warn(
        `⚠️  Database purged but some tables remain: ${remaining.map((t) => t.name).join(', ')}`
      );
    }
  } catch (error) {
    logger.error('❌ Database purge failed:', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

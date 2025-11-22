import { sdeFetcher } from '../../server/helpers/sde/fetcher';
import chalk from 'chalk';
import { logger } from '../../server/helpers/logger';
import {
  mapStargatesConfig,
  mapStarsConfig,
  mapPlanetsConfig,
  mapMoonsConfig,
  mapAsteroidBeltsConfig,
  typesConfig,
  groupsConfig,
  categoriesConfig,
  npcCorporationsConfig,
  npcStationsConfig,
  stationOperationsConfig,
  npcCharactersConfig,
  factionsConfig,
  racesConfig,
  bloodlinesConfig,
  ancestriesConfig,
  marketGroupsConfig,
  metaGroupsConfig,
  skinsConfig,
  dogmaAttributesConfig,
  dogmaEffectsConfig,
} from '../../server/helpers/sde/configs';

/**
 * SDE Download Command
 *
 * Downloads, extracts, and imports the latest EVE-Online Static Data Export
 *
 * Usage:
 *   bun run cli sde:download
 *   bun run cli sde:download --force    (force re-import all tables, useful for testing)
 */
export default {
  description: 'Download, extract, and import latest SDE (Static Data Export)',
  options: [
    {
      flags: '-f, --force',
      description:
        'Force re-import all tables (useful for SDE updates and testing deduplication)',
    },
  ],

  async action(options: any) {
    const forceReimport = options.force || false;

    if (forceReimport) {
      logger.warn('FORCE REIMPORT MODE ENABLED');
      sdeFetcher.enableForceReimport();
    }

    logger.info('Starting SDE sync and import...');

    try {
      // Sync (download if needed, extract)
      const metadata = await sdeFetcher.sync();

      logger.success('SDE sync completed!');
      logger.info('Metadata:', {
        buildNumber: metadata.buildNumber,
        variant: metadata.variant,
        downloadedAt: new Date(metadata.downloadedAt).toISOString(),
        extractedAt: metadata.extractedAt
          ? new Date(metadata.extractedAt).toISOString()
          : 'N/A',
        url: metadata.url,
      });

      // List available tables
      const tables = await sdeFetcher.listExtractedTables();
      logger.info(
        `Available tables: ${chalk.yellow(tables.length.toString())} total`
      );

      // Group tables by type
      const typeGroups = new Map<string, string[]>();
      for (const table of tables) {
        const prefix = table.split(/(?=[A-Z])/)[0] || 'other';
        if (!typeGroups.has(prefix)) {
          typeGroups.set(prefix, []);
        }
        typeGroups.get(prefix)!.push(table);
      }

      for (const [prefix, tbls] of Array.from(typeGroups.entries()).sort()) {
        logger.debug(`${prefix}: ${chalk.cyan(tbls.map((t) => t).join(', '))}`);
      }

      // Import tables
      logger.info('Importing tables...');

      // First batch - already implemented with special handling
      await sdeFetcher.importMapSolarSystems(metadata.buildNumber);
      await sdeFetcher.importMapRegions(metadata.buildNumber);
      await sdeFetcher.importMapConstellations(metadata.buildNumber);

      // Map tables
      await sdeFetcher.importConfiguredTable(mapStargatesConfig);
      await sdeFetcher.importConfiguredTable(mapStarsConfig);
      await sdeFetcher.importConfiguredTable(mapPlanetsConfig);
      await sdeFetcher.importConfiguredTable(mapMoonsConfig);
      await sdeFetcher.importConfiguredTable(mapAsteroidBeltsConfig);

      // Item/Type tables
      await sdeFetcher.importConfiguredTable(typesConfig);
      await sdeFetcher.importConfiguredTable(groupsConfig);
      await sdeFetcher.importConfiguredTable(categoriesConfig);

      // NPC tables
      await sdeFetcher.importConfiguredTable(npcCorporationsConfig);
      await sdeFetcher.importConfiguredTable(npcStationsConfig);
      await sdeFetcher.importConfiguredTable(stationOperationsConfig);
      await sdeFetcher.importConfiguredTable(npcCharactersConfig);

      // Character attributes
      await sdeFetcher.importConfiguredTable(factionsConfig);
      await sdeFetcher.importConfiguredTable(racesConfig);
      await sdeFetcher.importConfiguredTable(bloodlinesConfig);
      await sdeFetcher.importConfiguredTable(ancestriesConfig);

      // Market/Meta tables
      await sdeFetcher.importConfiguredTable(marketGroupsConfig);
      await sdeFetcher.importConfiguredTable(metaGroupsConfig);
      await sdeFetcher.importConfiguredTable(skinsConfig);

      // Dogma tables
      await sdeFetcher.importConfiguredTable(dogmaAttributesConfig);
      await sdeFetcher.importConfiguredTable(dogmaEffectsConfig);

      // Optimize materialized views
      await sdeFetcher.optimizeViews();

      // Clean up old downloads
      await sdeFetcher.cleanup();

      // Disable force reimport if it was enabled
      if (forceReimport) {
        sdeFetcher.disableForceReimport();
      }

      logger.success('All done!');
    } catch (error) {
      logger.error('Error:', { error: String(error) });
      process.exit(1);
    }
  },
};

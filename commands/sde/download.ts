import { sdeFetcher as defaultSdeFetcher } from '../../server/helpers/sde/fetcher';
import chalk from 'chalk';
import { logger } from '../../server/helpers/logger';
import {
  mapRegionsConfig,
  mapConstellationsConfig,
  mapSolarSystemsConfig,
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
      defaultSdeFetcher.enableForceReimport();
    }

    logger.info('Starting SDE sync and import...');

    try {
      // Sync (download if needed, extract)
      const metadata = await defaultSdeFetcher.sync();

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
      const tables = await defaultSdeFetcher.listExtractedTables();
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

      // Map tables (order matters: regions → constellations → systems)
      await defaultSdeFetcher.importConfiguredTable(mapRegionsConfig);
      await defaultSdeFetcher.importConfiguredTable(mapConstellationsConfig);
      await defaultSdeFetcher.importConfiguredTable(mapSolarSystemsConfig);

      // Post-process map tables to populate missing relationships
      await defaultSdeFetcher.postProcessMapTables();

      // Continue with other map tables
      await defaultSdeFetcher.importConfiguredTable(mapStargatesConfig);
      await defaultSdeFetcher.importConfiguredTable(mapStarsConfig);
      await defaultSdeFetcher.importConfiguredTable(mapPlanetsConfig);
      await defaultSdeFetcher.importConfiguredTable(mapMoonsConfig);
      await defaultSdeFetcher.importConfiguredTable(mapAsteroidBeltsConfig);

      // Item/Type tables
      await defaultSdeFetcher.importConfiguredTable(typesConfig);
      await defaultSdeFetcher.importConfiguredTable(groupsConfig);
      await defaultSdeFetcher.importConfiguredTable(categoriesConfig);

      // NPC tables
      await defaultSdeFetcher.importConfiguredTable(npcCorporationsConfig);
      await defaultSdeFetcher.importConfiguredTable(npcStationsConfig);
      await defaultSdeFetcher.importConfiguredTable(stationOperationsConfig);
      await defaultSdeFetcher.importConfiguredTable(npcCharactersConfig);

      // Character attributes
      await defaultSdeFetcher.importConfiguredTable(factionsConfig);
      await defaultSdeFetcher.importConfiguredTable(racesConfig);
      await defaultSdeFetcher.importConfiguredTable(bloodlinesConfig);
      await defaultSdeFetcher.importConfiguredTable(ancestriesConfig);

      // Market/Meta tables
      await defaultSdeFetcher.importConfiguredTable(marketGroupsConfig);
      await defaultSdeFetcher.importConfiguredTable(metaGroupsConfig);
      await defaultSdeFetcher.importConfiguredTable(skinsConfig);

      // Dogma tables
      await defaultSdeFetcher.importConfiguredTable(dogmaAttributesConfig);
      await defaultSdeFetcher.importConfiguredTable(dogmaEffectsConfig);

      // Optimize materialized views
      await defaultSdeFetcher.optimizeViews();

      // Clean up old downloads
      await defaultSdeFetcher.cleanup();

      // Disable force reimport if it was enabled
      if (forceReimport) {
        defaultSdeFetcher.disableForceReimport();
      }

      logger.success('All done!');
      process.exit(0);
    } catch (error) {
      logger.error('Error:', { error: String(error) });
      process.exit(1);
    }
  },
};

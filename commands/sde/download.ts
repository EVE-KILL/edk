import { sdeFetcher } from '../../server/helpers/sde/fetcher'
import chalk from 'chalk'
import { logger } from '../../server/helpers/logger'
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
  dogmaEffectsConfig
} from '../../server/helpers/sde/configs'

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
      description: 'Force re-import all tables (useful for SDE updates and testing deduplication)'
    }
  ],

  async action(options: any) {
    const forceReimport = options.force || false

    if (forceReimport) {
      logger.warn('FORCE REIMPORT MODE ENABLED')
      sdeFetcher.enableForceReimport()
    }

    logger.info('Starting SDE sync and import...')

    try {
      // Sync (download if needed, extract)
      const metadata = await sdeFetcher.sync()

      logger.success('SDE sync completed!')
      logger.info('Metadata:', {
        buildNumber: metadata.buildNumber,
        variant: metadata.variant,
        downloadedAt: new Date(metadata.downloadedAt).toISOString(),
        extractedAt: metadata.extractedAt ? new Date(metadata.extractedAt).toISOString() : 'N/A',
        url: metadata.url
      })

      // List available tables
      const tables = await sdeFetcher.listExtractedTables()
      logger.info(`Available tables: ${chalk.yellow(tables.length.toString())} total`)

      // Group tables by type
      const typeGroups = new Map<string, string[]>()
      for (const table of tables) {
        const prefix = table.split(/(?=[A-Z])/)[0] || 'other'
        if (!typeGroups.has(prefix)) {
          typeGroups.set(prefix, [])
        }
        typeGroups.get(prefix)!.push(table)
      }

      for (const [prefix, tbls] of Array.from(typeGroups.entries()).sort()) {
        logger.debug(`${prefix}: ${chalk.cyan(tbls.map(t => t).join(', '))}`)
      }

      // Import tables
      logger.info('Importing tables...')

      // First batch - already implemented with special handling
      await sdeFetcher.importMapSolarSystems()
      await sdeFetcher.importMapRegions()
      await sdeFetcher.importMapConstellations()

      // Map tables
      await sdeFetcher.importTable(mapStargatesConfig.name, mapStargatesConfig.mappings)
      await sdeFetcher.importTable(mapStarsConfig.name, mapStarsConfig.mappings)
      await sdeFetcher.importTable(mapPlanetsConfig.name, mapPlanetsConfig.mappings)
      await sdeFetcher.importTable(mapMoonsConfig.name, mapMoonsConfig.mappings)
      await sdeFetcher.importTable(mapAsteroidBeltsConfig.name, mapAsteroidBeltsConfig.mappings)

      // Item/Type tables
      await sdeFetcher.importTable(typesConfig.name, typesConfig.mappings)
      await sdeFetcher.importTable(groupsConfig.name, groupsConfig.mappings)
      await sdeFetcher.importTable(categoriesConfig.name, categoriesConfig.mappings)

      // NPC tables
      await sdeFetcher.importTable(npcCorporationsConfig.name, npcCorporationsConfig.mappings)
      await sdeFetcher.importTable(npcStationsConfig.name, npcStationsConfig.mappings)
      await sdeFetcher.importTable(stationOperationsConfig.name, stationOperationsConfig.mappings)
      await sdeFetcher.importTable(npcCharactersConfig.name, npcCharactersConfig.mappings)

      // Character attributes
      await sdeFetcher.importTable(factionsConfig.name, factionsConfig.mappings)
      await sdeFetcher.importTable(racesConfig.name, racesConfig.mappings)
      await sdeFetcher.importTable(bloodlinesConfig.name, bloodlinesConfig.mappings)
      await sdeFetcher.importTable(ancestriesConfig.name, ancestriesConfig.mappings)

      // Market/Meta tables
      await sdeFetcher.importTable(marketGroupsConfig.name, marketGroupsConfig.mappings)
      await sdeFetcher.importTable(metaGroupsConfig.name, metaGroupsConfig.mappings)
      await sdeFetcher.importTable(skinsConfig.name, skinsConfig.mappings)

      // Dogma tables
      await sdeFetcher.importTable(dogmaAttributesConfig.name, dogmaAttributesConfig.mappings)
      await sdeFetcher.importTable(dogmaEffectsConfig.name, dogmaEffectsConfig.mappings)

      // Optimize materialized views
      await sdeFetcher.optimizeViews()

      // Clean up old downloads
      await sdeFetcher.cleanup()

      // Disable force reimport if it was enabled
      if (forceReimport) {
        sdeFetcher.disableForceReimport()
      }

      logger.success('All done!')
    } catch (error) {
      logger.error('Error:', { error: String(error) })
      process.exit(1)
    }
  }
}

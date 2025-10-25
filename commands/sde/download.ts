import { sdeFetcher } from '../../server/helpers/sde'
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
      console.log('⚠️  FORCE REIMPORT MODE ENABLED\n')
      sdeFetcher.enableForceReimport()
    }

    console.log('🚀 Starting SDE sync and import...\n')

    try {
      // Sync (download if needed, extract)
      const metadata = await sdeFetcher.sync()

      console.log('\n✅ SDE sync completed!\n')
      console.log('📊 Metadata:')
      console.log(`   Build Number: ${metadata.buildNumber}`)
      console.log(`   Variant: ${metadata.variant}`)
      console.log(`   Downloaded: ${new Date(metadata.downloadedAt).toISOString()}`)
      if (metadata.extractedAt) {
        console.log(`   Extracted: ${new Date(metadata.extractedAt).toISOString()}`)
      }
      console.log(`   URL: ${metadata.url}`)

      // List available tables
      const tables = await sdeFetcher.listExtractedTables()
      console.log(`\n📋 Available tables (${tables.length}):`)

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
        console.log(`\n   ${prefix}:`)
        for (const table of tbls.sort()) {
          console.log(`      • ${table}`)
        }
      }

      // Import tables
      console.log('\n\n📥 Importing tables...\n')

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
      console.log('\n')
      await sdeFetcher.cleanup()

      // Disable force reimport if it was enabled
      if (forceReimport) {
        sdeFetcher.disableForceReimport()
      }

      console.log('\n✅ All done!')
    } catch (error) {
      console.error('❌ Error:', error)
      process.exit(1)
    }
  }
}

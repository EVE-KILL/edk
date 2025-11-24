import logger from '../../server/helpers/logger';

import {
  typesense,
  searchCollectionSchema,
} from '../../server/helpers/typesense';
import { database } from '../../server/helpers/database';

export default {
  action: async () => {
    logger.info('Seeding search index...');

    try {
      // Test Typesense connection first
      try {
        await typesense.collections().retrieve();
        logger.info('✅ Connected to Typesense');
      } catch (error: any) {
        logger.error('❌ Failed to connect to Typesense:', error.message);
        logger.error(
          'Make sure Typesense is running (docker-compose up -d typesense)'
        );
        await database.close();
        process.exit(1);
      }

      try {
        await typesense.collections('search').delete();
        logger.info('Deleted existing search collection');
      } catch {
        // Ignore if collection doesn't exist
      }

      await typesense.collections().create(searchCollectionSchema);
      logger.info('Created search collection');

      // Fetch data from database
      logger.info('Fetching characters...');
      const characters = await database.find<{ id: number; name: string }>(
        `SELECT "characterId" as id, name FROM characters WHERE name IS NOT NULL`
      );
      logger.info(`Found ${characters.length} characters`);

      logger.info('Fetching corporations...');
      const corporations = await database.find<{ id: number; name: string }>(
        `SELECT "corporationId" as id, name FROM corporations WHERE name IS NOT NULL`
      );
      logger.info(`Found ${corporations.length} corporations`);

      logger.info('Fetching alliances...');
      const alliances = await database.find<{ id: number; name: string }>(
        `SELECT "allianceId" as id, name FROM alliances WHERE name IS NOT NULL`
      );
      logger.info(`Found ${alliances.length} alliances`);

      logger.info('Fetching ship types...');
      const shipTypes = await database.find<{ id: number; name: string }>(
        `SELECT "typeId" as id, name FROM types WHERE name IS NOT NULL AND "published" = true`
      );
      logger.info(`Found ${shipTypes.length} ship types`);

      logger.info('Fetching solar systems...');
      const systems = await database.find<{ id: number; name: string }>(
        `SELECT "solarSystemId" as id, name FROM solarSystems WHERE name IS NOT NULL`
      );
      logger.info(`Found ${systems.length} solar systems`);

      logger.info('Fetching constellations...');
      const constellations = await database.find<{ id: number; name: string }>(
        `SELECT "constellationId" as id, name FROM constellations WHERE name IS NOT NULL`
      );
      logger.info(`Found ${constellations.length} constellations`);

      logger.info('Fetching regions...');
      const regions = await database.find<{ id: number; name: string }>(
        `SELECT "regionId" as id, name FROM regions WHERE name IS NOT NULL`
      );
      logger.info(`Found ${regions.length} regions`);

      // Build documents array - Typesense requires id to be a string
      const documents = [
        ...characters.map((c) => ({
          id: `character-${c.id}`,
          name: c.name,
          type: 'character',
        })),
        ...corporations.map((c) => ({
          id: `corporation-${c.id}`,
          name: c.name,
          type: 'corporation',
        })),
        ...alliances.map((a) => ({
          id: `alliance-${a.id}`,
          name: a.name,
          type: 'alliance',
        })),
        ...shipTypes.map((i) => ({
          id: `item-${i.id}`,
          name: i.name,
          type: 'item',
        })),
        ...systems.map((s) => ({
          id: `system-${s.id}`,
          name: s.name,
          type: 'system',
        })),
        ...constellations.map((c) => ({
          id: `constellation-${c.id}`,
          name: c.name,
          type: 'constellation',
        })),
        ...regions.map((r) => ({
          id: `region-${r.id}`,
          name: r.name,
          type: 'region',
        })),
      ];

      logger.info(`Importing ${documents.length} documents to Typesense...`);

      // Import in batches to avoid timeout issues
      const batchSize = 1000;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        try {
          const result = await typesense
            .collections('search')
            .documents()
            .import(batch, { action: 'upsert' });
          logger.info(
            `Imported batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)}`
          );

          // Check for any errors in the import result
          if (result && Array.isArray(result)) {
            const errors = result.filter((r: any) => !r.success);
            if (errors.length > 0) {
              logger.info(
                `⚠️  ${errors.length} documents failed in this batch`
              );
              logger.info('First error:', JSON.stringify(errors[0], null, 2));
            }
          }
        } catch (error: any) {
          logger.error(
            `❌ Error importing batch ${Math.floor(i / batchSize) + 1}:`,
            error.message
          );
          if (error.importResults && error.importResults.length > 0) {
            logger.info(
              'First failed document:',
              JSON.stringify(error.importResults[0], null, 2)
            );
          }
          throw error;
        }
      }

      logger.info('✅ Search index seeded successfully!');
    } catch {
      logger.error('Error seeding search index:', error);
      process.exit(1);
    } finally {
      await database.close();
      process.exit(0);
    }
  },
};

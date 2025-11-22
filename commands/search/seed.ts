import {
  typesense,
  searchCollectionSchema,
} from '../../server/helpers/typesense';
import { database } from '../../server/helpers/database';

export default {
  action: async () => {
    console.log('Seeding search index...');

    try {
      try {
        await typesense.collections('search').delete();
      } catch (error) {
        // Ignore if collection doesn't exist
      }

      await typesense.collections().create(searchCollectionSchema);

      // Fetch data from database
      console.log('Fetching characters...');
      const characters =
        await database.sql`SELECT "characterId" as id, name FROM characters WHERE name IS NOT NULL`;
      console.log(`Found ${characters.length} characters`);

      console.log('Fetching corporations...');
      const corporations =
        await database.sql`SELECT "corporationId" as id, name FROM corporations WHERE name IS NOT NULL`;
      console.log(`Found ${corporations.length} corporations`);

      console.log('Fetching alliances...');
      const alliances =
        await database.sql`SELECT "allianceId" as id, name FROM alliances WHERE name IS NOT NULL`;
      console.log(`Found ${alliances.length} alliances`);

      console.log('Fetching ship types...');
      const shipTypes =
        await database.sql`SELECT "typeId" as id, name FROM types WHERE name IS NOT NULL AND "published" = true`;
      console.log(`Found ${shipTypes.length} ship types`);

      console.log('Fetching solar systems...');
      const systems =
        await database.sql`SELECT "solarSystemId" as id, name FROM solarSystems WHERE name IS NOT NULL`;
      console.log(`Found ${systems.length} solar systems`);

      console.log('Fetching constellations...');
      const constellations =
        await database.sql`SELECT "constellationId" as id, name FROM constellations WHERE name IS NOT NULL`;
      console.log(`Found ${constellations.length} constellations`);

      console.log('Fetching regions...');
      const regions =
        await database.sql`SELECT "regionId" as id, name FROM regions WHERE name IS NOT NULL`;
      console.log(`Found ${regions.length} regions`);

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

      console.log(`Importing ${documents.length} documents to Typesense...`);

      // Import in batches to avoid timeout issues
      const batchSize = 1000;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        try {
          const result = await typesense
            .collections('search')
            .documents()
            .import(batch, { action: 'upsert' });
          console.log(
            `Imported batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)}`
          );

          // Check for any errors in the import result
          if (result && Array.isArray(result)) {
            const errors = result.filter((r: any) => !r.success);
            if (errors.length > 0) {
              console.log(
                `⚠️  ${errors.length} documents failed in this batch`
              );
              console.log('First error:', JSON.stringify(errors[0], null, 2));
            }
          }
        } catch (error: any) {
          console.error(
            `❌ Error importing batch ${Math.floor(i / batchSize) + 1}:`,
            error.message
          );
          if (error.importResults && error.importResults.length > 0) {
            console.log(
              'First failed document:',
              JSON.stringify(error.importResults[0], null, 2)
            );
          }
          throw error;
        }
      }

      console.log('✅ Search index seeded successfully!');
    } catch (error) {
      console.error('Error seeding search index:', error);
    } finally {
      await database.close();
    }
  },
};

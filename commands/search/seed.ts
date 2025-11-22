import { Command } from 'commander';
import { typesense } from '../../server/helpers/typesense';
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

    await typesense.collections().create({
      name: 'search',
      fields: [
        { name: 'name', type: 'string' },
        { name: 'type', type: 'string', facet: true },
        { name: 'id', type: 'int64' },
      ],
      default_sorting_field: 'name',
    });

    const characters = await database.sql`SELECT "characterId" as id, name FROM characters`;
    const corporations = await database.sql`SELECT id, name FROM corporations`;
    const alliances = await database.sql`SELECT id, name FROM alliances`;
    const invTypes = await database.sql`SELECT "typeID" as id, "typeName" as name FROM "invTypes"`;
    const systems = await database.sql`SELECT "solarSystemID" as id, "solarSystemName" as name FROM "mapSolarSystems"`;
    const constellations = await database.sql`SELECT "constellationID" as id, "constellationName" as name FROM "mapConstellations"`;
    const regions = await database.sql`SELECT "regionID" as id, "regionName" as name FROM "mapRegions"`;

    const documents = [
      ...characters.map((c) => ({ ...c, type: 'character' })),
      ...corporations.map((c) => ({ ...c, type: 'corporation' })),
      ...alliances.map((a) => ({ ...a, type: 'alliance' })),
      ...invTypes.map((i) => ({ ...i, type: 'item' })),
      ...systems.map((s) => ({ ...s, type: 'system' })),
      ...constellations.map((c) => ({ ...c, type: 'constellation' })),
      ...regions.map((r) => ({ ...r, type: 'region' })),
    ];

    await typesense.collections('search').documents().import(documents, { action: 'create' });

    console.log('Search index seeded successfully.');
  } catch (error) {
    console.error('Error seeding search index:', error);
  } finally {
    await database.close();
  }
  },
};

// commands/seed-wars.ts
import { database } from '../server/helpers/database';
import { seedAlliances } from '../tests/helpers/seed';
import { seedCorporations } from '../tests/helpers/seed';

async function seedWars() {
  console.log('Seeding wars...');

  // 1. Seed Alliances and Corporations
  const alliances = await seedAlliances(2);
  const corporations = await seedCorporations(2);

  // 2. Create Wars
  const wars = [
    {
      warId: 1,
      aggressorAllianceId: alliances[0]!.allianceId,
      aggressorCorporationId: null,
      defenderAllianceId: alliances[1]!.allianceId,
      defenderCorporationId: null,
      declared: new Date(),
    },
    {
      warId: 2,
      aggressorAllianceId: null,
      aggressorCorporationId: corporations[0]!.corporationId,
      defenderAllianceId: null,
      defenderCorporationId: corporations[1]!.corporationId,
      declared: new Date(),
    },
    {
      warId: 3,
      aggressorAllianceId: alliances[0]!.allianceId,
      aggressorCorporationId: null,
      defenderAllianceId: null,
      defenderCorporationId: corporations[1]!.corporationId,
      declared: new Date(),
    }
  ];

  await database.bulkUpsert('wars', wars, 'warId');

  console.log('Seeding complete!');
  await database.close();
}

seedWars();

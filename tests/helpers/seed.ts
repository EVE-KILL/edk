import { database } from '../../server/helpers/database';

export async function seedKillmails(count: number = 10) {
  const killmails = [];
  const now = new Date();

  for (let i = 1; i <= count; i++) {
    killmails.push({
      killmailId: i,
      killmailTime: new Date(now.getTime() - i * 3600000).toISOString(), // 1 hour apart
      solarSystemId: 30000142, // Jita
      victimCharacterId: 1000 + i,
      victimCorporationId: 2000 + i,
      victimAllianceId: 3000 + i,
      victimShipTypeId: 603, // Merlin
      victimDamageTaken: 1000,
      totalValue: 1000000 * i,
      hash: 'hash' + i,
    });
  }
  await database.bulkUpsert('killmails', killmails, 'killmailId');
  return killmails;
}

export async function seedCharacters(count: number = 10) {
  const chars = [];
  for (let i = 1; i <= count; i++) {
    chars.push({
      characterId: 1000 + i,
      name: `Character ${i}`,
      corporationId: 2000 + i,
      allianceId: 3000 + i,
      securityStatus: 0.5,
    });
  }
  await database.bulkUpsert('characters', chars, 'characterId');
  return chars;
}

export async function seedCorporations(count: number = 10) {
  const corps = [];
  for (let i = 1; i <= count; i++) {
    corps.push({
      corporationId: 2000 + i,
      name: `Corporation ${i}`,
      allianceId: 3000 + i,
      ticker: `CORP${i}`,
    });
  }
  await database.bulkUpsert('corporations', corps, 'corporationId');
  return corps;
}

export async function seedAlliances(count: number = 10) {
  const alliances = [];
  for (let i = 1; i <= count; i++) {
    alliances.push({
      allianceId: 3000 + i,
      name: `Alliance ${i}`,
      ticker: `ALL${i}`,
    });
  }
  await database.bulkUpsert('alliances', alliances, 'allianceId');
  return alliances;
}

export async function clearTables(tables: string[]) {
  for (const table of tables) {
    await database.sql`TRUNCATE TABLE ${database.sql(table)} RESTART IDENTITY CASCADE`;
  }
}

import { database } from '../../server/helpers/database';

export async function seedKillmails(count: number = 10, startId: number = 1) {
    const killmails = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
        const id = startId + i;
        killmails.push({
            killmailId: id,
            killmailTime: new Date(now.getTime() - i * 3600000).toISOString(), // 1 hour apart
            solarSystemId: 30000142, // Jita
            victimCharacterId: 1000 + id,
            victimCorporationId: 2000 + id,
            victimAllianceId: 3000 + id,
            victimShipTypeId: 603, // Merlin
            victimDamageTaken: 1000,
            totalValue: 1000000 * id,
            hash: 'hash' + id
        });
    }
    // Using bulkInsert is safer for seeding new data, but bulkUpsert is now fixed and safe too.
    // Stick to bulkInsert for explicit intention of "new data".
    await database.bulkInsert('killmails', killmails);
    return killmails;
}

export async function seedCharacters(count: number = 10, startId: number = 1) {
    const chars = [];
    for (let i = 0; i < count; i++) {
        const id = 1000 + startId + i;
        chars.push({
            characterId: id,
            name: `Character ${id}`,
            corporationId: 2000 + startId + i,
            allianceId: 3000 + startId + i,
            securityStatus: 0.5
        });
    }
    await database.bulkInsert('characters', chars);
    return chars;
}

export async function seedCorporations(count: number = 10, startId: number = 1) {
    const corps = [];
    for (let i = 0; i < count; i++) {
        const id = 2000 + startId + i;
        corps.push({
            corporationId: id,
            name: `Corporation ${id}`,
            allianceId: 3000 + startId + i,
            ticker: `CORP${id}`
        });
    }
    await database.bulkInsert('corporations', corps);
    return corps;
}

export async function seedAlliances(count: number = 10, startId: number = 1) {
    const alliances = [];
    for (let i = 0; i < count; i++) {
        const id = 3000 + startId + i;
        alliances.push({
            allianceId: id,
            name: `Alliance ${id}`,
            ticker: `ALL${id}`
        });
    }
    await database.bulkInsert('alliances', alliances);
    return alliances;
}

export async function clearTables(tables: string[]) {
    for (const table of tables) {
        await database.execute(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
    }
}

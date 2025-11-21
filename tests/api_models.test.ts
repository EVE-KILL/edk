import { describe, it, expect, beforeAll } from 'bun:test';
import { seedKillmails, clearTables } from './helpers/seed';
import { getKillmail, killmailExists } from '../server/models/killmails';

describe('Killmail Model (API Backend)', () => {
    beforeAll(async () => {
        await clearTables(['killmails', 'characters', 'items', 'attackers']);
        await seedKillmails(5);
    });

    it('should check if killmail exists', async () => {
        const exists = await killmailExists(1);
        expect(exists).toBe(true);

        const notExists = await killmailExists(999);
        expect(notExists).toBe(false);
    });

    it('should retrieve a killmail by ID with ESI format', async () => {
        const km = await getKillmail(1);
        expect(km).not.toBeNull();
        if (km) {
            expect(km.killmail_id).toBe(1);
            expect(km.victim.damage_taken).toBe(1000);
            expect(km.victim.ship_type_id).toBe(603);
            expect(km.solar_system_id).toBe(30000142);
        }
    });

    it('should return null for non-existent killmail', async () => {
        const km = await getKillmail(999);
        expect(km).toBeNull();
    });
});

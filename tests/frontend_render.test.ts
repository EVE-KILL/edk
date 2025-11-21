import { describe, it, expect } from 'bun:test';
import { normalizeKillRow, render } from '../server/helpers/templates';

describe('Frontend Rendering & Helpers', () => {
    describe('normalizeKillRow', () => {
        it('should normalize killmail row correctly', () => {
            const row = {
                killmailId: 123,
                victimShipTypeId: 603,
                victimShipName: 'Merlin',
                victimCharacterName: 'Char A',
                victimCorporationName: 'Corp A',
                killmailTime: new Date('2023-01-01T12:00:00Z')
            };
            const normalized = normalizeKillRow(row);
            expect(normalized.killmailId).toBe(123);
            expect(normalized.victim.ship.name).toBe('Merlin');
            expect(normalized.victim.character.name).toBe('Char A');
            expect(normalized.victim.corporation.name).toBe('Corp A');
            expect(normalized.killmailTime).toBe('2023-01-01T12:00:00.000Z');
        });

        it('should handle missing optional fields', () => {
             const row = {
                killmailId: 456,
                victimShipTypeId: 0
             };
             const normalized = normalizeKillRow(row);
             expect(normalized.killmailId).toBe(456);
             expect(normalized.victim.character.name).toBe('Unknown');
        });
    });

    describe('Template Rendering', () => {
        // This test assumes templates/default/pages/home.hbs and layouts/main.hbs exist.
        // If they don't, this might fail.
        // We'll skip if file not found in a real scenario, but here we want to ensure they work if present.

        it('should render a template if it exists', async () => {
            // We expect 'pages/home.hbs' to exist as it is used in the application.
            // This test ensures the template file is present and the render function works.

            // Passing useLayout=false to avoid dependency on layout file if possible,
            // but render defaults to using layout.
            const html = await render('pages/home.hbs', { title: 'Test' }, { killmails: [] }, undefined, false);

            expect(html).toBeDefined();
            expect(typeof html).toBe('string');
            expect(html.length).toBeGreaterThan(0);
        });
    });
});

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
        /**
         * Prerequisite: The template file 'templates/default/pages/home.hbs' must exist for this test to run.
         * If the template is missing, the test will be skipped.
         */
        it('should render a template if it exists', async () => {
            // Check if the required template file exists before running the test
            const templatePath = 'templates/default/pages/home.hbs';
            if (!(await Bun.file(templatePath).exists())) {
                // Skip the test if the template is missing
                console.warn(`Skipping render test: Required template '${templatePath}' not found.`);
                return;
            }
            // Passing useLayout=false to avoid dependency on layout file if possible
            const html = await render('pages/home.hbs', { title: 'Test' }, { killmails: [] }, undefined, false);
            expect(html).toBeDefined();
            expect(typeof html).toBe('string');
            // We expect some HTML content
        });
    });
});

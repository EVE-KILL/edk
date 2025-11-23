import { describe, it, expect, beforeAll } from 'bun:test';
import { normalizeKillRow, render } from '../server/helpers/templates';
import { refreshEnv } from '../server/helpers/env';

// Mock logger for tests since it's auto-imported in Nitro but not available in test context
beforeAll(() => {
  // @ts-ignore - logger is auto-imported in Nitro context
  global.logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    success: () => {},
  };
});

describe('Frontend Rendering & Helpers', () => {
  describe('normalizeKillRow', () => {
    it('should normalize killmail row correctly', () => {
      const row = {
        killmailId: 123,
        victimShipTypeId: 603,
        victimShipName: 'Merlin',
        victimCharacterName: 'Char A',
        victimCorporationName: 'Corp A',
        killmailTime: new Date('2023-01-01T12:00:00Z'),
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
        victimShipTypeId: 0,
      };
      const normalized = normalizeKillRow(row);
      expect(normalized.killmailId).toBe(456);
      expect(normalized.victim.character.name).toBe('Unknown');
    });
  });

  describe('Template Rendering', () => {
    it('should render a template without layout', async () => {
      // Set theme to test to use test fixtures
      const originalTheme = process.env.THEME;
      process.env.THEME = 'test';
      refreshEnv();

      try {
        const html = await render(
          'pages/test-page.hbs',
          { title: 'Test Page' },
          { message: 'Hello World', items: ['Item 1', 'Item 2'] },
          undefined,
          false // no layout
        );

        expect(html).toBeDefined();
        expect(typeof html).toBe('string');
        expect(html).toContain('Test Page');
        expect(html).toContain('Hello World');
        expect(html).toContain('Item 1');
        expect(html).toContain('Item 2');
      } finally {
        // Restore original theme
        if (originalTheme !== undefined) {
          process.env.THEME = originalTheme;
        } else {
          delete process.env.THEME;
        }
        refreshEnv();
      }
    });

    it('should render a template with layout', async () => {
      // Set theme to test to use test fixtures
      const originalTheme = process.env.THEME;
      process.env.THEME = 'test';
      refreshEnv();

      try {
        const html = await render(
          'pages/test-page.hbs',
          { title: 'Test Page' },
          { message: 'Test Message' },
          undefined,
          true, // with layout
          'layouts/test-layout.hbs'
        );

        expect(html).toBeDefined();
        expect(typeof html).toBe('string');
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('<title>Test Page');
        expect(html).toContain('Test Message');
        expect(html).toContain('EVE-KILL');
      } finally {
        // Restore original theme
        if (originalTheme !== undefined) {
          process.env.THEME = originalTheme;
        } else {
          delete process.env.THEME;
        }
        refreshEnv();
      }
    });
  });
});

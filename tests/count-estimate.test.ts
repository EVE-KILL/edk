import { describe, test, expect } from 'bun:test';
import {
  estimateCount,
  getTableEstimate,
  formatCount,
} from '../server/helpers/count-estimate';
import { database } from '../server/helpers/database';

describe('Count Estimation', () => {
  test('estimateCount returns a number', async () => {
    // Test with a simple query
    const estimate = await estimateCount(
      database.sql`SELECT 1 FROM killmails WHERE "killmailTime" > NOW() - INTERVAL '7 days'`
    );

    expect(typeof estimate).toBe('number');
    expect(estimate).toBeGreaterThanOrEqual(0);
  });

  test('getTableEstimate returns total rows', async () => {
    const estimate = await getTableEstimate('killmails_%');

    expect(typeof estimate).toBe('number');
    expect(estimate).toBeGreaterThanOrEqual(0);
  });

  test('formatCount formats numbers correctly', () => {
    expect(formatCount(1234, false)).toBe('1,234');
    expect(formatCount(1234, true)).toBe('~1,234');
    expect(formatCount(12345, true)).toBe('~12.3k');
    expect(formatCount(1234567, true)).toBe('~1.2M');
  });

  test('estimateCount handles empty results', async () => {
    const estimate = await estimateCount(
      database.sql`SELECT 1 FROM killmails WHERE 1=0`
    );

    expect(estimate).toBe(0);
  });
});

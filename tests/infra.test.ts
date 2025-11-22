import { describe, it, expect } from 'bun:test';
import { database } from './setup';

describe('Infrastructure', () => {
  it('should be connected to the test database', async () => {
    const [result] = await database.sql<
      { current_database: string }[]
    >`SELECT current_database()`;
    const dbName = result?.current_database;
    expect(dbName).toBe('edk_test');
  });

  it('should have required tables in public schema', async () => {
    const exists = await database.tableExists('migrations');
    expect(exists).toBe(true);

    const killmailsExists = await database.tableExists('killmails');
    expect(killmailsExists).toBe(true);
  });
});

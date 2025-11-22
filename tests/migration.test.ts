import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { database } from '../server/helpers/database';
import { migrateSchema } from '../server/plugins/schema-migration';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_MIGRATION_FILE = '99-test-migration.sql';
const TEST_MIGRATION_PATH = join(process.cwd(), 'db', TEST_MIGRATION_FILE);

describe('Schema Migration', () => {
  beforeAll(async () => {
    // Cleanup potential leftovers
    try {
      await database.sql`DROP TABLE IF EXISTS test_migration_table`;
      await database.sql`DELETE FROM migrations WHERE filename = ${TEST_MIGRATION_FILE}`;
      if (existsSync(TEST_MIGRATION_PATH)) {
        unlinkSync(TEST_MIGRATION_PATH);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  afterAll(async () => {
    // Cleanup
    try {
      await database.sql`DROP TABLE IF EXISTS test_migration_table`;
      await database.sql`DELETE FROM migrations WHERE filename = ${TEST_MIGRATION_FILE}`;
      if (existsSync(TEST_MIGRATION_PATH)) {
        unlinkSync(TEST_MIGRATION_PATH);
      }
    } catch (e) {
      console.error('Cleanup failed', e);
    }
  });

  test('should run initial migration and create table', async () => {
    // Create migration file
    writeFileSync(
      TEST_MIGRATION_PATH,
      `
            CREATE TABLE IF NOT EXISTS test_migration_table (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL
            );
        `
    );

    // Run migration
    await migrateSchema();

    // Verify table exists
    // database.tableExists uses legacy queryValue, which we verify works, or we can check manually
    const result =
      await database.sql`SELECT 1 FROM information_schema.tables WHERE table_name = 'test_migration_table'`;
    expect(result.length).toBe(1);

    // Verify checksum stored
    const checksumResult = await database.sql`
            SELECT checksum FROM migrations WHERE filename = ${TEST_MIGRATION_FILE} ORDER BY id DESC LIMIT 1
        `;
    expect(checksumResult.length).toBe(1);
    expect(checksumResult[0].checksum).toBeDefined();
  });

  test('should detect schema changes and add new column', async () => {
    // Modify migration file to add a new column
    writeFileSync(
      TEST_MIGRATION_PATH,
      `
            CREATE TABLE IF NOT EXISTS test_migration_table (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                new_column INTEGER DEFAULT 0
            );
        `
    );

    // Run migration again
    await migrateSchema();

    // Verify new column exists
    const columns = await database.sql`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'test_migration_table'
        `;

    const hasNewColumn = columns.some((c) => c.column_name === 'new_column');
    expect(hasNewColumn).toBe(true);

    // Verify it has the correct type (approximate check)
    const col = columns.find((c) => c.column_name === 'new_column');
    expect(col?.data_type).toMatch(/integer/i);
  });

  test('should handle complex defaults properly (parser test)', async () => {
    // Modify migration file to add a column with complex default containing comma
    writeFileSync(
      TEST_MIGRATION_PATH,
      `
            CREATE TABLE IF NOT EXISTS test_migration_table (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                new_column INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending,active'
            );
        `
    );

    // Run migration again
    await migrateSchema();

    // Verify new column exists
    const columns = await database.sql`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'test_migration_table'
        `;

    const hasStatusColumn = columns.some((c) => c.column_name === 'status');
    expect(hasStatusColumn).toBe(true);

    const col = columns.find((c) => c.column_name === 'status');
    expect(col?.column_default).toContain('pending,active');
  });
});

import postgres from 'postgres';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

// Configuration
const TEST_DB = process.env.TEST_DB_NAME || 'edk_test';
const DB_USER = process.env.DB_USER || 'edk_user';
const DB_PASS = process.env.DB_PASSWORD || 'edk_password';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432');
const DEFAULT_DB = process.env.DB_NAME || 'edk';

// Use the provided admin connection string or construct one
// We need a connection to a database that exists (like 'postgres' or the default app db) to create the test db
const ADMIN_DATABASE = process.env.ADMIN_DB_NAME || DEFAULT_DB;
const adminUrl =
  process.env.ADMIN_DATABASE_URL ||
  `postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${ADMIN_DATABASE}`;

import { beforeAll } from 'bun:test';

beforeAll(async () => {
  console.log('🛠️  Initializing Test Environment...');

  // 1. Set Environment Variables for the Application
  // These must be set before importing app modules
  process.env.TEST_DB_NAME = TEST_DB;
  process.env.DATABASE_URL = `postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${TEST_DB}`;
  process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
  process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
  process.env.NODE_ENV = 'test';

  // 2. Cleanup Previous State
  // Remove checksum file to force migration to ensure schema is up to date
  const DATA_DIR = join(process.cwd(), '.data');
  const CHECKSUM_FILE = join(DATA_DIR, 'schema-checksums.json');
  if (existsSync(CHECKSUM_FILE)) {
    unlinkSync(CHECKSUM_FILE);
  }

  // 3. Recreate Database
  const sql = postgres(adminUrl);
  try {
    // Force disconnect others
    await sql`
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = ${TEST_DB}
          AND pid <> pg_backend_pid()
      `.catch(() => {});

    await sql.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
    await sql.unsafe(`CREATE DATABASE "${TEST_DB}"`);
  } catch (e) {
    console.error('Failed to recreate test database:', e);
    console.error(
      'Database:',
      DB_HOST,
      'Port:',
      DB_PORT,
      'Name:',
      ADMIN_DATABASE
    );
    process.exit(1);
  } finally {
    await sql.end();
  }

  // 4. Force DatabaseHelper to use the new URL
  // This is crucial because DatabaseHelper might have been initialized
  // with the default URL before this script runs.
  const { database } = await import('../server/helpers/database');
  await database.setUrl(process.env.DATABASE_URL);

  // 5. Run Migrations
  try {
    const { applyMigrations } = await import('../server/helpers/migrator');
    await applyMigrations();
  } catch (e) {
    console.error('Failed to run migrations:', e);
    process.exit(1);
  }

  console.log('✅ Test Environment Ready.\n');
});

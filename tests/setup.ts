import { beforeAll, afterAll } from 'bun:test';
import postgres from 'postgres';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { database } from '../server/helpers/database';

// Configuration
const TEST_DB = process.env.TEST_DB_NAME || 'edk_test';
const DB_USER = process.env.DB_USER || 'edk_user';
const DB_PASS = process.env.DB_PASSWORD || 'edk_password';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432');
const DEFAULT_DB = process.env.DB_NAME || 'edk';

// Use the provided admin connection string or construct one
const ADMIN_DATABASE = process.env.ADMIN_DB_NAME || DEFAULT_DB;
const adminUrl = process.env.ADMIN_DATABASE_URL || `postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${ADMIN_DATABASE}`;

beforeAll(async () => {
  console.log('🛠️  Initializing Test Environment...');

  // 1. Set Environment Variables for the Application
  process.env.TEST_DB_NAME = TEST_DB;
  process.env.DATABASE_URL = `postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${TEST_DB}`;
  process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
  process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
  process.env.NODE_ENV = 'test';

  // 2. Cleanup Previous State
  const DATA_DIR = join(process.cwd(), '.data');
  const CHECKSUM_FILE = join(DATA_DIR, 'schema-checksums.json');
  if (existsSync(CHECKSUM_FILE)) {
      unlinkSync(CHECKSUM_FILE);
  }

  // 3. Recreate Database
  const sql = postgres(adminUrl);
  try {
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
      process.exit(1);
  } finally {
      await sql.end();
  }

  // 4. Set the Database URL for the app
  await database.setUrl(process.env.DATABASE_URL!);

  // 5. Run Migrations
  try {
      const { migrateSchema } = await import('../server/plugins/schema-migration');
      await migrateSchema();
  } catch (e) {
      console.error('Failed to run migrations:', e);
      process.exit(1);
  }

  console.log('✅ Test Environment Ready.\n');
});

afterAll(async () => {
  await database.close();
});

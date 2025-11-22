import postgres from 'postgres';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { afterAll, beforeAll } from 'bun:test';
import { database } from '../server/helpers/database';
import { migrateSchema } from '../server/plugins/schema-migration';

const TEST_DB = process.env.TEST_DB_NAME || 'edk_test';
const DB_HOST = process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432', 10);
const DB_USER = process.env.DB_USER || process.env.POSTGRES_USER || 'edk_user';
const DB_PASS = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'edk_password';
const ADMIN_DATABASE = process.env.ADMIN_DB_NAME || process.env.POSTGRES_DB || 'postgres';

const ADMIN_URL =
  process.env.DB_ADMIN_URL ||
  `postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${ADMIN_DATABASE}`;
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.TEST_DB_URL ||
  `postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${TEST_DB}`;

const DATA_DIR = join(process.cwd(), '.data');
const CHECKSUM_FILE = join(DATA_DIR, 'schema-checksums.json');

export { database };

beforeAll(async () => {
  console.log('🛠️  Initializing test environment...');

  // Ensure core env vars are set before any modules under test are loaded.
  process.env.NODE_ENV = 'test';
  process.env.TEST_DB_NAME = TEST_DB;
  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
  process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';

  // Make sure the .data directory exists and force migration checksum refresh
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (existsSync(CHECKSUM_FILE)) {
    unlinkSync(CHECKSUM_FILE);
  }

  // Prepare a clean test database using the admin connection
  const adminSql = postgres(ADMIN_URL);
  try {
    await adminSql`SELECT 1`;
  } catch (error) {
    console.error('Failed to connect to Postgres for tests.');
    console.error('Admin URL:', ADMIN_URL.replace(/:[^:]*@/, ':****@'));
    throw error;
  }

  try {
    await adminSql`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = ${TEST_DB}
        AND pid <> pg_backend_pid()
    `.catch(() => {});

    await adminSql.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
    await adminSql.unsafe(`CREATE DATABASE "${TEST_DB}"`);
  } catch (error) {
    console.error('Failed to recreate test database:', error);
    throw error;
  } finally {
    await adminSql.end();
  }

  // Point the shared database helper at the fresh test DB
  database.setUrl(TEST_DB_URL);

  // Run migrations so the schema matches db/*.sql before tests execute
  await migrateSchema();

  console.log('✅ Test environment ready.\n');
});

afterAll(async () => {
  try {
    await database.close();
  } catch {
    // ignore
  }

  // Tear down the test database to keep local runs tidy
  const adminSql = postgres(ADMIN_URL);
  try {
    await adminSql.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
  } catch (error) {
    console.warn('⚠️  Unable to drop test database during cleanup:', error);
  } finally {
    await adminSql.end();
  }
});

import { afterAll, beforeAll } from 'bun:test'
import postgres from 'postgres'
import { database } from '../server/helpers/database'
import { unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { migrateSchema } from '../server/plugins/schema-migration'

const TEST_DB = 'edk_test';
const DB_USER = 'edk_user';
const DB_PASS = 'edk_password';
const DB_HOST = 'localhost';
const DB_PORT = 5432;
const DEFAULT_DB = 'edk';
const ADMIN_DATABASE = DEFAULT_DB;

const adminUrl = `postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${ADMIN_DATABASE}`;
const testDbUrl = `postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${TEST_DB}`;

beforeAll(async () => {
  console.log('🛠️  Initializing Test Environment...');

  // Recreate Database
  const sql = postgres(adminUrl);
  try {
    await sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${TEST_DB} AND pid <> pg_backend_pid()`.catch(() => {});
    await sql.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
    await sql.unsafe(`CREATE DATABASE "${TEST_DB}"`);
  } catch (e) {
    console.error('Failed to recreate test database:', e);
    process.exit(1);
  } finally {
    await sql.end();
  }

  // Set the database URL for the app's database helper
  await database.setUrl(testDbUrl);

  // Run Migrations
  try {
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

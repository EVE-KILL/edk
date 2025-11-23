import postgres from 'postgres';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { refreshEnv } from '../server/helpers/env';

import { beforeAll } from 'bun:test';

beforeAll(async () => {
  console.log('🛠️  Initializing Test Environment...');

  const baseEnv = refreshEnv();
  const testDbName = baseEnv.TEST_DB_NAME;
  const dbUser = baseEnv.DB_USER;
  const dbPass = baseEnv.DB_PASSWORD;
  const dbHost = baseEnv.DB_HOST;
  const dbPort = baseEnv.DB_PORT;
  const adminDatabase = baseEnv.ADMIN_DB_NAME || baseEnv.DB_NAME;
  const adminUrl =
    baseEnv.ADMIN_DATABASE_URL ||
    `postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${adminDatabase}`;

  // 1. Set Environment Variables for the Application
  // These must be set before importing app modules
  process.env.TEST_DB_NAME = testDbName;
  process.env.DATABASE_URL = `postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${testDbName}`;
  process.env.REDIS_HOST = String(baseEnv.REDIS_HOST);
  process.env.REDIS_PORT = String(baseEnv.REDIS_PORT);
  process.env.NODE_ENV = 'test';
  const updatedEnv = refreshEnv();

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
          WHERE datname = ${testDbName}
          AND pid <> pg_backend_pid()
      `.catch(() => {});

    await sql.unsafe(`DROP DATABASE IF EXISTS "${testDbName}"`);
    await sql.unsafe(`CREATE DATABASE "${testDbName}"`);
  } catch (e) {
    console.error('Failed to recreate test database:', e);
    console.error(
      'Database:',
      dbHost,
      'Port:',
      dbPort,
      'Name:',
      adminDatabase
    );
    process.exit(1);
  } finally {
    await sql.end();
  }

  // 4. Force DatabaseHelper to use the new URL
  // This is crucial because DatabaseHelper might have been initialized
  // with the default URL before this script runs.
  const { database } = await import('../server/helpers/database');
  await database.setUrl(updatedEnv.DATABASE_URL);

  // 5. Run Migrations
  try {
    const { migrateSchema } = await import(
      '../server/plugins/schema-migration'
    );
    await migrateSchema();
  } catch (e) {
    console.error('Failed to run migrations:', e);
    process.exit(1);
  }

  console.log('✅ Test Environment Ready.\n');
});

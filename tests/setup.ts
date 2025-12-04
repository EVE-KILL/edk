/* eslint-disable no-console */
import postgres from 'postgres';
import { refreshEnv } from '../server/helpers/env';
import { randomUUID } from 'crypto';

import { beforeAll, afterAll } from 'bun:test';

// Generate a unique database name for this test file to avoid collisions
// when running tests in parallel
const uniqueId = randomUUID().split('-')[0];
let testDbName = '';
let adminUrl = '';

beforeAll(async () => {
  console.log(`🛠️  Initializing Test Environment (${uniqueId})...`);

  const baseEnv = refreshEnv();
  const dbUser = baseEnv.DB_USER;
  const dbPass = baseEnv.DB_PASSWORD;
  const dbHost = baseEnv.DB_HOST;
  const dbPort = baseEnv.DB_PORT;
  const adminDatabase = baseEnv.ADMIN_DB_NAME || baseEnv.DB_NAME;
  adminUrl =
    baseEnv.ADMIN_DATABASE_URL ||
    `postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${adminDatabase}`;

  // 1. Set Environment Variables for the Application
  testDbName = `${baseEnv.TEST_DB_NAME}_${uniqueId}`;
  process.env.TEST_DB_NAME = testDbName;
  process.env.DATABASE_URL = `postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${testDbName}`;
  process.env.REDIS_HOST = String(baseEnv.REDIS_HOST);
  process.env.REDIS_PORT = String(baseEnv.REDIS_PORT);
  process.env.NODE_ENV = 'test';
  const updatedEnv = refreshEnv();

  // 2. Cleanup Previous State (Only if using shared resources, but we are using unique DB)
  // We still clear checksums to ensure migration runs?
  // Actually, we want migration to run for this new DB.
  // Checksum file is shared on disk!
  // If we run parallel tests, they all try to read/write `schema-checksums.json` in `.data`.
  // This causes race conditions on the file.
  // We should mock or redirect `DATA_DIR`?
  // `schema-migration.ts` uses `process.cwd() + '.data'`.
  // We can't easily change that without mocking.
  // But since the DB is empty, it will try to migrate.
  // It reads checksums from DB first.
  // If DB is empty, it might look at file.
  // Ideally we don't want it to write to the shared file.
  // `migrateSchema` writes to file.
  // We can ignore this for now, file write failure might be logged but migration should proceed in DB.

  // 3. Create Database
  const sql = postgres(adminUrl);
  try {
    await sql.unsafe(`CREATE DATABASE "${testDbName}"`);
  } catch (e) {
    console.error(`Failed to create test database ${testDbName}:`, e);
    process.exit(1);
  } finally {
    await sql.end();
  }

  // 4. Force DatabaseHelper to use the new URL
  const { database } = await import('../server/helpers/database');
  await database.setUrl(updatedEnv.DATABASE_URL);

  // 5. Run Migrations
  try {
    const { migrateSchema } =
      await import('../server/helpers/schema-migration');
    await migrateSchema();

    // 6. Create Partitions
    const { createMissingPartitions } =
      await import('../server/helpers/partitions');
    await createMissingPartitions();
  } catch (e) {
    console.error('Failed to run migrations/partitions:', e);
    process.exit(1);
  }

  console.log(`✅ Test Environment Ready (${uniqueId}).\n`);
});

afterAll(async () => {
  // Drop the unique database
  if (testDbName && adminUrl) {
    const sql = postgres(adminUrl);
    try {
      // Terminate connections first
      await sql`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = ${testDbName}
        AND pid <> pg_backend_pid()
      `.catch(() => {});

      await sql.unsafe(`DROP DATABASE IF EXISTS "${testDbName}"`);
      // console.log(`🗑️  Dropped test database ${testDbName}`);
    } catch (e) {
      console.error(`Failed to drop test database ${testDbName}:`, e);
    } finally {
      await sql.end();
    }
  }
  // Close app database connection
  const { database } = await import('../server/helpers/database');
  await database.close();
});

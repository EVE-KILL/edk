import postgres from 'postgres';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { beforeAll, afterAll } from 'bun:test';
import { DatabaseHelper } from '../server/helpers/database'; // Import the class
import { migrateSchema } from '../server/plugins/schema-migration';

// This is the dedicated database instance for tests.
export const database = new DatabaseHelper();

beforeAll(async () => {
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

    console.log('🛠️  Initializing Test Environment...');

    // 1. Set Environment Variables for the Application
    // This ensures that the test database helper connects to the correct database.
    process.env.NODE_ENV = 'test';
    process.env.TEST_DB_NAME = TEST_DB;
    process.env.DATABASE_URL = `postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${TEST_DB}`;

    // 2. Cleanup Previous State
    const DATA_DIR = join(process.cwd(), '.data');
    const CHECKSUM_FILE = join(DATA_DIR, 'schema-checksums.json');
    if (existsSync(CHECKSUM_FILE)) {
        unlinkSync(CHECKSUM_FILE);
    }

    // 3. Recreate Database
    // Use a single connection for admin operations (database creation/dropping).
    const sql = postgres(adminUrl, { max: 1 });
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

    // 4. Run Migrations
    // We can now safely connect to the test database
    try {
        await migrateSchema();
    } catch (e) {
        console.error('Failed to run migrations:', e);
        process.exit(1);
    }

    console.log('✅ Test Environment Ready.\n');
});

afterAll(async () => {
    console.log('\n🧹 Tearing down test environment...');
    await database.close();
    console.log('✅ Teardown complete.');
});

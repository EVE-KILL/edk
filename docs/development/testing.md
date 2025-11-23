# Testing Guide

This project uses the built-in Bun test runner for all automated testing.

## Running Tests

To run the entire test suite, use the following command:

```bash
bun test
```

## Test Environment

The test environment is configured to be isolated and consistent.

### Automated Test Database

Before any tests are run, a dedicated test database is automatically created and migrated. This process is handled by the `tests/setup.ts` script, which is preloaded by the test runner (as configured in `bunfig.toml`).

The key steps in the setup process are:
1.  **Drop and Recreate:** The test database (defined by the `TEST_DB_NAME` environment variable, defaulting to `edk_test`) is dropped if it exists and then recreated.
2.  **Run Migrations:** All SQL migrations from the `db/` directory are applied to ensure the schema is up-to-date.

This ensures that every test run starts with a clean, predictable database state. You do **not** need to manually migrate the test database.

### Test File Location

All test files are located in the `tests/` directory. The test runner automatically discovers and executes files in this directory that end with `.test.ts` or `.spec.ts`.

## Writing Tests

When adding new features or fixing bugs, you should also add corresponding tests to ensure correctness and prevent regressions.

### General Guidelines

- **File Naming:** Test files should be named after the module they are testing, with a `.test.ts` suffix (e.g., `server/helpers/database.ts` would be tested by `tests/helpers/database.test.ts`).
- **Test Structure:** Use the `describe`, `it`, and `expect` functions provided by the Bun test runner to structure your tests.
- **Database Access:** When you need to interact with the database in a test, import the `database` instance from `server/helpers/database`. It will be automatically connected to the test database.
- **Seeding Data:** For tests that require specific data to be present in the database, you can use the helper functions in `tests/helpers/seed.ts` to populate the database with test data.

### Example Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { database } from '~/server/helpers/database';
import { seedCharacters } from '~/tests/helpers/seed';

describe('My Feature', () => {
  beforeEach(async () => {
    // Clean up and seed data before each test
    await database.sql`TRUNCATE TABLE characters RESTART IDENTITY`;
    await seedCharacters([
      { characterId: 1, name: 'Test Character 1' },
      { characterId: 2, name: 'Test Character 2' },
    ]);
  });

  it('should do something correctly', async () => {
    // Your test logic here
    const characters = await database.sql`SELECT * FROM characters`;
    expect(characters.length).toBe(2);
  });
});
```

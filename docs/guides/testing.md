# Testing

EVE-KILL uses Bun's built-in test runner.

## Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/database.test.ts

# Run with watch mode
bun test --watch

# Run with coverage
bun test --coverage
```

## Test Setup

Tests use a separate database (`edk_test` by default). The setup script in `tests/setup.ts`:

1. Drops and recreates the test database
2. Runs all migrations from `db/`
3. Sets up the test environment

This runs automatically via `bunfig.toml` preload.

## Writing Tests

### Basic Structure

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { database } from '../server/helpers/database';

describe('Feature Name', () => {
  beforeAll(async () => {
    // Setup - runs once before all tests
  });

  afterAll(async () => {
    // Cleanup - runs once after all tests
  });

  it('should do something', async () => {
    const result = await someFunction();
    expect(result).toBe(expectedValue);
  });
});
```

### Testing Models

```typescript
import { describe, it, expect } from 'bun:test';
import { getCharacter, storeCharacter } from '../server/models/characters';

describe('Characters Model', () => {
  it('should store and retrieve a character', async () => {
    const characterData = {
      id: 12345,
      name: 'Test Character',
      corporationId: 98000001,
      allianceId: null,
      birthday: new Date('2010-01-01'),
      lastUpdated: new Date(),
    };

    await storeCharacter(characterData);

    const result = await getCharacter(12345);

    expect(result).not.toBeNull();
    expect(result?.name).toBe('Test Character');
    expect(result?.corporationId).toBe(98000001);
  });
});
```

### Testing Routes

```typescript
import { describe, it, expect } from 'bun:test';

describe('API Routes', () => {
  it('should return 404 for missing killmail', async () => {
    const response = await fetch(
      'http://localhost:3000/api/killmail/99999999/fakehash'
    );

    expect(response.status).toBe(404);
  });

  it('should return killmail data', async () => {
    const response = await fetch(
      'http://localhost:3000/api/killmail/12345/validhash'
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.killmail_id).toBe(12345);
  });
});
```

### Using Test Fixtures

Create reusable test data in `tests/fixtures/`:

```typescript
// tests/fixtures/killmails.ts
export const sampleKillmail = {
  killmailId: 12345,
  killmailTime: '2024-01-15T12:00:00Z',
  solarSystemId: 30002187,
  victimCharacterId: 123456,
  victimCorporationId: 98000001,
  victimShipTypeId: 17740,
  totalValue: 500000000,
};

export const sampleAttackers = [
  {
    characterId: 789012,
    corporationId: 98000002,
    shipTypeId: 11377,
    weaponTypeId: 3170,
    damageDone: 25000,
    finalBlow: true,
  },
];
```

Use in tests:

```typescript
import { sampleKillmail, sampleAttackers } from './fixtures/killmails';

it('should calculate total value', async () => {
  const result = calculateValue(sampleKillmail, sampleAttackers);
  expect(result).toBeGreaterThan(0);
});
```

### Seeding Test Data

Use `tests/helpers/seed.ts` for complex test data:

```typescript
import { seedKillmail, seedCharacter } from './helpers/seed';

beforeAll(async () => {
  await seedCharacter({ characterId: 123, name: 'Attacker' });
  await seedCharacter({ characterId: 456, name: 'Victim' });
  await seedKillmail({ killmailId: 1, victimCharacterId: 456 });
});
```

## Assertions

Common Bun test assertions:

```typescript
// Equality
expect(value).toBe(expected);
expect(value).toEqual(expected); // Deep equality

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeDefined();

// Numbers
expect(number).toBeGreaterThan(5);
expect(number).toBeLessThan(10);
expect(number).toBeCloseTo(3.14, 2);

// Strings
expect(string).toContain('substring');
expect(string).toMatch(/regex/);

// Arrays
expect(array).toHaveLength(3);
expect(array).toContain(item);

// Objects
expect(object).toHaveProperty('key');
expect(object).toMatchObject({ key: 'value' });

// Errors
expect(() => badFunction()).toThrow();
expect(() => badFunction()).toThrow('error message');

// Async
await expect(asyncFunction()).resolves.toBe(value);
await expect(asyncFunction()).rejects.toThrow();
```

## Best Practices

1. **Isolate tests** - Each test should be independent
2. **Clean up** - Remove test data after tests complete
3. **Use descriptive names** - `it('should return 404 when killmail not found')`
4. **Test edge cases** - Empty arrays, null values, invalid input
5. **Mock external services** - Don't call real ESI API in tests

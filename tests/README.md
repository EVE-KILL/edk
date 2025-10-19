# EVE Kill v4 - Testing Guide

## Running Tests

Bun has a built-in test runner. To run tests:

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/router.test.ts

# Run with watch mode
bun test --watch

# Run with coverage
bun test --coverage
```

## Test Structure

```
tests/
├── router.test.ts        # Route matching and optimization tests
├── middleware.test.ts    # Middleware functionality tests
└── performance.test.ts   # Performance benchmark tests
```

## Writing Tests

Bun's test API is similar to Jest:

```typescript
import { describe, test, expect } from "bun:test";

describe("My Feature", () => {
  test("should do something", () => {
    expect(1 + 1).toBe(2);
  });
});
```

## Performance Tests

Performance tests ensure optimizations are working:

- Route matching should be < 1ms
- Static file serving should be < 50ms
- API responses should be < 50ms
- Template rendering should be < 100ms (dev)

Run performance tests when the server is running on port 3000.

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Run tests
  run: bun test

- name: Run performance tests
  run: bun test tests/performance.test.ts
```

## Coverage

Generate coverage reports:

```bash
bun test --coverage
```

Coverage reports will show which code paths are tested.

## Best Practices

1. **Unit Tests** - Test individual functions in isolation
2. **Integration Tests** - Test routes and middleware together
3. **Performance Tests** - Ensure optimizations are effective
4. **Mock External Dependencies** - Database, APIs, etc.
5. **Test Edge Cases** - null, undefined, empty arrays, etc.

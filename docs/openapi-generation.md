# OpenAPI / Swagger Documentation

## Overview

EVE-KILL EDK generates OpenAPI 3.1 specifications from JSDoc comments in API route files.

## Generating the Spec

### During Development

```bash
bun cli.ts build:openapi
```

### During Build (Automatic)

The OpenAPI spec is automatically generated during the build process:

```bash
bun run build
```

This runs:

1. `build:css` - Optimize CSS
2. `build:openapi` - Generate OpenAPI spec
3. `nitro build` - Build Nitro server

### In Docker

The Dockerfile automatically generates the OpenAPI spec during the build:

```dockerfile
RUN bun run build
```

## Accessing the Documentation

- **Scalar UI**: http://localhost:3000/api/docs
- **Raw OpenAPI JSON**: http://localhost:3000/docs/openapi.json
- **Generated File**: `docs/openapi.json`

## Writing API Documentation

Add OpenAPI documentation using JSDoc comments in your API route files:

```typescript
/**
 * @openapi
 * /api/characters/{id}:
 *   get:
 *     summary: Get character details
 *     description: Returns character information from the database.
 *     tags:
 *       - Characters
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The character ID
 *         schema:
 *           type: integer
 *           example: 123456
 *     responses:
 *       '200':
 *         description: Character details
 *       '404':
 *         description: Character not found
 */
export default defineEventHandler(async (event) => {
  // Your route logic here
});
```

## OpenAPI Structure

The generated spec includes:

- **Info**: API title, description, version, contact
- **Servers**: Production and development URLs
- **Paths**: All documented API routes
- **Components**: Reusable schemas and security schemes
- **Security**: Cookie-based authentication

## Validation

The OpenAPI spec follows OpenAPI 3.1 standards and can be validated using:

```bash
npx @redocly/cli lint docs/openapi.json
```

## CI/CD Integration

The spec is automatically regenerated on every build, ensuring it stays in sync with your API routes.

## Troubleshooting

### Spec not updating

Run the generation command manually:

```bash
bun cli.ts build:openapi
```

### Route not appearing

Ensure your route file has an `@openapi` JSDoc comment at the top level.

### Syntax errors in spec

Check that your YAML-like JSDoc syntax is valid:

- Use 2-space indentation
- Ensure colons are followed by spaces
- Quote string values when needed

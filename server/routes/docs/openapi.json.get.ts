/**
 * Serve pre-generated OpenAPI specification
 * This file is generated during build by `bun cli.ts build:openapi`
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export default defineEventHandler(async (event) => {
  try {
    const openapiPath = join(process.cwd(), 'docs', 'openapi.json');
    const content = await readFile(openapiPath, 'utf-8');
    const spec = JSON.parse(content);

    setResponseHeaders(event, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    });

    return spec;
  } catch {
    throw createError({
      statusCode: 404,
      statusMessage:
        'OpenAPI specification not found. Run `bun cli.ts build:openapi` to generate it.',
    });
  }
});

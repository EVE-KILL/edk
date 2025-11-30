/**
 * Generate OpenAPI/Swagger JSON
 *
 * Scans all API routes and extracts OpenAPI documentation from JSDoc comments.
 * Outputs to docs/openapi.json for use in API documentation.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { glob } from 'glob';
import { readFile } from 'node:fs/promises';
import { logger } from '../../server/helpers/logger';
import { parse as parseYaml } from 'yaml';

export const description = 'Generate OpenAPI/Swagger documentation';

export async function action() {
  logger.info('🔍 Scanning API routes...');

  const apiFiles = await glob('server/api/**/*.{ts,js}', {
    ignore: ['**/*.test.ts', '**/*.spec.ts'],
  });

  logger.info(`📄 Found ${apiFiles.length} API route files`);

  const openApiSpec = {
    openapi: '3.1.0',
    info: {
      title: 'EVE-KILL EDK API',
      description:
        'EVE Online Killboard API - Real-time killmail tracking and analytics',
      version: '1.0.0',
      contact: {
        name: 'EVE-KILL Team',
        url: 'https://github.com/EVE-KILL/edk',
      },
    },
    servers: [
      {
        url: 'https://eve-kill.com',
        description: 'Production server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    paths: {} as Record<string, any>,
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            statusCode: { type: 'integer' },
            statusMessage: { type: 'string' },
          },
        },
      },
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'edk_session',
        },
      },
    },
  };

  for (const file of apiFiles) {
    try {
      const content = await readFile(file, 'utf-8');

      // Extract OpenAPI JSDoc comments
      const openApiMatch = content.match(
        /\/\*\*\s*\n\s*\*\s*@openapi\s*([\s\S]*?)\*\//
      );

      if (openApiMatch) {
        const openApiComment = openApiMatch[1];

        // Convert file path to route path
        const routePath = fileToRoutePath(file);

        // Parse YAML-like structure from JSDoc comment
        const pathSpec = parseOpenApiComment(openApiComment);

        if (pathSpec && routePath) {
          // The parsed spec should have the path as a key
          // Extract it properly
          const pathKeys = Object.keys(pathSpec);
          if (pathKeys.length > 0) {
            const actualPath = pathKeys[0];
            const methods = pathSpec[actualPath];

            // Merge into paths using the actual path from the comment
            if (!openApiSpec.paths[actualPath]) {
              openApiSpec.paths[actualPath] = {};
            }
            Object.assign(openApiSpec.paths[actualPath], methods);

            logger.debug(`  ✓ ${actualPath}`);
          }
        }
      }
    } catch (error) {
      logger.warn(`  ⚠ Failed to process ${file}:`, { error: String(error) });
    }
  }

  // Ensure docs directory exists
  await mkdir('docs', { recursive: true });

  // Write OpenAPI spec
  const outputPath = join(process.cwd(), 'docs', 'openapi.json');
  await writeFile(outputPath, JSON.stringify(openApiSpec, null, 2));

  logger.success(`✅ OpenAPI spec written to ${outputPath}`);
  logger.info(`📊 Total paths: ${Object.keys(openApiSpec.paths).length}`);
}

/**
 * Convert file path to API route path
 * Examples:
 *   server/api/killmail/[id]/index.get.ts -> /api/killmail/{id}
 *   server/api/characters/count.get.ts -> /api/characters/count
 */
function fileToRoutePath(filePath: string): string | null {
  // Remove server/api/ prefix
  let path = filePath.replace(/^server\/api\//, '');

  // Remove file extension and method
  path = path.replace(/\.(get|post|put|patch|delete|head|options)\.ts$/, '');

  // Remove index
  path = path.replace(/\/index$/, '');

  // Convert [param] to {param}
  path = path.replace(/\[([^\]]+)\]/g, '{$1}');

  // Add /api prefix
  return `/api/${path}`;
}

/**
 * Parse OpenAPI YAML-like comment into JSON using proper YAML parser
 */
function parseOpenApiComment(comment: string): Record<string, any> | null {
  try {
    // Remove leading asterisks and whitespace from JSDoc comment
    const cleaned = comment
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, ''))
      .join('\n')
      .trim();

    // Parse as YAML
    const parsed = parseYaml(cleaned);
    return parsed;
  } catch (error) {
    logger.warn('Failed to parse OpenAPI comment:', { error: String(error) });
    return null;
  }
}

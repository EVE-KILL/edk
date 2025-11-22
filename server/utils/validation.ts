import { z, ZodSchema } from 'zod';
import { H3Event } from 'h3';
import sanitizeHtml from 'sanitize-html';

interface ValidationSchema {
  params?: ZodSchema;
  query?: ZodSchema;
  body?: ZodSchema;
}

interface ValidatedData<T extends ValidationSchema> {
  params: T['params'] extends ZodSchema ? z.infer<T['params']> : undefined;
  query: T['query'] extends ZodSchema ? z.infer<T['query']> : undefined;
  body: T['body'] extends ZodSchema ? z.infer<T['body']> : undefined;
}

// Recursive function to sanitize strings in an object
function sanitizeStrings(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeHtml(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeStrings);
  }
  if (typeof obj === 'object' && obj !== null) {
    const sanitizedObj: { [key: string]: any } = {};
    for (const key in obj) {
      sanitizedObj[key] = sanitizeStrings(obj[key]);
    }
    return sanitizedObj;
  }
  return obj;
}

/**
 * Validates and sanitizes request data (params, query, body) against a Zod schema.
 *
 * @param event - The H3Event object.
 * @param schema - An object containing Zod schemas for `params`, `query`, and/or `body`.
 * @returns A promise that resolves to an object with the validated and sanitized data.
 * @throws {Error} Throws a 400 error if validation fails.
 */
export async function validate<T extends ValidationSchema>(
  event: H3Event,
  schema: T
): Promise<ValidatedData<T>> {
  try {
    const validated: Partial<ValidatedData<T>> = {};

    if (schema.params) {
      const params = await getRouterParams(event);
      const validatedParams = schema.params.parse(params);
      validated.params = sanitizeStrings(validatedParams);
    }

    if (schema.query) {
      const query = getQuery(event);
      const validatedQuery = schema.query.parse(query);
      validated.query = sanitizeStrings(validatedQuery);
    }

    if (schema.body) {
      const body = await readBody(event);
      const validatedBody = schema.body.parse(body);
      validated.body = sanitizeStrings(validatedBody);
    }

    return validated as ValidatedData<T>;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation Failed',
        data: error.issues,
      });
    }
    // Re-throw other errors
    throw error;
  }
}

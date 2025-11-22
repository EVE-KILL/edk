import { z, ZodSchema } from 'zod'
import { H3Event } from 'h3'

// Define a context key for validated data
const VALIDATED_CONTEXT_KEY = 'validated'

// Extend the H3Event context to include the validated data
declare module 'h3' {
  interface H3EventContext {
    [VALIDATED_CONTEXT_KEY]?: {
      params?: any
      query?: any
      body?: any
    }
  }
}

/**
 * Creates a validation middleware for Nitro
 *
 * @param schema - The Zod schema to validate against
 * @returns An event handler that validates the request
 */
export const withValidation = (schema: {
  params?: ZodSchema
  query?: ZodSchema
  body?: ZodSchema
}) => {
  return defineEventHandler(async (event: H3Event) => {
    try {
      const validated: { params?: any; query?: any; body?: any } = {}

      if (schema.params) {
        const params = await getRouterParams(event)
        validated.params = schema.params.parse(params)
      }

      if (schema.query) {
        const query = getQuery(event)
        validated.query = schema.query.parse(query)
      }

      if (schema.body) {
        const body = await readBody(event)
        validated.body = schema.body.parse(body)
      }

      // Attach the validated data to the event context
      event.context[VALIDATED_CONTEXT_KEY] = validated
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Validation failed',
          data: error.issues
        })
      }
      // Re-throw other errors
      throw error
    }
  })
}

/**
 * Retrieves the validated data from the event context
 *
 * @param event - The H3Event object
 * @returns The validated data
 */
export const getValidated = (event: H3Event) => {
  return event.context[VALIDATED_CONTEXT_KEY] || {}
}

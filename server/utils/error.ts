import { H3Event, createError } from 'h3'
import { logger } from '../helpers/logger'

export function handleError(event: H3Event, error: any) {
  const message = error.message || 'Internal Server Error'
  const statusCode = error.statusCode || 500

  logger.error(`Route error on ${event.path}`, {
    error: {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
      statusMessage: error.statusMessage,
      data: error.data
    },
    path: event.path,
    method: event.method,
    context: event.context
  })

  throw createError({
    statusCode,
    message
  })
}

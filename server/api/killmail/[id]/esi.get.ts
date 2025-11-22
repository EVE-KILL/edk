import { z } from 'zod'
import { withValidation, getValidated } from '~/server/utils/validation'

/**
 * GET /api/killmail/{id}/esi
 *
 * Retrieves a killmail by ID in ESI format
 *
 * @param id - The killmail ID to fetch
 * @returns ESI formatted killmail data
 */
export default withValidation({
  params: z.object({
    id: z.string().refine(val => !isNaN(parseInt(val, 10)), {
      message: 'ID must be a number'
    })
  })
})(defineEventHandler(async (event: any) => {
  const { params } = getValidated(event)
  const id = parseInt(params.id, 10)

  const killmail = await getKillmail(id)

  if (!killmail) {
    throw createError({
      statusCode: 404,
      statusMessage: `Killmail with ID ${id} not found`
    })
  }

  return killmail
}))

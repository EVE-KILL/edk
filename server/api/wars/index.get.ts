import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/wars:
 *   get:
 *     summary: Get war list
 *     description: Returns a paginated list of wars.
 *     tags:
 *       - Wars
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Page number
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: perPage
 *         in: query
 *         description: Items per page (max 200)
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *     responses:
 *       '200':
 *         description: List of wars
 */
export default defineEventHandler(async (event) => {
  const { query } = await validate(event, {
    query: z.object({
      page: z.coerce.number().int().positive().default(1),
      perPage: z.coerce.number().int().positive().max(200).default(50),
    }),
  });

  const { page, perPage } = query;
  const offset = (page - 1) * perPage;
  const sql = database.sql;

  const wars = await sql`
    SELECT * FROM wars
    ORDER BY "warId" DESC
    LIMIT ${perPage} OFFSET ${offset}
  `;

  return {
    wars,
    page,
    perPage,
  };
});

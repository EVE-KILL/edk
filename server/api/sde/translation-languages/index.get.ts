import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { TranslationLanguage } from '~/models/translationLanguages';

/**
 * @openapi
 * /api/sde/translation-languages:
 *   get:
 *     summary: Get translation languages
 *     description: Returns a paginated list of supported translation languages from the Static Data Export.
 *     tags:
 *       - SDE - Miscellaneous
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Page number
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: perPage
 *         in: query
 *         description: Items per page (max 500)
 *         schema:
 *           type: integer
 *           default: 100
 *           maximum: 500
 *     responses:
 *       '200':
 *         description: List of translation languages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - items
 *                 - page
 *                 - perPage
 *                 - total
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       languageId:
 *                         type: string
 *                         description: Language code (ISO 639-1)
 *                         example: "de"
 *                       name:
 *                         type: string
 *                         description: Language name
 *                         example: "German"
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 perPage:
 *                   type: integer
 *                   example: 100
 *                 total:
 *                   type: integer
 *                   example: 8
 */
export default defineEventHandler(async (event) => {
  const { query } = await validate(event, {
    query: z.object({
      page: z.coerce.number().int().positive().default(1),
      perPage: z.coerce.number().int().positive().max(500).default(100),
    }),
  });

  const { page, perPage } = query;
  const offset = (page - 1) * perPage;

  const [items, totalResult] = await Promise.all([
    database.query<TranslationLanguage>(
      `SELECT * FROM translationlanguages ORDER BY "languageId" LIMIT :limit OFFSET :offset`,
      { limit: perPage, offset }
    ),
    database.findOne<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM translationlanguages`
    ),
  ]);

  const total = totalResult?.count ?? 0;

  return {
    items,
    page,
    perPage,
    total,
  };
});

import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { TranslationLanguage } from '~/models/translationLanguages';

/**
 * @openapi
 * /api/sde/translation-languages/{id}:
 *   get:
 *     summary: Get translation language by ID
 *     description: Returns a single translation language from the Static Data Export.
 *     tags:
 *       - SDE - Miscellaneous
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The translation language ID
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: TranslationLanguage details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: TranslationLanguage not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.string().describe('The translation language ID'),
    }),
  });

  const item = await database.findOne<TranslationLanguage>(
    `SELECT * FROM translationlanguages WHERE "languageId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'TranslationLanguage not found',
    });
  }

  return item;
});

import { getApproximateCount } from '~/helpers/approximate-count';

/**
 * @openapi
 * /api/characters/count:
 *   get:
 *     summary: Get total character count
 *     description: Returns the total number of characters in the database.
 *     tags:
 *       - Characters
 *     responses:
 *       '200':
 *         description: Total character count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   example: 12345
 */
export default defineEventHandler(async (_event) => {
  const count = await getApproximateCount('characters');

  return {
    count,
  };
});

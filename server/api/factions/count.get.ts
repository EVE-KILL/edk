import { getApproximateCount } from '~/helpers/approximate-count';

/**
 * @openapi
 * /api/factions/count:
 *   get:
 *     summary: Get total faction count
 *     description: Returns the total number of factions in the database.
 *     tags:
 *       - Factions
 *     responses:
 *       '200':
 *         description: Total faction count
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
  const count = await getApproximateCount('factions');

  return {
    count,
  };
});

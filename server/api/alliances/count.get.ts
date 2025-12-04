import { getApproximateCount } from '~/helpers/approximate-count';

/**
 * @openapi
 * /api/alliances/count:
 *   get:
 *     summary: Get total alliance count
 *     description: Returns the total number of alliances in the database.
 *     tags:
 *       - Alliances
 *     responses:
 *       '200':
 *         description: Total alliance count
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
  const count = await getApproximateCount('alliances');

  return {
    count,
  };
});

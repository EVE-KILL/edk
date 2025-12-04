import { getApproximateCount } from '~/helpers/approximate-count';

/**
 * @openapi
 * /api/corporations/count:
 *   get:
 *     summary: Get total corporation count
 *     description: Returns the total number of corporations in the database.
 *     tags:
 *       - Corporations
 *     responses:
 *       '200':
 *         description: Total corporation count
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
  const count = await getApproximateCount('corporations');

  return {
    count,
  };
});

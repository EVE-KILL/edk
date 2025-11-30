import { getApproximateCount } from '~/helpers/approximate-count';

/**
 * @openapi
 * /api/killmail/count:
 *   get:
 *     summary: Get total killmail count
 *     description: Returns the total number of killmails in the database.
 *     tags:
 *       - Killmails
 *     responses:
 *       '200':
 *         description: Total killmail count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   example: 113456789
 */
export default defineEventHandler(async (event) => {
  const count = await getApproximateCount('killmails');

  return {
    count,
  };
});

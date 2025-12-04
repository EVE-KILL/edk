/**
 * @openapi
 * /api/items/count:
 *   get:
 *     summary: Get total item/type count
 *     description: Returns the total number of published item types in the database from the Static Data Export.
 *     tags:
 *       - Items
 *     responses:
 *       '200':
 *         description: Total item/type count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - count
 *               properties:
 *                 count:
 *                   type: integer
 *                   example: 26264
 */
export default defineEventHandler(async (_event) => {
  const count = await getApproximateCount('items');

  return {
    count,
  };
});

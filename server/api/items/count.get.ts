/**
 * @openapi
 * /api/items/count:
 *   get:
 *     summary: Get total item/type count
 *     description: Returns the total number of published item types in the database.
 *     tags:
 *       - Items
 *     responses:
 *       '200':
 *         description: Total item/type count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   example: 12345
 */
export default defineEventHandler(async (event) => {
  const result = await database.findOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM types WHERE published = true'
  );

  return {
    count: result?.count || 0,
  };
});

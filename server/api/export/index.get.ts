/**
 * @openapi
 * /api/export:
 *   get:
 *     summary: Get export options
 *     description: Returns available export collections and formats.
 *     tags:
 *       - Export
 *     responses:
 *       '200':
 *         description: Available export options
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 collections:
 *                   type: array
 *                   items:
 *                     type: string
 *                 formats:
 *                   type: array
 *                   items:
 *                     type: string
 *                 note:
 *                   type: string
 *             example:
 *               collections:
 *                 - "killmails"
 *                 - "characters"
 *                 - "corporations"
 *                 - "alliances"
 *                 - "types"
 *                 - "prices"
 *               formats:
 *                 - "json"
 *                 - "csv"
 *               note: "Use /api/export/{collection} to export a specific collection"
 */
export default defineEventHandler(async (_event) => {
  return {
    collections: [
      'killmails',
      'characters',
      'corporations',
      'alliances',
      'types',
      'prices',
    ],
    formats: ['json', 'csv'],
    note: 'Use /api/export/{collection} to export a specific collection',
  };
});

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
 */
export default defineEventHandler(async (event) => {
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

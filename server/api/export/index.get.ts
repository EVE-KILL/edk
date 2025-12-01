/**
 * @openapi
 * /api/export:
 *   get:
 *     summary: Get available export options
 *     description: Returns a list of available export collections and supported export formats for data exports.
 *     tags:
 *       - Export
 *     responses:
 *       '200':
 *         description: Available export options
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - collections
 *                 - formats
 *                 - note
 *               properties:
 *                 collections:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["killmails", "characters", "corporations", "alliances", "types", "prices"]
 *                 formats:
 *                   type: array
 *                   items:
 *                     type: string
 *                     enum: ["json", "csv"]
 *                   example: ["json", "csv"]
 *                 note:
 *                   type: string
 *                   example: "Use /api/export/{collection} to export a specific collection"
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

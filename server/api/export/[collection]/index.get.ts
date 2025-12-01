import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/export/{collection}:
 *   get:
 *     summary: Export a data collection
 *     description: Exports data from a specific collection in JSON or CSV format (limited to 10,000 records for performance). Response schema varies based on the collection type.
 *     tags:
 *       - Export
 *     parameters:
 *       - name: collection
 *         in: path
 *         required: true
 *         description: The collection to export (killmails, characters, corporations, alliances, types, or prices)
 *         schema:
 *           type: string
 *           enum: ["killmails", "characters", "corporations", "alliances", "types", "prices"]
 *           example: "killmails"
 *       - name: format
 *         in: query
 *         required: false
 *         description: Export format (JSON or CSV)
 *         schema:
 *           type: string
 *           enum: ["json", "csv"]
 *           default: "json"
 *       - name: limit
 *         in: query
 *         required: false
 *         description: Maximum number of records to export (capped at 10,000)
 *         schema:
 *           type: integer
 *           default: 1000
 *           minimum: 1
 *           maximum: 10000
 *     responses:
 *       '200':
 *         description: Exported collection data. Schema varies by collection type.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - collection
 *                 - count
 *                 - data
 *               properties:
 *                 collection:
 *                   type: string
 *                   description: Name of the exported collection
 *                   enum: ["killmails", "characters", "corporations", "alliances", "types", "prices"]
 *                   example: "killmails"
 *                 count:
 *                   type: integer
 *                   description: Number of records in this export
 *                   example: 1
 *                 data:
 *                   type: array
 *                   description: Array of records. Schema depends on collection type.
 *                   items:
 *                     type: object
 *                   example:
 *                     - killmailId: "380"
 *                       killmailTime: "2007-12-05T23:56:00.000Z"
 *                       solarSystemId: 30003283
 *                       victimCharacterId: "339667724"
 *                       victimCorporationId: "1000170"
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *               description: CSV file with exported data
 *       '400':
 *         description: Invalid collection or parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                   example: 400
 *                 statusMessage:
 *                   type: string
 *                   example: "Invalid collection"
 *
 * Note: Each collection returns different fields:
 *   - killmails: killmailId, killmailTime, solarSystemId, victimCharacterId, topAttackerCharacterId, totalValue, etc.
 *   - characters: characterId, name, corporationId, allianceId, updatedAt, etc.
 *   - corporations: corporationId, name, ticker, ceoId, allianceId, etc.
 *   - alliances: allianceId, name, ticker, executorCorporationId, etc.
 *   - types: typeId, name, groupId, volume, mass, etc.
 *   - prices: typeId, regionId, priceDate, averagePrice, highestPrice, lowestPrice, etc.
 */
export default defineEventHandler(async (event) => {
  const { params, query } = await validate(event, {
    params: z.object({
      collection: z.enum([
        'killmails',
        'characters',
        'corporations',
        'alliances',
        'types',
        'prices',
      ]),
    }),
    query: z.object({
      format: z.enum(['json', 'csv']).default('json'),
      limit: z.coerce.number().int().positive().max(10000).default(1000),
    }),
  });

  const { collection } = params;
  const { format, limit } = query;

  const tableMap: Record<string, string> = {
    killmails: 'killmails',
    characters: 'characters',
    corporations: 'corporations',
    alliances: 'alliances',
    types: 'types',
    prices: 'prices',
  };

  const tableName = tableMap[collection];
  const sql = database.sql;

  const data = await sql`
    SELECT * FROM ${sql(tableName)}
    LIMIT ${limit}
  `;

  if (format === 'csv') {
    // Convert to CSV
    if (data.length === 0) {
      return 'No data';
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map((row: any) =>
        headers.map((header) => JSON.stringify(row[header] ?? '')).join(',')
      ),
    ];

    event.node.res.setHeader('Content-Type', 'text/csv');
    event.node.res.setHeader(
      'Content-Disposition',
      `attachment; filename="${collection}.csv"`
    );
    return csvRows.join('\n');
  }

  return {
    collection,
    count: data.length,
    data,
  };
});

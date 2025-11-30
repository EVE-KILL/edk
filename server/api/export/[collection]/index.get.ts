import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/export/{collection}:
 *   get:
 *     summary: Export a collection
 *     description: Exports data from a specific collection (limited to 10,000 records for performance).
 *     tags:
 *       - Export
 *     parameters:
 *       - name: collection
 *         in: path
 *         required: true
 *         description: The collection to export
 *         schema:
 *           type: string
 *           enum: [killmails, characters, corporations, alliances, types, prices]
 *       - name: format
 *         in: query
 *         description: Export format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *       - name: limit
 *         in: query
 *         description: Maximum number of records (max 10000)
 *         schema:
 *           type: integer
 *           default: 1000
 *           maximum: 10000
 *     responses:
 *       '200':
 *         description: Exported data
 *       '400':
 *         description: Invalid collection
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

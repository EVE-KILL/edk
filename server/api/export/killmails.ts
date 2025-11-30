import { z } from 'zod';
import { validate } from '~/utils/validation';
import { getFilteredKills, type KilllistFilters } from '~/models/killlist';

/**
 * @openapi
 * /api/export/killmails:
 *   get:
 *     summary: Export killmails
 *     description: Exports killmails data (limited to 10,000 records for performance).
 *     tags:
 *       - Export
 *     parameters:
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
 *   post:
 *     summary: Export killmails with filters
 *     description: Exports killmails based on provided filters (limited to 10,000 records).
 *     tags:
 *       - Export
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filters:
 *                 type: object
 *                 description: Killlist filters
 *               format:
 *                 type: string
 *                 enum: [json, csv]
 *                 default: json
 *               limit:
 *                 type: integer
 *                 maximum: 10000
 *                 default: 1000
 *     responses:
 *       '200':
 *         description: Exported killmails
 */
export default defineEventHandler(async (event) => {
  // Handle GET request - simple export without filters
  if (event.method === 'GET') {
    const { query } = await validate(event, {
      query: z.object({
        format: z.enum(['json', 'csv']).default('json'),
        limit: z.coerce.number().int().positive().max(10000).default(1000),
      }),
    });

    const { format, limit } = query;
    const sql = database.sql;

    const data = await sql`
      SELECT * FROM killmails
      LIMIT ${limit}
    `;

    if (format === 'csv') {
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
        `attachment; filename="killmails.csv"`
      );
      return csvRows.join('\n');
    }

    return {
      collection: 'killmails',
      count: data.length,
      data,
    };
  }

  // Handle POST request - export with filters
  const { body } = await validate(event, {
    body: z.object({
      filters: z.record(z.any()).optional(),
      format: z.enum(['json', 'csv']).default('json'),
      limit: z.coerce.number().int().positive().max(10000).default(1000),
    }),
  });

  const { filters = {}, format, limit } = body;

  // Calculate number of pages needed to get all records up to limit
  const perPage = Math.min(limit, 200);
  const pages = Math.ceil(limit / perPage);

  let allKillmails: any[] = [];

  for (let page = 1; page <= pages && allKillmails.length < limit; page++) {
    const killmails = await getFilteredKills(
      filters as KilllistFilters,
      page,
      perPage
    );

    allKillmails = [...allKillmails, ...killmails];

    // Stop if we got fewer results than requested (no more data)
    if (killmails.length < perPage) {
      break;
    }
  }

  // Trim to exact limit
  allKillmails = allKillmails.slice(0, limit);

  if (format === 'csv') {
    // Convert to CSV
    if (allKillmails.length === 0) {
      return 'No data';
    }

    const headers = Object.keys(allKillmails[0]);
    const csvRows = [
      headers.join(','),
      ...allKillmails.map((row: any) =>
        headers.map((header) => JSON.stringify(row[header] ?? '')).join(',')
      ),
    ];

    event.node.res.setHeader('Content-Type', 'text/csv');
    event.node.res.setHeader(
      'Content-Disposition',
      'attachment; filename="killmails.csv"'
    );
    return csvRows.join('\n');
  }

  return {
    count: allKillmails.length,
    filters,
    data: allKillmails,
  };
});

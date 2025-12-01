import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/items/{id}/pricing:
 *   get:
 *     summary: Get item pricing information
 *     description: Returns price data for the item type using priority order - custom prices > market prices > build prices > 0. Market price defaults to Jita region unless specified.
 *     tags:
 *       - Items
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The type/item ID
 *         schema:
 *           type: integer
 *           example: 34
 *       - name: regionId
 *         in: query
 *         required: false
 *         description: Region ID for market prices (default is Jita - 10000002)
 *         schema:
 *           type: integer
 *           default: 10000002
 *     responses:
 *       '200':
 *         description: Item pricing information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - typeId
 *                 - price
 *                 - source
 *               properties:
 *                 typeId:
 *                   type: integer
 *                   example: 34
 *                 price:
 *                   type: number
 *                   example: 4.52
 *                 source:
 *                   type: string
 *                   enum: ["custom", "market", "build", "none"]
 *                   example: "market"
 *                 regionId:
 *                   type: [integer, "null"]
 *                   description: Region ID only present if source is 'market'
 *                   example: 10000002
 */
export default defineEventHandler(async (event) => {
  const { params, query } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
    query: z.object({
      regionId: z.coerce.number().int().positive().default(10000002),
    }),
  });

  const { id } = params;
  const { regionId } = query;

  // Get custom price first
  const customPrice = await database.findOne(
    'SELECT * FROM customprices WHERE "typeId" = :id',
    { id }
  );

  if (customPrice) {
    return {
      typeId: id,
      price: customPrice.price,
      source: 'custom',
    };
  }

  // Get market price for region
  const marketPrice = await database.findOne(
    'SELECT * FROM prices WHERE "typeId" = :id AND "regionId" = :regionId',
    { id, regionId }
  );

  if (marketPrice) {
    return {
      typeId: id,
      price: marketPrice.averagePrice,
      source: 'market',
      regionId,
    };
  }

  // TODO: Calculate build price from blueprints if available

  return {
    typeId: id,
    price: 0,
    source: 'none',
  };
});

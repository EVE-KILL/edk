import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/prices/type_id/{id}:
 *   get:
 *     summary: Get price for a specific item type
 *     description: Returns the price for a specific item type using priority order - custom prices > market prices > build prices > 0. Market price defaults to Jita region (10000002) unless specified.
 *     tags:
 *       - Prices
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
 *         description: Item price information
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

  // Priority: custom prices > market prices > build prices > 0

  // 1. Check custom price
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

  // 2. Check market price for region
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

  // 3. TODO: Calculate build price from blueprints
  // const buildPrice = await calculateBuildPrice(id);
  // if (buildPrice > 0) {
  //   return {
  //     typeId: id,
  //     price: buildPrice,
  //     source: 'build',
  //   };
  // }

  // 4. Return 0 as fallback
  return {
    typeId: id,
    price: 0,
    source: 'none',
  };
});

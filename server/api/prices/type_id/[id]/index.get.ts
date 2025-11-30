import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/prices/type_id/{id}:
 *   get:
 *     summary: Get price for a type ID
 *     description: Returns the price for an item using custom prices > market prices > build prices > 0.
 *     tags:
 *       - Prices
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The type ID
 *         schema:
 *           type: integer
 *           example: 587
 *       - name: regionId
 *         in: query
 *         description: Region ID for market prices (default: Jita)
 *         schema:
 *           type: integer
 *           default: 10000002
 *     responses:
 *       '200':
 *         description: Item price information
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
  const customPrice = await database.findOne('customprices', { typeId: id });

  if (customPrice) {
    return {
      typeId: id,
      price: customPrice.price,
      source: 'custom',
    };
  }

  // 2. Check market price for region
  const marketPrice = await database.findOne('prices', {
    typeId: id,
    regionId,
  });

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

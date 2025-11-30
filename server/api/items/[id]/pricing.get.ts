import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/items/{id}/pricing:
 *   get:
 *     summary: Get item pricing information
 *     description: Returns price data for the item type (custom, market, build prices).
 *     tags:
 *       - Items
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
 *         description: Item pricing information
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
  const customPrice = await database.findOne('customprices', { typeId: id });

  if (customPrice) {
    return {
      typeId: id,
      price: customPrice.price,
      source: 'custom',
    };
  }

  // Get market price for region
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

  // TODO: Calculate build price from blueprints if available

  return {
    typeId: id,
    price: 0,
    source: 'none',
  };
});

import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/items/{id}:
 *   get:
 *     summary: Get item/type details by ID
 *     description: Returns comprehensive item type information including metadata, icons, descriptions, and market group classification from the Static Data Export.
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
 *     responses:
 *       '200':
 *         description: Item/type details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - typeId
 *                 - name
 *                 - groupId
 *               properties:
 *                 typeId:
 *                   type: integer
 *                   example: 34
 *                 name:
 *                   type: string
 *                   example: "Tritanium"
 *                 description:
 *                   type: string
 *                   example: "The main building block in space structures..."
 *                 groupId:
 *                   type: integer
 *                   example: 18
 *                 capacity:
 *                   type: [number, "null"]
 *                   example: null
 *                 factionId:
 *                   type: [integer, "null"]
 *                   example: null
 *                 graphicId:
 *                   type: [integer, "null"]
 *                   example: null
 *                 iconId:
 *                   type: [integer, "null"]
 *                   example: 22
 *                 marketGroupId:
 *                   type: [integer, "null"]
 *                   example: 1857
 *                 mass:
 *                   type: [number, "null"]
 *                   example: null
 *                 metaGroupId:
 *                   type: [integer, "null"]
 *                   example: null
 *                 portionSize:
 *                   type: integer
 *                   example: 1
 *                 published:
 *                   type: boolean
 *                   example: true
 *                 raceId:
 *                   type: [integer, "null"]
 *                   example: null
 *                 radius:
 *                   type: [number, "null"]
 *                   example: null
 *                 soundId:
 *                   type: [integer, "null"]
 *                   example: null
 *                 volume:
 *                   type: number
 *                   example: 0.01
 *       '404':
 *         description: Item/type not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                   example: 404
 *                 statusMessage:
 *                   type: string
 *                   example: "Item/type not found"
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  });

  const { id } = params;

  const type = await database.findOne(
    'SELECT * FROM types WHERE "typeId" = :id',
    { id }
  );

  if (!type) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Item/type not found',
    });
  }

  return type;
});

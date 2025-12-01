import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Type } from '~/models/types';

/**
 * @openapi
 * /api/sde/types/{id}:
 *   get:
 *     summary: Get type by ID
 *     description: Returns a single type from the Static Data Export.
 *     tags:
 *       - SDE - Types
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The type ID
 *         schema:
 *           type: integer
 *           example: 34
 *     responses:
 *       '200':
 *         description: Type details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - typeId
 *                 - name
 *                 - groupId
 *                 - published
 *               properties:
 *                 typeId:
 *                   type: integer
 *                   description: Unique type identifier
 *                 name:
 *                   type: string
 *                   description: Type name
 *                 description:
 *                   type: [string, 'null']
 *                   description: Type description (HTML formatted)
 *                 groupId:
 *                   type: integer
 *                   description: Group this type belongs to
 *                 capacity:
 *                   type: [number, 'null']
 *                   description: Capacity (for containers)
 *                 factionId:
 *                   type: [integer, 'null']
 *                   description: Associated faction ID
 *                 graphicId:
 *                   type: [integer, 'null']
 *                   description: Graphic ID
 *                 iconId:
 *                   type: [integer, 'null']
 *                   description: Icon ID
 *                 marketGroupId:
 *                   type: [integer, 'null']
 *                   description: Market group ID
 *                 mass:
 *                   type: [number, 'null']
 *                   description: Mass in kg
 *                 metaGroupId:
 *                   type: [integer, 'null']
 *                   description: Meta group ID (tech level, faction, etc.)
 *                 portionSize:
 *                   type: integer
 *                   description: Portion size for reprocessing
 *                 published:
 *                   type: boolean
 *                   description: Whether type is published
 *                 raceId:
 *                   type: [integer, 'null']
 *                   description: Associated race ID
 *                 radius:
 *                   type: [number, 'null']
 *                   description: Radius in meters
 *                 soundId:
 *                   type: [integer, 'null']
 *                   description: Sound ID
 *                 volume:
 *                   type: [number, 'null']
 *                   description: Volume in m³
 *       '404':
 *         description: Type not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The type ID'),
    }),
  });

  const item = await database.findOne<Type>(
    `SELECT * FROM types WHERE "typeId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Type not found',
    });
  }

  return item;
});

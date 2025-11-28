/**
 * Debug command to check items for a specific killmail
 */

import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';
import { getFlagName } from '../../server/models/inventoryFlags';

export default {
  description: 'Check items for a specific killmail',
  options: [
    {
      flags: '-i, --id <killmailId>',
      description: 'Killmail ID to check',
      defaultValue: '131526602',
    },
  ],
  async action({ id }: { id: string }) {
    try {
      const killmailId = parseInt(id, 10);
      logger.info(`Checking items for killmail ${killmailId}...`);

      const sql = database.sql;

      const items = await sql`
        SELECT
          i.id,
          i."itemTypeId",
          t.name as item_name,
          i.flag,
          i."quantityDropped",
          i."quantityDestroyed",
          i."parentItemId",
          i.singleton
        FROM items i
        LEFT JOIN types t ON t."typeId" = i."itemTypeId"
        WHERE i."killmailId" = ${killmailId}
        ORDER BY i.flag, i.id
      `;

      logger.success(`Found ${items.length} items`);

      for (const item of items) {
        const flagName = getFlagName(item.flag);
        const status = item.quantityDestroyed > 0 ? 'destroyed' : 'dropped';
        const parent = item.parentItemId
          ? ` (parent: ${item.parentItemId})`
          : '';
        logger.info(
          `  Flag ${item.flag} (${flagName}): ${item.item_name || 'Unknown'} ` +
            `x${item.quantityDropped + item.quantityDestroyed} ${status}${parent}`
        );
      }

      // Check for flag 179 specifically
      const flag179Items = items.filter((i: any) => i.flag === 179);
      if (flag179Items.length > 0) {
        logger.info('\n=== Flag 179 (Frigate Escape Bay) Items ===');
        for (const item of flag179Items) {
          logger.info(
            `  ${item.item_name}: quantity=${item.quantityDropped + item.quantityDestroyed}, parentItemId=${item.parentItemId}`
          );
        }
      } else {
        logger.warn('No items found with flag 179 (Frigate Escape Bay)');
      }
    } catch (error) {
      logger.error('Failed to check killmail items:', error);
      throw error;
    }
  },
};

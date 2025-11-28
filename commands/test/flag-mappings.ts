/**
 * Test flag mappings from inventoryFlags model
 */

import {
  loadFlagMappings,
  getFlagName,
  getAllFlags,
} from '../../server/models/inventoryFlags';
import { logger } from '../../server/helpers/logger';

export default {
  description: 'Test hardcoded flag mappings from ESI eve-glue',
  action() {
    try {
      logger.info('Loading flag mappings...');
      const mappings = loadFlagMappings();

      logger.success(`Loaded ${mappings.size} flag mappings`);

      // Display all mappings
      logger.info('\nFlag mappings:');
      const sortedFlags = Array.from(mappings.entries()).sort(
        (a, b) => a[0] - b[0]
      );

      for (const [flag, name] of sortedFlags) {
        logger.info(`  ${flag}: ${name}`);
      }

      // Test specific flags
      logger.info('\nTesting specific flags:');
      const testFlags = [5, 87, 133, 134, 179];

      for (const flag of testFlags) {
        const name = getFlagName(flag);
        logger.info(`  Flag ${flag}: ${name}`);
      }

      // Show total count
      const allFlags = getAllFlags();
      logger.info(`\nTotal flags defined: ${allFlags.length}`);

      logger.success('Flag mappings test completed');
    } catch (error) {
      logger.error('Failed to test flag mappings:', error);
      throw error;
    }
  },
};

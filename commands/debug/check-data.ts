import { database } from '../../server/helpers/database'
import chalk from 'chalk'
import { logger } from '../../server/helpers/logger'

export default {
  description: 'Debug: Check raw data in database for a specific killmail',
  options: [
    {
      flags: '-i, --id <killmail_id>',
      description: 'The killmail ID to check'
    }
  ],
  async action(options: { id?: string }) {
    if (!options.id) {
      logger.error('Usage: bun run cli debug:check-data --id <killmail_id>')
      return
    }

    const killmailId = parseInt(options.id, 10);

    logger.info(`Checking data for killmail ${chalk.cyan(killmailId.toString())}...`);

    try {
      // Check killmail
      const killmail = await database.query(
        `SELECT * FROM edk.killmails WHERE killmailId = {id:UInt32}`,
        { id: killmailId }
      );

      logger.success(`Killmail exists: ${killmail.length > 0 ? chalk.green('✓') : chalk.red('✗')}`, { data: killmail[0] });

      // Check attackers
      const attackers = await database.query(
        `SELECT COUNT(*) as count FROM edk.attackers WHERE killmailId = {id:UInt32}`,
        { id: killmailId }
      );

      logger.success(`Attackers count: ${chalk.blue((attackers[0]?.count || 0).toString())}`, attackers);

      // Check items
      const items = await database.query(
        `SELECT COUNT(*) as count FROM edk.items WHERE killmailId = {id:UInt32}`,
        { id: killmailId }
      );

      logger.success(`Items count: ${chalk.blue((items[0]?.count || 0).toString())}`, items);

      // Check materialized view data
      const viewData = await database.query(
        `SELECT
          killmail_id,
          killmail_time,
          length(attackers_array) as attacker_count,
          length(items_array) as item_count,
          attackers_array,
          items_array
        FROM edk.killmails_esi WHERE killmail_id = {id:UInt32}`,
        { id: killmailId }
      );

      // Test the subqueries separately
      logger.info('Testing attackers subquery...');
      const attackersSubquery = await database.query(
        `SELECT
          killmailId,
          groupArray(
            tuple(
              allianceId,
              characterId,
              corporationId,
              damageDone,
              finalBlow,
              securityStatus,
              shipTypeId,
              weaponTypeId
            )
          ) as attackers_array
        FROM edk.attackers
        WHERE killmailId = {id:UInt32}
        GROUP BY killmailId`,
        { id: killmailId }
      );
      logger.success('Attackers subquery result:', attackersSubquery);

      logger.info('Testing items subquery...');
      const itemsSubquery = await database.query(
        `SELECT
          killmailId,
          groupArray(
            tuple(
              flag,
              itemTypeId,
              quantityDropped,
              quantityDestroyed,
              singleton
            )
          ) as items_array
        FROM edk.items
        WHERE killmailId = {id:UInt32}
        GROUP BY killmailId`,
        { id: killmailId }
      );
      logger.success('Items subquery result:', itemsSubquery);

      logger.info('Materialized view data:');
      if (viewData.length > 0) {
        logger.success('View data found:', viewData[0]);
      } else {
        logger.warn('No view data found!');
      }
    } catch (error) {
      logger.error('Error:', { error: String(error) });
    }
  }
}

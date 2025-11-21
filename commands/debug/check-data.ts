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
      const killmail = await database.sql<any[]>`
        SELECT * FROM killmails WHERE "killmailId" = ${killmailId}
      `;

      logger.success(`Killmail exists: ${killmail.length > 0 ? chalk.green('✓') : chalk.red('✗')}`, { data: killmail[0] });

      // Check attackers
      const attackers = await database.sql<{count: number}[]>`
        SELECT COUNT(*) as count FROM attackers WHERE "killmailId" = ${killmailId}
      `;

      logger.success(`Attackers count: ${chalk.blue((attackers[0]?.count || 0).toString())}`, attackers);

      // Check items
      const items = await database.sql<{count: number}[]>`
        SELECT COUNT(*) as count FROM items WHERE "killmailId" = ${killmailId}
      `;

      logger.success(`Items count: ${chalk.blue((items[0]?.count || 0).toString())}`, items);

    } catch (error) {
      logger.error('Error:', { error: String(error) });
    }
  }
}

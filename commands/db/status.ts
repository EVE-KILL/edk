import { getMigrations, getAppliedMigrations } from '~/server/helpers/migrator';
import { logger } from '~/server/helpers/logger';
import chalk from 'chalk';

export default {
  description: 'Show the status of all migrations',
  action: async () => {
    const allMigrations = await getMigrations();
    const appliedMigrations = await getAppliedMigrations();
    const appliedSet = new Set(appliedMigrations);

    logger.info(chalk.bold('Migration Status'));
    logger.info('----------------');

    for (const migration of allMigrations) {
      const status = appliedSet.has(migration.upFile)
        ? chalk.green('Applied')
        : chalk.yellow('Pending');
      logger.info(`${status.padEnd(15)} ${migration.upFile}`);
    }
  },
};

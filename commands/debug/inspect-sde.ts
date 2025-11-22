import {
  streamParseJSONLines,
  extractLanguageField,
} from '../../server/helpers/sde/parser';
import { join } from 'path';
import chalk from 'chalk';
import { logger } from '../../server/helpers/logger';

export default {
  description: 'Debug: Inspect raw parsed SDE data for a specific table',
  options: [
    {
      flags: '-t, --table <table_name>',
      description: 'Table name to inspect (e.g., mapSolarSystems, types, etc.)',
    },
    {
      flags: '-l, --limit <count>',
      description: 'Number of records to inspect (default: 2)',
    },
  ],
  async action(options: { table?: string; limit?: string }) {
    if (!options.table) {
      logger.error(
        'Usage: bun cli debug:inspect-sde --table <table_name> [--limit <count>]'
      );
      logger.error(
        'Example: bun cli debug:inspect-sde --table mapSolarSystems --limit 1'
      );
      return;
    }

    const limit = options.limit ? parseInt(options.limit, 10) : 2;
    const filepath = join(
      process.cwd(),
      '.data',
      'sde',
      'extracted',
      `${options.table}.jsonl`
    );

    logger.info(
      `Inspecting ${chalk.cyan(options.table)} (first ${chalk.yellow(limit.toString())} records)...`
    );

    try {
      let count = 0;
      for await (const row of streamParseJSONLines(filepath)) {
        logger.debug(`Record ${chalk.blue((count + 1).toString())}`, row);

        // Show extracted values for key fields
        if (row.name) {
          logger.success(
            `name extraction: ${chalk.green(extractLanguageField(row.name, 'en'))}`
          );
        }
        if (row.description) {
          logger.success(
            `description extraction: ${chalk.green(extractLanguageField(row.description, 'en'))}`
          );
        }
        if (row.position?.x !== undefined) {
          logger.success(
            `position.x type: ${typeof row.position.x} = ${chalk.cyan(row.position.x.toString())}`
          );
        }

        count++;
        if (count >= limit) break;
      }

      logger.success(`Inspected ${chalk.green(count.toString())} records`);
    } catch (error) {
      logger.error('Error:', { error: String(error) });
    }
  },
};

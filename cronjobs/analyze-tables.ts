import { database } from '../server/helpers/database';
import { logger } from '../server/helpers/logger';

export const name = 'analyze-tables';
export const schedule = '0 2 * * *'; // Run at 2 AM every day

export async function run() {
  const sql = database.sql;

  try {
    logger.info('Starting scheduled database analysis...');
    
    // Analyze only the large, frequently updated tables
    const tables = [
      'killmails',
      'attackers', 
      'items',
      'characters',
      'corporations',
      'alliances'
    ];

    const startTime = performance.now();
    
    for (const table of tables) {
      try {
        await sql`ANALYZE ${sql(table)}`;
        logger.info(`Analyzed table: ${table}`);
      } catch (error) {
        logger.error(`Failed to analyze ${table}`, { error });
      }
    }

    const totalTime = (performance.now() - startTime).toFixed(2);
    logger.success(`Database analysis complete in ${totalTime}ms`);

  } catch (error) {
    logger.error('Failed to run scheduled database analysis', { error });
  }
}

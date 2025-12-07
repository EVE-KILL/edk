import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';

export default {
  description: 'Count kills in Jita over the last 14 days',
  action: async () => {
    try {
      // 1. Get Jita ID
      const jita = await database.findOne<{ solarSystemId: number }>(
        'SELECT "solarSystemId" FROM solarsystems WHERE name = \'Jita\''
      );

      if (!jita) {
        logger.error('Could not find Jita in solarsystems table.');
        process.exit(1);
      }

      const jitaId = jita.solarSystemId;
      logger.info(`Jita Solar System ID: ${jitaId}`);

      // 2. Count kills
      const result = await database.findOne<{ count: number }>(
        `SELECT COUNT(*) as count
         FROM killmails
         WHERE "solarSystemId" = :jitaId
           AND "killmailTime" >= NOW() - INTERVAL '14 days' `,
        { jitaId }
      );

      logger.info(`Kills in Jita (last 14 days): ${result?.count || 0}`);
    } catch (error) {
      logger.error('Error querying database:', { error });
    } finally {
      await database.close();
      process.exit(0);
    }
  },
};

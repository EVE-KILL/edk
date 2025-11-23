import { database } from '../server/helpers/database';
import { activeConnectionsGauge } from '../server/helpers/metrics';
import { env } from '../server/helpers/env';

export const name = 'db-metrics';
export const schedule = '*/5 * * * * *'; // Every 5 seconds
export const description = 'Collects database connection metrics';

export const action = async () => {
  if (env.NODE_ENV !== 'test') {
    const result = await database.findOne<{ count: number }>(
      `SELECT count(*) as count FROM pg_stat_activity`
    );
    const count = Number(result?.count || 0);
    activeConnectionsGauge.set(count);
  }
};

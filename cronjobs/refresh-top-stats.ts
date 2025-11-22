import { database } from '../server/helpers/database'

const logger = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
}

export const name = 'refresh-top-stats'
export const description = 'Refreshes the top statistics materialized views'
export const schedule = '*/15 * * * *' // Every 15 minutes

export const action = async () => {
  logger.info('Refreshing top statistics materialized views...')
  await database.sql`REFRESH MATERIALIZED VIEW CONCURRENTLY top_characters_weekly`
  await database.sql`REFRESH MATERIALIZED VIEW CONCURRENTLY top_corporations_weekly`
  await database.sql`REFRESH MATERIALIZED VIEW CONCURRENTLY top_alliances_weekly`
  await database.sql`REFRESH MATERIALIZED VIEW CONCURRENTLY top_systems_weekly`
  await database.sql`REFRESH MATERIALIZED VIEW CONCURRENTLY top_regions_weekly`
  logger.info('Finished refreshing top statistics materialized views.')
}

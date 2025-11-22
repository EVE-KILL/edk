import { database } from '../server/helpers/database'

const logger = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
}

export const name = 'refresh-top-stats'
export const description = 'Refreshes the top statistics materialized views'
export const schedule = '2,17,32,47 * * * *' // Every 15 minutes, offset from kill_list to avoid lock contention

export const action = async () => {
  try {
    logger.info('Refreshing top statistics materialized views...')
    await database.sql`REFRESH MATERIALIZED VIEW CONCURRENTLY top_characters_weekly`
    await database.sql`REFRESH MATERIALIZED VIEW CONCURRENTLY top_corporations_weekly`
    await database.sql`REFRESH MATERIALIZED VIEW CONCURRENTLY top_alliances_weekly`
    await database.sql`REFRESH MATERIALIZED VIEW CONCURRENTLY top_systems_weekly`
    await database.sql`REFRESH MATERIALIZED VIEW CONCURRENTLY top_regions_weekly`
    logger.info('Finished refreshing top statistics materialized views.')
  } catch (error) {
    logger.error(`Failed to refresh top statistics views: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

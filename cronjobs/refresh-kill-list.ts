import { database } from '../server/helpers/database'

const logger = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
}

export const name = 'refresh-kill-list'
export const description = 'Refreshes the kill_list materialized view'
export const schedule = '* * * * *' // Every minute

export const action = async () => {
  logger.info('Refreshing kill_list materialized view...')
  await database.sql`REFRESH MATERIALIZED VIEW CONCURRENTLY kill_list`
  logger.info('Finished refreshing kill_list materialized view.')
}

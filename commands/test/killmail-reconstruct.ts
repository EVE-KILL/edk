import { getKillmail } from '../../server/models/killmails-esi'
import chalk from 'chalk'
import { logger } from '../../server/helpers/logger'

/**
 * Test command to verify killmail reconstruction from database
 *
 * Usage:
 *   bun run cli test:killmail-reconstruct --id 130756307
 *
 * This will fetch the killmail from the database and output it in ESI format
 */
export default {
  description: 'Test killmail reconstruction - Fetches from DB and outputs in ESI format',
  options: [
    {
      flags: '-i, --id <killmail_id>',
      description: 'The killmail ID to reconstruct'
    }
  ],
  async action(options: { id?: string }) {
    if (!options.id) {
      logger.error('Usage: bun run cli test:killmail-reconstruct --id <killmail_id>')
      logger.error('Example: bun run cli test:killmail-reconstruct --id 130756307')
      return
    }

    const id = parseInt(options.id, 10)

    if (isNaN(id)) {
      logger.error('Invalid killmail ID. Must be a number.')
      return
    }

    logger.info(`Fetching killmail ${chalk.cyan(id.toString())} from database...`)

    try {
      const killmail = await getKillmail(id)

      if (!killmail) {
        logger.error(`Killmail ${chalk.red(id.toString())} not found in database`)
        return
      }

      logger.success('Killmail reconstructed successfully!')
      logger.debug('Result:', killmail)
    } catch (error) {
      logger.error('Error fetching killmail:', { error: String(error) })
    }
  }
}

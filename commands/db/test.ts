import { logger } from '../../server/helpers/logger'

export default {
  description: 'Example database command',
  action: async () => {
    logger.info('Running database command!')
  }
}

import { scheduleJob, JobPriority, QueueType } from '../../server/helpers/queue';
import { logger } from '../../server/helpers/logger';

export default {
  description: 'Schedule a recurring example job',
  action: async () => {
    logger.info('Scheduling a daily price update job...');

    await scheduleJob(
      QueueType.PRICE,
      'daily-price-update',
      { typeId: 0 }, // Example data, could be a special marker for all prices
      {
        priority: JobPriority.LOW,
        repeat: {
          cron: '0 0 * * *', // Every day at midnight
        },
      }
    );

    logger.success('Successfully scheduled the daily price update job.');
    process.exit(0);
  },
};

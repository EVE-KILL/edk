import { rollbackLastBatch, rollbackTo } from '~/server/helpers/migrator';

export default {
  description: 'Rollback the last batch of migrations',
  options: [
    {
      flags: '--to <version>',
      description: 'Rollback to a specific version',
    },
  ],
  action: async (options: { to?: string }) => {
    if (options.to) {
      const version = parseInt(options.to, 10);
      await rollbackTo(version);
    } else {
      await rollbackLastBatch();
    }
  },
};

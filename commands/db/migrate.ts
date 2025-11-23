import { applyMigrations } from '~/server/helpers/migrator';

export default {
  description: 'Apply pending database migrations',
  action: async () => {
    await applyMigrations();
  },
};

import { defineNitroPlugin } from 'nitropack/runtime';
import { env } from '../helpers/env';

// Set TZ as early as possible (module scope) so Nitro inherits it before handlers run
if (!process.env.TZ) {
  process.env.TZ = 'UTC';
}

export default defineNitroPlugin(() => {
  // Importing env triggers validation at startup
  void env;
});

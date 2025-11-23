import { defineNitroPlugin } from 'nitropack/runtime';
import { env } from '../helpers/env';

export default defineNitroPlugin(() => {
  // Importing env triggers validation at startup
  void env;
});

import { defineNitroPlugin } from 'nitropack/runtime';
import { watch } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '../helpers/env';
import { createRedisClient } from '../helpers/redis';
import { clearTemplateCache } from '../helpers/templates';
import { logger } from '../helpers/logger';

const isDev = env.NODE_ENV === 'development';

export default defineNitroPlugin(async (nitroApp) => {
  if (!isDev) return;

  const redis = createRedisClient();
  const templatesDir = join(process.cwd(), 'templates');

  // Notify clients that server has restarted (Nitro HMR)
  logger.info('🔄 Dev server started - notifying clients to reload');
  await redis.publish(
    'site-direct',
    JSON.stringify({
      type: 'server-reload',
      timestamp: Date.now(),
    })
  );

  // Watch templates directory for changes
  logger.info(`👀 Watching templates directory: ${templatesDir}`);

  const watcher = watch(templatesDir, { recursive: true });

  // Debounce to avoid multiple reloads for rapid changes
  let debounceTimer: Timer | null = null;
  const DEBOUNCE_MS = 100;

  const handleTemplateChange = async (eventType: string, filename: string) => {
    if (!filename) return;

    // Only watch .hbs files
    if (!filename.endsWith('.hbs')) return;

    logger.info(`📝 Template ${eventType}: ${filename}`);

    // Clear template cache
    clearTemplateCache();

    // Debounce reload notification
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
      logger.info(`🔄 Notifying clients to reload after template change`);
      await redis.publish(
        'site-direct',
        JSON.stringify({
          type: 'template-reload',
          filename,
          timestamp: Date.now(),
        })
      );
    }, DEBOUNCE_MS);
  };

  // Start watching
  (async () => {
    try {
      for await (const event of watcher) {
        if (event.filename) {
          await handleTemplateChange(
            event.eventType || 'change',
            event.filename
          );
        }
      }
    } catch (error) {
      logger.error('Template watcher error:', { error });
    }
  })();

  // Cleanup on shutdown
  nitroApp.hooks.hook('close', async () => {
    logger.info('🛑 Stopping template watcher');
    // Close watcher - Bun's watcher doesn't have explicit close
    if (debounceTimer) clearTimeout(debounceTimer);
    await redis.quit();
  });

  logger.success('✅ Dev mode template hot reload enabled');
});

import { defineNitroConfig } from 'nitropack/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { env } from './server/helpers/env';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://nitro.build/config
export default defineNitroConfig({
  preset: 'bun',
  compatibilityDate: 'latest',
  srcDir: 'server',
  minify: true,
  sourceMap: env.NODE_ENV !== 'production',
  serveStatic: true,
  esbuild: {
    options: {
      target: 'esnext',
    },
  },
  publicAssets: [
    {
      baseURL: '/',
      dir: resolve(__dirname, `templates/${env.THEME}/public`),
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
    {
      baseURL: '/',
      dir: resolve(__dirname, `templates/default/static`),
    },
  ],
  compressPublicAssets: {
    gzip: true,
    brotli: true,
  },
  experimental: {
    websocket: true,
    asyncContext: true,
    wasm: true,
    openAPI: true,
  },
  timing: true,
  openAPI: {
    route: '/docs/openapi.json',
    meta: {
      title: 'EDK API',
      description: 'EVE Online Killboard API documentation.',
      version: '1.0.0',
    },
    ui: {
      swagger: {
        route: '/swagger',
      },
      scalar: {
        route: '/scalar',
      },
    },
  },
  routeRules: {
    '/api/status': { cache: false },
    '/api/ai/**': { cache: false, cors: true }, // Never cache AI responses
    '/api/killmail/*/esi': {
      cache: { maxAge: 3600, staleMaxAge: 3600, base: 'redis' },
    },
    '/api/auth/**': { cache: false, cors: true },
    '/api/**': { cors: true, cache: { maxAge: 60, base: 'redis' } },
    '/health': { cache: { maxAge: 5 } },

    // Site
    '/': { cache: { maxAge: 1, staleMaxAge: 5, base: 'redis' } },
    '/kills/**': { cache: { maxAge: 30, staleMaxAge: 30, base: 'redis' } },
    '/killmail/**': { cache: { maxAge: 3600, staleMaxAge: -1, base: 'redis' } },
    '/wars': { cache: { maxAge: 300, staleMaxAge: -1, base: 'redis' } },
    '/wars/**': { cache: { maxAge: 300, staleMaxAge: -1, base: 'redis' } },
    '/character/**': { cache: { maxAge: 300, staleMaxAge: -1, base: 'redis' } },
    '/corporation/**': {
      cache: { maxAge: 300, staleMaxAge: -1, base: 'redis' },
    },
    '/alliance/**': { cache: { maxAge: 300, staleMaxAge: -1, base: 'redis' } },
    '/item/**': { cache: { maxAge: 3600, staleMaxAge: -1, base: 'redis' } },
    '/system/**': { cache: { maxAge: 3600, staleMaxAge: -1, base: 'redis' } },
    '/constellation/**': {
      cache: { maxAge: 3600, staleMaxAge: -1, base: 'redis' },
    },
    '/region/**': { cache: { maxAge: 3600, staleMaxAge: -1, base: 'redis' } },
    '/status': { cache: false },
    '/docs': { cache: { maxAge: 3600, staleMaxAge: 7200, base: 'redis' } },
    '/about': { cache: { maxAge: 3600, staleMaxAge: 7200, base: 'redis' } },
  },
  imports: {
    autoImport: true,
    dirs: [
      'server/helpers/**',
      'server/models/**',
      'server/generators/**',
      'server/fetchers/**',
    ],
  },
});

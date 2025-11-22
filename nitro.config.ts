import { defineNitroConfig } from "nitropack/config"
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { env } from './server/helpers/env'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://nitro.build/config
export default defineNitroConfig({
  compatibilityDate: "latest",
  srcDir: "server",
  minify: true,
  sourceMap: env.NODE_ENV !== 'production',
  serveStatic: true,
  publicAssets: [
    {
      baseURL: '/',
      dir: resolve(__dirname, `templates/${env.THEME || 'default'}/public`),
      maxAge: 60 * 60 * 24 * 7 // 7 days
    }
  ],
  compressPublicAssets: {
    gzip: true,
    brotli: true
  },
  experimental: {
    websocket: true,
    asyncContext: true,
    wasm: true
  },
  future: {
    nativeSWR: true
  },
  routeRules: {
    '/api/killmail/*/esi': { cache: { maxAge: 3600, staleMaxAge: 3600, base: "redis" } },
    '/api/**': { cors: true, cache: { maxAge: 60, base: "redis" } },
    '/health': { cache: { maxAge: 5 } }
  },
  imports: {
    autoImport: true,
    dirs: [
      "server/helpers/**",
      "server/models/**",
      "server/generators/**",
      "server/fetchers/**"
    ]
  },
  storage: {
    cache: {
      driver: 'redis',
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      db: 0
    }
  }
});

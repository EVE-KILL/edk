import { defineNitroConfig } from "nitropack/config"

// https://nitro.build/config
export default defineNitroConfig({
  compatibilityDate: "latest",
  srcDir: "server",
  minify: true,
  sourceMap: process.env.NODE_ENV !== 'production',
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
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0
    }
  }
});

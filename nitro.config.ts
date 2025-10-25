import { defineNitroConfig } from "nitropack/config"

// https://nitro.build/config
export default defineNitroConfig({
  compatibilityDate: "latest",
  srcDir: "server",
  imports: {
    autoImport: true,
    dirs: [
      "server/helpers",
      "server/models",
      "server/generators",
      "server/fetchers"
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

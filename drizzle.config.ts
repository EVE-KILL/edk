import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_PATH || "./data/app.db",
  },
  verbose: true,
  strict: true,
});

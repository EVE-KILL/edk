import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./app/db/schema/index.ts",
  out: "./app/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_PATH || "./data/ekv4.db",
  },
  verbose: true,
  strict: true,
});

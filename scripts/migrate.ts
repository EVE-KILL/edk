import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

// Get database path from environment
const DATABASE_PATH = process.env.DATABASE_PATH || "./data/ekv4.db";

console.log("🔄 Running migrations...");
console.log(`📊 Database: ${DATABASE_PATH}`);

// Create data directory if it doesn't exist
const dataDir = DATABASE_PATH.substring(0, DATABASE_PATH.lastIndexOf("/"));
if (dataDir && !await Bun.file(dataDir).exists()) {
  require("fs").mkdirSync(dataDir, { recursive: true });
}

// Create SQLite connection
const sqlite = new Database(DATABASE_PATH, { create: true });

// Create Drizzle instance
const db = drizzle(sqlite);

// Run migrations
try {
  await migrate(db, { migrationsFolder: "./db/migrations" });
  console.log("✅ Migrations completed successfully!");
} catch (error) {
  console.error("❌ Migration failed:", error);
  process.exit(1);
} finally {
  sqlite.close();
}

import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * ESI Cache table
 * Stores ETag and Expires headers for ESI caching
 */
export const esiCache = sqliteTable(
  "esi_cache",
  {
    // Primary key
    id: integer("id").primaryKey({ autoIncrement: true }),

    // Cache key (URL or unique identifier)
    cacheKey: text("cache_key").notNull().unique(),

    // ETag from ESI response
    etag: text("etag"),

    // Expires timestamp (when cache should be refreshed)
    expiresAt: integer("expires_at", { mode: "timestamp" }),

    // Last modified timestamp
    lastModified: integer("last_modified", { mode: "timestamp" }),

    // Response data (optional, if we want to cache the actual response)
    data: text("data", { mode: "json" }),

    // Metadata
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),

    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    // Indexes for common queries
    cacheKeyIdx: index("esi_cache_key_idx").on(table.cacheKey),
    expiresAtIdx: index("esi_cache_expires_at_idx").on(table.expiresAt),
  })
);

// Type exports for TypeScript
export type ESICache = typeof esiCache.$inferSelect;
export type NewESICache = typeof esiCache.$inferInsert;

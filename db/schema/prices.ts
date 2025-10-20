import {
  sqliteTable,
  integer,
  real,
  index,
  unique,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Prices table
 * Stores market price data from EVE-KILL API for items on specific dates
 * Indexed for fast lookup by type_id and date
 */
export const prices = sqliteTable(
  "prices",
  {
    // Primary key
    id: integer("id").primaryKey({ autoIncrement: true }),

    // Item type ID (EVE item type)
    typeId: integer("type_id").notNull(),

    // Date of the price data
    date: integer("date", { mode: "timestamp" }).notNull(),

    // Price data from EVE-KILL API (region-agnostic average)
    average: real("average"),
    highest: real("highest"),
    lowest: real("lowest"),

    // Market activity
    orderCount: integer("order_count"),
    volume: integer("volume"),

    // Metadata
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    // Unique constraint: one price per type_id per date
    typeIdDateUnique: unique("prices_type_id_date_unique").on(
      table.typeId,
      table.date
    ),

    // Indexes for common queries
    typeIdIdx: index("prices_type_id_idx").on(table.typeId),
    dateIdx: index("prices_date_idx").on(table.date),
    typeIdDateIdx: index("prices_type_id_date_idx").on(table.typeId, table.date),
  })
);

// Type exports for TypeScript
export type Price = typeof prices.$inferSelect;
export type NewPrice = typeof prices.$inferInsert;

import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Categories table
 * Stores EVE Online item categories from SDE
 */
export const categories = sqliteTable(
  "categories",
  {
    // Category ID (primary key, from SDE)
    categoryId: integer("category_id").primaryKey(),

    // Category name (English)
    name: text("name").notNull(),

    // Published status
    published: integer("published", { mode: "boolean" }).notNull().default(false),

    // Icon ID (optional)
    iconId: integer("icon_id"),

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
    nameIdx: index("category_name_idx").on(table.name),
    publishedIdx: index("category_published_idx").on(table.published),
  })
);

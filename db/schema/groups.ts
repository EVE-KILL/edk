import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Groups table
 * Stores EVE Online item groups from SDE
 */
export const groups = sqliteTable(
  "groups",
  {
    // Group ID (primary key, from SDE)
    groupId: integer("group_id").primaryKey(),

    // Group name (English)
    name: text("name").notNull(),

    // Category ID (foreign key)
    categoryId: integer("category_id").notNull(),

    // Published status
    published: integer("published", { mode: "boolean" }).notNull().default(false),

    // Icon ID (optional)
    iconId: integer("icon_id"),

    // Anchorable
    anchorable: integer("anchorable", { mode: "boolean" }).notNull().default(false),

    // Anchored
    anchored: integer("anchored", { mode: "boolean" }).notNull().default(false),

    // Fittable non-singleton
    fittableNonSingleton: integer("fittable_non_singleton", { mode: "boolean" }).notNull().default(false),

    // Use base price
    useBasePrice: integer("use_base_price", { mode: "boolean" }).notNull().default(false),

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
    nameIdx: index("group_name_idx").on(table.name),
    categoryIdIdx: index("group_category_id_idx").on(table.categoryId),
    publishedIdx: index("group_published_idx").on(table.published),
  })
);

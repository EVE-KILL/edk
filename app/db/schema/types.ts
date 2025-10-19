import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Types table
 * Stores EVE Online type data (ships, items, modules, etc.) from ESI
 */
export const types = sqliteTable(
  "types",
  {
    // Type ID (primary key, from ESI)
    typeId: integer("type_id").primaryKey(),

    // Type name
    name: text("name").notNull(),

    // Description
    description: text("description"),

    // Group ID
    groupId: integer("group_id").notNull(),

    // Category ID (derived from group)
    categoryId: integer("category_id"),

    // Published (is this type published/visible)
    published: integer("published", { mode: "boolean" }).notNull().default(true),

    // Market group ID
    marketGroupId: integer("market_group_id"),

    // Mass
    mass: text("mass"),

    // Volume
    volume: text("volume"),

    // Capacity
    capacity: text("capacity"),

    // Portion size
    portionSize: integer("portion_size"),

    // Radius
    radius: text("radius"),

    // Icon ID
    iconId: integer("icon_id"),

    // Graphic ID
    graphicId: integer("graphic_id"),

    // Raw JSON from ESI (for any additional fields)
    rawData: text("raw_data", { mode: "json" }),

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
    nameIdx: index("type_name_idx").on(table.name),
    groupIdIdx: index("type_group_id_idx").on(table.groupId),
    categoryIdIdx: index("type_category_id_idx").on(table.categoryId),
    publishedIdx: index("type_published_idx").on(table.published),
    updatedAtIdx: index("type_updated_at_idx").on(table.updatedAt),
  })
);

// Type exports for TypeScript
export type Type = typeof types.$inferSelect;
export type NewType = typeof types.$inferInsert;

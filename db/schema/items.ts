import { sqliteTable, integer, index, foreignKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { killmails } from "./killmails";

/**
 * Items table
 * Stores dropped/destroyed items for each killmail (1:many relationship with killmails)
 */
export const items = sqliteTable(
  "items",
  {
    // Primary key
    id: integer("id").primaryKey({ autoIncrement: true }),

    // Foreign key to killmail
    killmailId: integer("killmail_id").notNull().references(() => killmails.id, { onDelete: "cascade" }),

    // Item details
    itemTypeId: integer("item_type_id").notNull(),
    quantity: integer("quantity").notNull(),
    flag: integer("flag").notNull(),
    singleton: integer("singleton").notNull(),

    // Flags
    dropped: integer("dropped", { mode: "boolean" }).notNull().default(false),
    destroyed: integer("destroyed", { mode: "boolean" }).notNull().default(false),

    // Metadata
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    // Indexes for common queries
    killmailIdIdx: index("item_killmail_id_idx").on(table.killmailId),
    itemTypeIdIdx: index("item_item_type_id_idx").on(table.itemTypeId),
    droppedIdx: index("item_dropped_idx").on(table.dropped),
    destroyedIdx: index("item_destroyed_idx").on(table.destroyed),
  })
);

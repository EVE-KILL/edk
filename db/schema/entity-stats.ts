import { sqliteTable, integer, text, index, primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Entity Stats Materialized Table
 * Stores pre-calculated statistics for each character, corporation, and alliance
 * Updated incrementally via queue jobs after each killmail value is calculated
 * This avoids the need to recalculate for millions of entities
 */
export const entityStats = sqliteTable(
  "entity_stats",
  {
    // Entity type and ID (composite primary key)
    entityType: text("entity_type").notNull(), // 'character' | 'corporation' | 'alliance'
    entityId: integer("entity_id").notNull(),

    // Kill statistics
    kills: integer("kills").notNull().default(0),
    losses: integer("losses").notNull().default(0),

    // ISK values (stored as text to handle large numbers)
    iskDestroyed: text("isk_destroyed").notNull().default("0"),
    iskLost: text("isk_lost").notNull().default("0"),

    // Calculated metrics
    killLossRatio: text("kill_loss_ratio").notNull().default("0"), // Stored as text for precision
    efficiency: text("efficiency").notNull().default("0"), // Percentage as text
    iskEfficiency: text("isk_efficiency").notNull().default("0"), // Percentage as text

    // Metadata
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    // Composite primary key on entity_type + entity_id (one row per entity)
    pk: primaryKey({
      columns: [table.entityType, table.entityId],
    }),

    // Indexes for common queries
    entityTypeIdx: index("entity_stats_type_idx").on(table.entityType),
    updatedAtIdx: index("entity_stats_updated_at_idx").on(table.updatedAt),
    killsIdx: index("entity_stats_kills_idx").on(table.kills),
    iskDestroyedIdx: index("entity_stats_isk_destroyed_idx").on(table.iskDestroyed),
  })
);

// Type exports for TypeScript
export type EntityStat = typeof entityStats.$inferSelect;
export type NewEntityStat = typeof entityStats.$inferInsert;

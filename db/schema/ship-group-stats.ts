import { sqliteTable, integer, text, index, primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Per-Entity Ship Group Stats Materialized Table
 * Stores pre-calculated ship group statistics for each character, corporation, and alliance
 * Updated incrementally via queue jobs after each killmail value is calculated
 *
 * This avoids the need to perform complex JOINs across victims/attackers/killmails/types/groups
 * when fetching entity-specific ship group stats (e.g., /character/123, /corporation/456, etc.)
 *
 * Structure:
 * - Character entities: Track which ships they killed/lost
 * - Corporation entities: Track which ships their members killed/lost
 * - Alliance entities: Track which ships their members killed/lost
 */
export const shipGroupStats = sqliteTable(
  "ship_group_stats",
  {
    // Entity identification (character, corporation, or alliance)
    entityType: text("entity_type").notNull(), // 'character' | 'corporation' | 'alliance'
    entityId: integer("entity_id").notNull(),

    // Ship group identification
    groupId: integer("group_id").notNull(),
    groupName: text("group_name").notNull(), // Denormalized for faster queries

    // Kill statistics (kills = ships destroyed, losses = ships lost)
    kills: integer("kills").notNull().default(0),
    losses: integer("losses").notNull().default(0),

    // Metadata
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    // Composite primary key: one row per (entity_type, entity_id, group_id) combination
    pk: primaryKey({
      columns: [table.entityType, table.entityId, table.groupId],
    }),

    // Indexes for common queries
    entityIdx: index("ship_group_stats_entity_idx").on(table.entityType, table.entityId),
    groupIdx: index("ship_group_stats_group_idx").on(table.groupId),
    killsIdx: index("ship_group_stats_kills_idx").on(table.kills),
    lossesIdx: index("ship_group_stats_losses_idx").on(table.losses),
    updatedAtIdx: index("ship_group_stats_updated_at_idx").on(table.updatedAt),
  })
);

// Type exports for TypeScript
export type ShipGroupStat = typeof shipGroupStats.$inferSelect;
export type NewShipGroupStat = typeof shipGroupStats.$inferInsert;


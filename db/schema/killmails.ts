import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Killmails table
 * Stores core killmail data (normalized - victim/attackers/items in separate tables)
 */
export const killmails = sqliteTable(
  "killmails",
  {
    // Primary key
    id: integer("id").primaryKey({ autoIncrement: true }),

    // Killmail unique identifier (from zkillboard/CCP)
    killmailId: integer("killmail_id").notNull().unique(),

    // Killmail hash for verification
    hash: text("hash").notNull(),

    // Timestamp of the kill
    killmailTime: integer("killmail_time", { mode: "timestamp" }).notNull(),

    // Solar system ID where kill occurred
    solarSystemId: integer("solar_system_id").notNull(),

    // Attacker count
    attackerCount: integer("attacker_count").notNull().default(0),

    // ISK Values (calculated from items + prices)
    shipValue: text("ship_value").notNull().default("0"),
    fittedValue: text("fitted_value").notNull().default("0"),
    droppedValue: text("dropped_value").notNull().default("0"),
    destroyedValue: text("destroyed_value").notNull().default("0"),
    totalValue: text("total_value").notNull().default("0"),

    // Points (from zkillboard)
    points: integer("points").notNull().default(0),

    // Flags
    isSolo: integer("is_solo", { mode: "boolean" }).notNull().default(false),
    isNpc: integer("is_npc", { mode: "boolean" }).notNull().default(false),

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
    killmailIdIdx: index("killmail_killmail_id_idx").on(table.killmailId),
    killmailTimeIdx: index("killmail_time_idx").on(table.killmailTime),
    solarSystemIdIdx: index("killmail_solar_system_id_idx").on(
      table.solarSystemId
    ),
    isSoloIdx: index("killmail_is_solo_idx").on(table.isSolo),
    isNpcIdx: index("killmail_is_npc_idx").on(table.isNpc),
    totalValueIdx: index("killmail_total_value_idx").on(table.totalValue),
    // Composite index for common list queries (time DESC + system)
    timeSystemIdx: index("killmail_time_desc_system_idx").on(table.killmailTime, table.solarSystemId),
  })
);

// Type exports for TypeScript
export type Killmail = typeof killmails.$inferSelect;
export type NewKillmail = typeof killmails.$inferInsert;

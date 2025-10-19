import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Alliances table
 * Stores EVE Online alliance data from ESI
 */
export const alliances = sqliteTable(
  "alliances",
  {
    // Alliance ID (primary key, from ESI)
    allianceId: integer("alliance_id").primaryKey(),

    // Alliance name
    name: text("name").notNull(),

    // Alliance ticker
    ticker: text("ticker").notNull(),

    // Creator corporation ID
    creatorCorporationId: integer("creator_corporation_id").notNull(),

    // Creator character ID
    creatorId: integer("creator_id").notNull(),

    // Date founded
    dateFounded: integer("date_founded", { mode: "timestamp" }).notNull(),

    // Executor corporation ID (current leader)
    executorCorporationId: integer("executor_corporation_id"),

    // Faction ID (optional)
    factionId: integer("faction_id"),

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
    nameIdx: index("alliance_name_idx").on(table.name),
    tickerIdx: index("alliance_ticker_idx").on(table.ticker),
    executorCorpIdx: index("alliance_executor_corp_idx").on(
      table.executorCorporationId
    ),
    updatedAtIdx: index("alliance_updated_at_idx").on(table.updatedAt),
  })
);

// Type exports for TypeScript
export type Alliance = typeof alliances.$inferSelect;
export type NewAlliance = typeof alliances.$inferInsert;

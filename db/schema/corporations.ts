import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Corporations table
 * Stores EVE Online corporation data from ESI
 */
export const corporations = sqliteTable(
  "corporations",
  {
    // Corporation ID (primary key, from ESI)
    corporationId: integer("corporation_id").primaryKey(),

    // Corporation name
    name: text("name").notNull(),

    // Corporation ticker
    ticker: text("ticker").notNull(),

    // CEO character ID
    ceoId: integer("ceo_id").notNull(),

    // Creator character ID
    creatorId: integer("creator_id").notNull(),

    // Date founded
    dateFounded: integer("date_founded", { mode: "timestamp" }),

    // Home station ID
    homeStationId: integer("home_station_id"),

    // Member count
    memberCount: integer("member_count").notNull().default(0),

    // Alliance ID (optional)
    allianceId: integer("alliance_id"),

    // Faction ID (optional)
    factionId: integer("faction_id"),

    // Tax rate
    taxRate: text("tax_rate"),

    // Corporation description
    description: text("description"),

    // Corporation URL
    url: text("url"),

    // War eligible
    warEligible: integer("war_eligible", { mode: "boolean" }),

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
    nameIdx: index("corporation_name_idx").on(table.name),
    tickerIdx: index("corporation_ticker_idx").on(table.ticker),
    allianceIdIdx: index("corporation_alliance_id_idx").on(table.allianceId),
    ceoIdIdx: index("corporation_ceo_id_idx").on(table.ceoId),
    updatedAtIdx: index("corporation_updated_at_idx").on(table.updatedAt),
  })
);

// Type exports for TypeScript
export type Corporation = typeof corporations.$inferSelect;
export type NewCorporation = typeof corporations.$inferInsert;

import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Characters table
 * Stores EVE Online character data from ESI
 */
export const characters = sqliteTable(
  "characters",
  {
    // Character ID (primary key, from ESI)
    characterId: integer("character_id").primaryKey(),

    // Character name
    name: text("name").notNull(),

    // Corporation ID
    corporationId: integer("corporation_id").notNull(),

    // Alliance ID (optional, not all corps are in alliances)
    allianceId: integer("alliance_id"),

    // Faction ID (optional)
    factionId: integer("faction_id"),

    // Character birthday
    birthday: integer("birthday", { mode: "timestamp" }).notNull(),

    // Security status
    securityStatus: text("security_status"),

    // Character title (optional)
    title: text("title"),

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
    nameIdx: index("character_name_idx").on(table.name),
    corporationIdIdx: index("character_corporation_id_idx").on(
      table.corporationId
    ),
    allianceIdIdx: index("character_alliance_id_idx").on(table.allianceId),
    updatedAtIdx: index("character_updated_at_idx").on(table.updatedAt),
  })
);

// Type exports for TypeScript
export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;

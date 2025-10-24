import { sqliteTable, integer, text, index, foreignKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { killmails } from "./killmails";

/**
 * Victims table
 * Stores victim data for each killmail (1:1 relationship with killmails)
 */
export const victims = sqliteTable(
  "victims",
  {
    // Primary key
    id: integer("id").primaryKey({ autoIncrement: true }),

    // Foreign key to killmail
    killmailId: integer("killmail_id").notNull().references(() => killmails.id, { onDelete: "cascade" }),

    // Character/Corporation/Alliance
    characterId: integer("character_id"),
    corporationId: integer("corporation_id").notNull(),
    allianceId: integer("alliance_id"),
    factionId: integer("faction_id"),

    // Ship
    shipTypeId: integer("ship_type_id").notNull(),

    // Damage
    damageTaken: integer("damage_taken").notNull(),

    // Position
    positionX: text("position_x"),
    positionY: text("position_y"),
    positionZ: text("position_z"),

    // Metadata
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    // Indexes for common queries
    killmailIdIdx: index("victim_killmail_id_idx").on(table.killmailId),
    characterIdIdx: index("victim_character_id_idx").on(table.characterId),
    corporationIdIdx: index("victim_corporation_id_idx").on(table.corporationId),
    allianceIdIdx: index("victim_alliance_id_idx").on(table.allianceId),
    shipTypeIdIdx: index("victim_ship_type_id_idx").on(table.shipTypeId),
    // Composite indexes for statistics aggregations (covering indexes with killmail_id for joins)
    shipKillmailIdx: index("victim_ship_killmail_idx").on(table.shipTypeId, table.killmailId),
  })
);

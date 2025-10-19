import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Killmails table
 * Stores EVE Online killmail data
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

    // Victim data (stored as JSON)
    victim: text("victim", { mode: "json" }).$type<{
      characterId?: number;
      corporationId: number;
      allianceId?: number;
      shipTypeId: number;
      damageTaken: number;
      position?: {
        x: number;
        y: number;
        z: number;
      };
    }>(),

    // Attackers data (stored as JSON array)
    attackers: text("attackers", { mode: "json" }).$type<
      Array<{
        characterId?: number;
        corporationId?: number;
        allianceId?: number;
        shipTypeId?: number;
        weaponTypeId?: number;
        damageDone: number;
        finalBlow: boolean;
      }>
    >(),

    // Fitted items (stored as JSON array)
    items: text("items", { mode: "json" }).$type<
      Array<{
        typeId: number;
        flag: number;
        quantityDropped?: number;
        quantityDestroyed?: number;
        singleton: number;
      }>
    >(),

    // Total ISK value of the killmail
    totalValue: integer("total_value"),

    // Number of attackers involved
    attackerCount: integer("attacker_count").notNull().default(0),

    // Points value (for zkillboard)
    points: integer("points"),

    // Is this killmail a solo kill?
    isSolo: integer("is_solo", { mode: "boolean" }).notNull().default(false),

    // Is this an NPC kill?
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
    killmailIdIdx: index("killmail_id_idx").on(table.killmailId),
    hashIdx: index("hash_idx").on(table.hash),
    killmailTimeIdx: index("killmail_time_idx").on(table.killmailTime),
    solarSystemIdIdx: index("solar_system_id_idx").on(table.solarSystemId),
    totalValueIdx: index("total_value_idx").on(table.totalValue),
  })
);

// Type exports for TypeScript
export type Killmail = typeof killmails.$inferSelect;
export type NewKillmail = typeof killmails.$inferInsert;

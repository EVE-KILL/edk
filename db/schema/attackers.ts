import { sqliteTable, integer, text, index, foreignKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { killmails } from "./killmails";

/**
 * Attackers table
 * Stores attacker data for each killmail (1:many relationship with killmails)
 */
export const attackers = sqliteTable(
  "attackers",
  {
    // Primary key
    id: integer("id").primaryKey({ autoIncrement: true }),

    // Foreign key to killmail
    killmailId: integer("killmail_id").notNull().references(() => killmails.id, { onDelete: "cascade" }),

    // Character/Corporation/Alliance
    characterId: integer("character_id"),
    corporationId: integer("corporation_id"),
    allianceId: integer("alliance_id"),
    factionId: integer("faction_id"),

    // Ship and Weapon
    shipTypeId: integer("ship_type_id"),
    weaponTypeId: integer("weapon_type_id"),

    // Damage
    damageDone: integer("damage_done").notNull(),
    securityStatus: text("security_status"),

    // Flags
    finalBlow: integer("final_blow", { mode: "boolean" }).notNull().default(false),

    // Metadata
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    // Indexes for common queries
    killmailIdIdx: index("attacker_killmail_id_idx").on(table.killmailId),
    characterIdIdx: index("attacker_character_id_idx").on(table.characterId),
    corporationIdIdx: index("attacker_corporation_id_idx").on(table.corporationId),
    allianceIdIdx: index("attacker_alliance_id_idx").on(table.allianceId),
    shipTypeIdIdx: index("attacker_ship_type_id_idx").on(table.shipTypeId),
    weaponTypeIdIdx: index("attacker_weapon_type_id_idx").on(table.weaponTypeId),
    finalBlowIdx: index("attacker_final_blow_idx").on(table.finalBlow),
    // Composite index for top killers query (final_blow + character_id)
    finalBlowCharacterIdx: index("attacker_final_blow_character_id_idx").on(table.finalBlow, table.characterId),
  })
);

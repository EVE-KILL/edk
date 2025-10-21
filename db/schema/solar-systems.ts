import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Solar Systems table
 * Stores EVE Online solar system data from ESI
 */
export const solarSystems = sqliteTable(
  "solar_systems",
  {
    // System ID (primary key, from ESI)
    systemId: integer("system_id").primaryKey(),

    // System name
    name: text("name").notNull(),

    // Constellation ID
    constellationId: integer("constellation_id").notNull(),

    // Region ID
    regionId: integer("region_id"),

    // Security status
    securityStatus: text("security_status").notNull(),

    // Star ID
    starId: integer("star_id"),

    // Position
    positionX: text("position_x"),
    positionY: text("position_y"),
    positionZ: text("position_z"),

    // Security class
    securityClass: text("security_class"),

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
    nameIdx: index("solar_system_name_idx").on(table.name),
    constellationIdIdx: index("solar_system_constellation_id_idx").on(
      table.constellationId
    ),
    regionIdIdx: index("solar_system_region_id_idx").on(table.regionId),
    securityStatusIdx: index("solar_system_security_status_idx").on(
      table.securityStatus
    ),
    updatedAtIdx: index("solar_system_updated_at_idx").on(table.updatedAt),
  })
);

// Type exports for TypeScript
export type SolarSystem = typeof solarSystems.$inferSelect;
export type NewSolarSystem = typeof solarSystems.$inferInsert;

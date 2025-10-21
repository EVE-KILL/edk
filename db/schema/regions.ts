import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * Regions table
 * Stores EVE Online region data from EverRef
 */
export const regions = sqliteTable("regions", {
  // Region ID (primary key)
  regionId: integer("region_id").primaryKey(),

  // Region name
  name: text("name").notNull(),

  // Description
  description: text("description"),

  // Center coordinates
  centerX: text("center_x"),
  centerY: text("center_y"),
  centerZ: text("center_z"),

  // Max/min coordinates
  maxX: text("max_x"),
  maxY: text("max_y"),
  maxZ: text("max_z"),
  minX: text("min_x"),
  minY: text("min_y"),
  minZ: text("min_z"),

  // Nebula ID
  nebulaId: integer("nebula_id"),

  // Raw data from EverRef (full JSON response)
  rawData: text("raw_data", { mode: "json" }),
});

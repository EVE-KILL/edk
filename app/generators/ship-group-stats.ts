import { db } from "../../src/db";
import { victims, groups, types, killmails, attackers, solarSystems, shipGroupStats } from "../../db/schema";
import { sql, eq, and, gte, inArray, or } from "drizzle-orm";
import type { KilllistFilters } from "./killlist";

/**
 * Ship Group Statistics Interface
 */
export interface ShipGroupStat {
  groupId: number;
  groupName: string;
  killed: number;
  lost?: number;
}

/**
 * Filters for ship group statistics (deprecated - use KilllistFilters)
 */
export interface ShipGroupStatsFilters {
  characterIds?: number[];
  corporationIds?: number[];
  allianceIds?: number[];
}

/**
 * Get ship group kill statistics for the last N days
 */
export async function getShipGroupKillStatistics(
  days: number = 30,
  filters?: ShipGroupStatsFilters
): Promise<ShipGroupStat[]> {
  // Calculate the cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Build filter conditions for kills (attacker side)
  const whereConditions: any[] = [
    eq(groups.categoryId, 6), // Category 6 is "Ship"
    eq(groups.published, true),
    gte(killmails.killmailTime, cutoffDate),
  ];

  // Add entity filters if provided (check attackers table)
  if (filters) {
    const entityFilters: any[] = [];
    if (filters.characterIds && filters.characterIds.length > 0) {
      entityFilters.push(inArray(attackers.characterId, filters.characterIds));
    }
    if (filters.corporationIds && filters.corporationIds.length > 0) {
      entityFilters.push(inArray(attackers.corporationId, filters.corporationIds));
    }
    if (filters.allianceIds && filters.allianceIds.length > 0) {
      entityFilters.push(inArray(attackers.allianceId, filters.allianceIds));
    }
    if (entityFilters.length > 0) {
      whereConditions.push(or(...entityFilters));
    }
  }

  // Query to get ship group kill statistics
  // Join through attackers to filter by who made the kills,
  // but get the victim's ship group (what was killed)
  const results = await db
    .select({
      groupId: groups.groupId,
      groupName: groups.name,
      killed: sql<number>`cast(count(distinct ${killmails.id}) as integer)`,
    })
    .from(attackers)
    .innerJoin(killmails, eq(attackers.killmailId, killmails.id))
    .innerJoin(victims, eq(killmails.id, victims.killmailId))
    .innerJoin(types, eq(victims.shipTypeId, types.typeId))
    .innerJoin(groups, eq(types.groupId, groups.groupId))
    .where(and(...whereConditions))
    .groupBy(groups.groupId, groups.name)
    .orderBy(sql`count(distinct ${killmails.id}) DESC`);

  return results.map((row) => ({
    groupId: row.groupId,
    groupName: row.groupName,
    killed: row.killed,
  }));
}

/**
 * Get ship group loss statistics for the last N days
 */
export async function getShipGroupLossStatistics(
  days: number = 30,
  filters?: ShipGroupStatsFilters
): Promise<ShipGroupStat[]> {
  // Calculate the cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Build filter conditions for losses (victim side)
  const whereConditions: any[] = [
    eq(groups.categoryId, 6), // Category 6 is "Ship"
    eq(groups.published, true),
    gte(killmails.killmailTime, cutoffDate),
  ];

  // Add entity filters if provided
  if (filters) {
    const entityFilters: any[] = [];
    if (filters.characterIds && filters.characterIds.length > 0) {
      entityFilters.push(inArray(victims.characterId, filters.characterIds));
    }
    if (filters.corporationIds && filters.corporationIds.length > 0) {
      entityFilters.push(inArray(victims.corporationId, filters.corporationIds));
    }
    if (filters.allianceIds && filters.allianceIds.length > 0) {
      entityFilters.push(inArray(victims.allianceId, filters.allianceIds));
    }
    if (entityFilters.length > 0) {
      whereConditions.push(or(...entityFilters));
    }
  }

  // Query to get ship group loss statistics
  const results = await db
    .select({
      groupId: groups.groupId,
      groupName: groups.name,
      killed: sql<number>`cast(count(*) as integer)`,
    })
    .from(victims)
    .innerJoin(killmails, eq(victims.killmailId, killmails.id))
    .innerJoin(types, eq(victims.shipTypeId, types.typeId))
    .innerJoin(groups, eq(types.groupId, groups.groupId))
    .where(and(...whereConditions))
    .groupBy(groups.groupId, groups.name)
    .orderBy(sql`count(*) DESC`);

  return results.map((row) => ({
    groupId: row.groupId,
    groupName: row.groupName,
    killed: row.killed,
  }));
}

/**
 * Get combined ship group statistics (kills and losses)
 *
 * Optimized: Queries pre-calculated materialized table instead of complex JOINs
 * Query time: ~1-2ms (vs ~50-150ms with JOIN-based queries)
 *
 * Note: This queries from the ship_group_stats materialized table, not real-time calculations.
 * Stats are updated incrementally via ship-group-stats-updater worker when killmails are processed.
 */
export async function getShipGroupCombinedStatistics(
  days: number = 30,
  filters?: ShipGroupStatsFilters
): Promise<ShipGroupStat[]> {
  // Build WHERE conditions for the materialized table
  const whereConditions: any[] = [];

  // If filters are provided (entity-specific stats), query the per-entity materialized table
  if (filters && (filters.characterIds || filters.corporationIds || filters.allianceIds)) {
    const entityFilters: any[] = [];

    // Filter by character entities
    if (filters.characterIds && filters.characterIds.length > 0) {
      entityFilters.push(
        and(
          eq(shipGroupStats.entityType, "character"),
          inArray(shipGroupStats.entityId, filters.characterIds)
        )
      );
    }

    // Filter by corporation entities
    if (filters.corporationIds && filters.corporationIds.length > 0) {
      entityFilters.push(
        and(
          eq(shipGroupStats.entityType, "corporation"),
          inArray(shipGroupStats.entityId, filters.corporationIds)
        )
      );
    }

    // Filter by alliance entities
    if (filters.allianceIds && filters.allianceIds.length > 0) {
      entityFilters.push(
        and(
          eq(shipGroupStats.entityType, "alliance"),
          inArray(shipGroupStats.entityId, filters.allianceIds)
        )
      );
    }

    if (entityFilters.length > 0) {
      whereConditions.push(or(...entityFilters));
    }

    // Query per-entity stats and aggregate by ship group
    const results = await db
      .select({
        groupId: shipGroupStats.groupId,
        groupName: shipGroupStats.groupName,
        killed: sql<number>`cast(sum(${shipGroupStats.kills}) as integer)`,
        lost: sql<number>`cast(sum(${shipGroupStats.losses}) as integer)`,
      })
      .from(shipGroupStats)
      .where(and(...whereConditions))
      .groupBy(shipGroupStats.groupId, shipGroupStats.groupName)
      .orderBy(sql`(sum(${shipGroupStats.kills}) + sum(${shipGroupStats.losses})) DESC`);

    return results;
  }

  // For global (non-filtered) queries, aggregate all entities per ship group
  const results = await db
    .select({
      groupId: shipGroupStats.groupId,
      groupName: shipGroupStats.groupName,
      killed: sql<number>`cast(sum(${shipGroupStats.kills}) as integer)`,
      lost: sql<number>`cast(sum(${shipGroupStats.losses}) as integer)`,
    })
    .from(shipGroupStats)
    .groupBy(shipGroupStats.groupId, shipGroupStats.groupName)
    .orderBy(sql`(sum(${shipGroupStats.kills}) + sum(${shipGroupStats.losses})) DESC`);

  return results;
}

/**
 * Legacy function for backwards compatibility
 */
export async function getShipGroupStatistics(
  days: number = 30
): Promise<ShipGroupStat[]> {
  return getShipGroupKillStatistics(days);
}

/**
 * Get ship group statistics with full killlist filters support
 * This applies the same filters as the killlist (security, regions, ship groups, value, etc.)
 */
export async function getShipGroupStatisticsWithFilters(
  days: number = 30,
  filters?: KilllistFilters
): Promise<ShipGroupStat[]> {
  // Calculate the cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Build filter conditions
  const whereConditions: any[] = [
    eq(groups.categoryId, 6), // Category 6 is "Ship"
    eq(groups.published, true),
    gte(killmails.killmailTime, cutoffDate),
  ];

  // Add security status filters
  if (filters?.minSecurityStatus !== undefined) {
    whereConditions.push(
      sql`CAST(${solarSystems.securityStatus} AS REAL) >= ${filters.minSecurityStatus}`
    );
  }
  if (filters?.maxSecurityStatus !== undefined) {
    whereConditions.push(
      sql`CAST(${solarSystems.securityStatus} AS REAL) <= ${filters.maxSecurityStatus}`
    );
  }

  // Add region filters
  if (filters?.regionId) {
    whereConditions.push(eq(solarSystems.regionId, filters.regionId));
  }

  // Add region range filter (for abyssal/wspace)
  if (filters?.regionIdMin !== undefined && filters?.regionIdMax !== undefined) {
    whereConditions.push(
      and(
        gte(solarSystems.regionId, filters.regionIdMin),
        sql`${solarSystems.regionId} <= ${filters.regionIdMax}`
      )
    );
  }

  // Add solo filter
  if (filters?.isSolo) {
    whereConditions.push(eq(killmails.isSolo, true));
  }

  // Add NPC filter
  if (filters?.isNpc) {
    whereConditions.push(eq(killmails.isNpc, true));
  }

  // Add minimum value filter
  if (filters?.minValue !== undefined) {
    whereConditions.push(
      sql`CAST(${killmails.totalValue} AS REAL) >= ${filters.minValue}`
    );
  }

  // If ship group IDs are specified, we need to filter by those groups
  // But for ship group stats, we want to show distribution within those groups
  // So we'll add this as a filter on the victim's ship group
  if (filters?.shipGroupIds && filters.shipGroupIds.length > 0) {
    whereConditions.push(
      sql`${groups.groupId} IN (${sql.join(filters.shipGroupIds.map(id => sql`${id}`), sql`, `)})`
    );
  }

  // Add entity filters if provided (for entity-specific pages)
  if (filters?.characterIds || filters?.corporationIds || filters?.allianceIds) {
    const entityFilters: any[] = [];

    if (filters.characterIds && filters.characterIds.length > 0) {
      if (filters.killsOnly) {
        entityFilters.push(inArray(attackers.characterId, filters.characterIds));
      } else if (filters.lossesOnly) {
        entityFilters.push(inArray(victims.characterId, filters.characterIds));
      } else {
        // Both kills and losses - this is complex, we'll keep it simple for now
        entityFilters.push(inArray(attackers.characterId, filters.characterIds));
      }
    }

    if (filters.corporationIds && filters.corporationIds.length > 0) {
      if (filters.killsOnly) {
        entityFilters.push(inArray(attackers.corporationId, filters.corporationIds));
      } else if (filters.lossesOnly) {
        entityFilters.push(inArray(victims.corporationId, filters.corporationIds));
      } else {
        entityFilters.push(inArray(attackers.corporationId, filters.corporationIds));
      }
    }

    if (filters.allianceIds && filters.allianceIds.length > 0) {
      if (filters.killsOnly) {
        entityFilters.push(inArray(attackers.allianceId, filters.allianceIds));
      } else if (filters.lossesOnly) {
        entityFilters.push(inArray(victims.allianceId, filters.allianceIds));
      } else {
        entityFilters.push(inArray(attackers.allianceId, filters.allianceIds));
      }
    }

    if (entityFilters.length > 0) {
      whereConditions.push(or(...entityFilters));
    }
  }

  // Build the query
  // For global kill type filters, we don't need to join attackers unless we have entity filters
  const needsAttackerJoin = !!(
    filters?.characterIds ||
    filters?.corporationIds ||
    filters?.allianceIds
  );

  let query;

  if (needsAttackerJoin) {
    // Query with attacker join (for entity filtering)
    query = db
      .select({
        groupId: groups.groupId,
        groupName: groups.name,
        killed: sql<number>`cast(count(distinct ${killmails.id}) as integer)`,
      })
      .from(killmails)
      .innerJoin(victims, eq(killmails.id, victims.killmailId))
      .innerJoin(types, eq(victims.shipTypeId, types.typeId))
      .innerJoin(groups, eq(types.groupId, groups.groupId))
      .leftJoin(solarSystems, eq(killmails.solarSystemId, solarSystems.systemId))
      .innerJoin(attackers, eq(killmails.id, attackers.killmailId))
      .where(and(...whereConditions))
      .groupBy(groups.groupId, groups.name)
      .orderBy(sql`count(distinct ${killmails.id}) DESC`);
  } else {
    // Query without attacker join (for global filters)
    query = db
      .select({
        groupId: groups.groupId,
        groupName: groups.name,
        killed: sql<number>`cast(count(*) as integer)`,
      })
      .from(killmails)
      .innerJoin(victims, eq(killmails.id, victims.killmailId))
      .innerJoin(types, eq(victims.shipTypeId, types.typeId))
      .innerJoin(groups, eq(types.groupId, groups.groupId))
      .leftJoin(solarSystems, eq(killmails.solarSystemId, solarSystems.systemId))
      .where(and(...whereConditions))
      .groupBy(groups.groupId, groups.name)
      .orderBy(sql`count(*) DESC`);
  }

  const results = await query;

  return results.map((row) => ({
    groupId: row.groupId,
    groupName: row.groupName,
    killed: row.killed,
  }));
}

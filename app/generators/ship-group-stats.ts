import { db } from "../../src/db";
import { victims, groups, types, killmails, attackers } from "../../db/schema";
import { sql, eq, and, gte, inArray, or } from "drizzle-orm";

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
 * Filters for ship group statistics
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
 * Get combined ship group statistics (kills and losses) for the last N days
 */
export async function getShipGroupCombinedStatistics(
  days: number = 30,
  filters?: ShipGroupStatsFilters
): Promise<ShipGroupStat[]> {
  const [killStats, lossStats] = await Promise.all([
    getShipGroupKillStatistics(days, filters),
    getShipGroupLossStatistics(days, filters),
  ]);

  // Combine the statistics
  const combined = new Map<number, ShipGroupStat>();

  // Add kills
  for (const stat of killStats) {
    combined.set(stat.groupId, {
      groupId: stat.groupId,
      groupName: stat.groupName,
      killed: stat.killed,
      lost: 0,
    });
  }

  // Add losses
  for (const stat of lossStats) {
    const existing = combined.get(stat.groupId);
    if (existing) {
      existing.lost = stat.killed;
    } else {
      combined.set(stat.groupId, {
        groupId: stat.groupId,
        groupName: stat.groupName,
        killed: 0,
        lost: stat.killed,
      });
    }
  }

  // Convert to array and sort by total activity (kills + losses)
  return Array.from(combined.values()).sort((a, b) => {
    const totalA = a.killed + (a.lost || 0);
    const totalB = b.killed + (b.lost || 0);
    return totalB - totalA;
  });
}

/**
 * Legacy function for backwards compatibility
 */
export async function getShipGroupStatistics(
  days: number = 30
): Promise<ShipGroupStat[]> {
  return getShipGroupKillStatistics(days);
}

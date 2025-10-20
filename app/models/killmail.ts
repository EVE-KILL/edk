import { BaseModel, eq, and, or, desc, asc, sql, type SQL } from "./base-model";
import { killmails, type Killmail, type NewKillmail } from "../../db/schema/killmails";

/**
 * Killmail Model
 * Handles all database operations for killmails
 */
export class KillmailModel extends BaseModel<typeof killmails, Killmail, NewKillmail> {
  protected table = killmails;
  protected idColumn = killmails.id;

  /**
   * Find a killmail by its killmail ID (from CCP/zkillboard)
   */
  async findByKillmailId(killmailId: number): Promise<Killmail | null> {
    return this.findOne(eq(killmails.killmailId, killmailId));
  }

  /**
   * Find a killmail by its hash
   */
  async findByHash(hash: string): Promise<Killmail | null> {
    return this.findOne(eq(killmails.hash, hash));
  }

  /**
   * Get recent killmails
   */
  async getRecent(limit = 50, offset = 0): Promise<Killmail[]> {
    return this.find({
      limit,
      offset,
      orderBy: desc(killmails.killmailTime),
    });
  }

  /**
   * Get killmails by solar system
   */
  async getBySolarSystem(solarSystemId: number, limit = 50): Promise<Killmail[]> {
    return this.find({
      where: eq(killmails.solarSystemId, solarSystemId),
      limit,
      orderBy: desc(killmails.killmailTime),
    });
  }

  /**
   * Get high value killmails (over a certain ISK amount)
   */
  async getHighValue(minValue: number, limit = 50): Promise<Killmail[]> {
    return this.find({
      where: sql`${killmails.totalValue} >= ${minValue}`,
      limit,
      orderBy: desc(killmails.totalValue),
    });
  }

  /**
   * Get solo killmails
   */
  async getSolo(limit = 50): Promise<Killmail[]> {
    return this.find({
      where: eq(killmails.isSolo, true),
      limit,
      orderBy: desc(killmails.killmailTime),
    });
  }

  /**
   * Get killmails within a time range
   */
  async getByTimeRange(startTime: Date, endTime: Date, limit = 100): Promise<Killmail[]> {
    return this.find({
      where: and(
        sql`${killmails.killmailTime} >= ${startTime}`,
        sql`${killmails.killmailTime} <= ${endTime}`
      )!,
      limit,
      orderBy: desc(killmails.killmailTime),
    });
  }

  /**
   * Search killmails by character, corporation, or alliance ID
   * Searches in victim and attackers data
   */
  async searchByEntity(entityId: number, limit = 50): Promise<Killmail[]> {
    // This is a more complex query that searches JSON fields
    // Using raw SQL for better performance
    const query = `
      SELECT * FROM killmails
      WHERE
        json_extract(victim, '$.characterId') = ?
        OR json_extract(victim, '$.corporationId') = ?
        OR json_extract(victim, '$.allianceId') = ?
        OR EXISTS (
          SELECT 1 FROM json_each(attackers)
          WHERE json_extract(value, '$.characterId') = ?
            OR json_extract(value, '$.corporationId') = ?
            OR json_extract(value, '$.allianceId') = ?
        )
      ORDER BY killmail_time DESC
      LIMIT ?
    `;

    return this.rawQuery<Killmail>(query, [
      entityId,
      entityId,
      entityId,
      entityId,
      entityId,
      entityId,
      limit,
    ]);
  }

  /**
   * Get statistics for a date range
   */
  async getStats(startTime?: Date, endTime?: Date): Promise<{
    total: number;
    totalValue: number;
    soloKills: number;
    npcKills: number;
    avgValue: number;
    avgAttackers: number;
  }> {
    let whereClause: SQL | undefined;

    if (startTime && endTime) {
      whereClause = and(
        sql`${killmails.killmailTime} >= ${startTime}`,
        sql`${killmails.killmailTime} <= ${endTime}`
      )!;
    } else if (startTime) {
      whereClause = sql`${killmails.killmailTime} >= ${startTime}`;
    } else if (endTime) {
      whereClause = sql`${killmails.killmailTime} <= ${endTime}`;
    }

    const result = await this.db
      .select({
        total: sql<number>`count(*)`,
        totalValue: sql<number>`sum(${killmails.totalValue})`,
        soloKills: sql<number>`sum(case when ${killmails.isSolo} then 1 else 0 end)`,
        npcKills: sql<number>`sum(case when ${killmails.isNpc} then 1 else 0 end)`,
        avgValue: sql<number>`avg(${killmails.totalValue})`,
        avgAttackers: sql<number>`avg(${killmails.attackerCount})`,
      })
      .from(killmails)
      .where(whereClause!);

    const stats = result[0];

    return {
      total: stats?.total || 0,
      totalValue: stats?.totalValue || 0,
      soloKills: stats?.soloKills || 0,
      npcKills: stats?.npcKills || 0,
      avgValue: Math.round(stats?.avgValue || 0),
      avgAttackers: Math.round(stats?.avgAttackers || 0),
    };
  }

  /**
   * Check if a killmail exists by killmail ID
   */
  async existsByKillmailId(killmailId: number): Promise<boolean> {
    return this.exists(eq(killmails.killmailId, killmailId));
  }

  /**
   * Bulk insert killmails (useful for importing data)
   */
  async bulkInsert(data: NewKillmail[]): Promise<Killmail[]> {
    return this.createMany(data);
  }

  /**
   * Delete old killmails (cleanup function)
   */
  async deleteOlderThan(date: Date): Promise<number> {
    return this.deleteWhere(sql`${killmails.killmailTime} < ${date}`);
  }
}

/**
 * Export a singleton instance
 */
export const Killmails = new KillmailModel();

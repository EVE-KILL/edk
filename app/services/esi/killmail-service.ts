import { db } from "../../../src/db";
import { killmails, victims, attackers, items, prices, types } from "../../../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { logger } from "../../../src/utils/logger";
import { EveKillProxyService } from "../../../src/services/esi/eve-kill-proxy-service";
import { ESINotFoundError } from "../../../src/services/esi/base-service";
import { priceService } from "../price-service";
import { queue } from "../../../src/queue/job-dispatcher";

/**
 * ESI Killmail Response
 */
interface ESIKillmailResponse {
  killmail_id: number;
  killmail_time: string;
  solar_system_id: number;
  victim: {
    alliance_id?: number;
    character_id?: number;
    corporation_id: number;
    damage_taken: number;
    faction_id?: number;
    items?: Array<{
      flag: number;
      item_type_id: number;
      quantity_destroyed?: number;
      quantity_dropped?: number;
      singleton: number;
    }>;
    position?: {
      x: number;
      y: number;
      z: number;
    };
    ship_type_id: number;
  };
  attackers: Array<{
    alliance_id?: number;
    character_id?: number;
    corporation_id?: number;
    damage_done: number;
    faction_id?: number;
    final_blow: boolean;
    security_status?: number;
    ship_type_id?: number;
    weapon_type_id?: number;
  }>;
  war_id?: number;
}

/**
 * Full Killmail with related data
 */
export interface FullKillmail {
  killmail: typeof killmails.$inferSelect;
  victim: typeof victims.$inferSelect;
  attackers: Array<typeof attackers.$inferSelect>;
  items: Array<typeof items.$inferSelect>;
}

/**
 * Killmail Service
 * Fetches killmail data from EVE-KILL (with ESI fallback) and stores with normalized structure
 */
export class KillmailService extends EveKillProxyService {
  /**
   * Fetch killmail from database by killmailId and hash
   * Uses JOINs for efficient data retrieval
   */
  async fetchKillmail(killmailId: number, hash: string): Promise<FullKillmail | null> {
    try {
      // Get main killmail with victim in one query
      const result = await db
        .select({
          killmail: killmails,
          victim: victims,
        })
        .from(killmails)
        .leftJoin(victims, eq(killmails.id, victims.killmailId))
        .where(
          and(
            eq(killmails.killmailId, killmailId),
            eq(killmails.hash, hash)
          )
        )
        .limit(1);

      if (!result.length || !result[0]) {
        return null;
      }

      const { killmail, victim } = result[0];

      if (!killmail || !victim) {
        logger.error(`Killmail ${killmailId} has no valid data`);
        return null;
      }

      // Get attackers
      const attackersList = await db
        .select()
        .from(attackers)
        .where(eq(attackers.killmailId, killmail.id));

      // Get items
      const itemsList = await db
        .select()
        .from(items)
        .where(eq(items.killmailId, killmail.id));

      return {
        killmail,
        victim,
        attackers: attackersList,
        items: itemsList,
      };
    } catch (error) {
      logger.error(`Failed to fetch killmail ${killmailId} from database:`, error);
      return null;
    }
  }

  /**
   * Save killmail and all related data to database
   * Handles inserts for killmail, victim, attackers, and items
   * Values start at 0 and will be calculated by the killmail-value queue worker
   */
  async saveKillmail(
    esiData: ESIKillmailResponse,
    hash: string
  ): Promise<void> {
    try {
      // Calculate metadata
      const attackerCount = esiData.attackers.length;
      const firstAttacker = esiData.attackers[0];
      const isSolo = attackerCount === 1 && firstAttacker && !firstAttacker.faction_id;
      const isNpc = esiData.attackers.every((a) => a.faction_id || !a.character_id);

      // Values start at 0 - will be calculated by killmail-value queue worker
      const values = {
        shipValue: "0",
        fittedValue: "0",
        droppedValue: "0",
        destroyedValue: "0",
        totalValue: "0",
      };

      // Insert main killmail
      const [insertedKillmail] = await db
        .insert(killmails)
        .values({
          killmailId: esiData.killmail_id,
          hash,
          killmailTime: new Date(esiData.killmail_time),
          solarSystemId: esiData.solar_system_id,
          attackerCount,
          shipValue: values.shipValue,
          fittedValue: values.fittedValue,
          droppedValue: values.droppedValue,
          destroyedValue: values.destroyedValue,
          totalValue: values.totalValue,
          points: 0,
          isSolo,
          isNpc,
        })
        .onConflictDoUpdate({
          target: killmails.killmailId,
          set: {
            hash,
            killmailTime: new Date(esiData.killmail_time),
            solarSystemId: esiData.solar_system_id,
            attackerCount,
            shipValue: values.shipValue,
            fittedValue: values.fittedValue,
            droppedValue: values.droppedValue,
            destroyedValue: values.destroyedValue,
            totalValue: values.totalValue,
            isSolo,
            isNpc,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!insertedKillmail) {
        throw new Error(`Failed to insert killmail ${esiData.killmail_id}`);
      }

      const killmailDbId = insertedKillmail.id;

      // Insert victim
      await db
        .insert(victims)
        .values({
          killmailId: killmailDbId,
          characterId: esiData.victim.character_id ?? null,
          corporationId: esiData.victim.corporation_id,
          allianceId: esiData.victim.alliance_id ?? null,
          factionId: esiData.victim.faction_id ?? null,
          shipTypeId: esiData.victim.ship_type_id,
          damageTaken: esiData.victim.damage_taken,
          positionX: esiData.victim.position?.x.toString() ?? null,
          positionY: esiData.victim.position?.y.toString() ?? null,
          positionZ: esiData.victim.position?.z.toString() ?? null,
        })
        .onConflictDoNothing();

      // Insert attackers in batch if possible, or one by one
      if (esiData.attackers.length > 0) {
        const attackersData = esiData.attackers.map((attacker) => ({
          killmailId: killmailDbId,
          characterId: attacker.character_id ?? null,
          corporationId: attacker.corporation_id ?? null,
          allianceId: attacker.alliance_id ?? null,
          factionId: attacker.faction_id ?? null,
          shipTypeId: attacker.ship_type_id ?? null,
          weaponTypeId: attacker.weapon_type_id ?? null,
          damageDone: attacker.damage_done,
          securityStatus: attacker.security_status?.toString() ?? null,
          finalBlow: attacker.final_blow,
        }));

        await db.insert(attackers).values(attackersData).onConflictDoNothing();
      }

      // Insert items in batch if present
      if (esiData.victim.items && esiData.victim.items.length > 0) {
        const itemsData = esiData.victim.items.map((item) => ({
          killmailId: killmailDbId,
          itemTypeId: item.item_type_id,
          quantity: (item.quantity_dropped || 0) + (item.quantity_destroyed || 0),
          flag: item.flag,
          singleton: item.singleton,
          dropped: !!item.quantity_dropped,
          destroyed: !!item.quantity_destroyed,
        }));

        await db.insert(items).values(itemsData).onConflictDoNothing();
      }

      // Enqueue value update job for this killmail
      // This will fetch prices and calculate ISK values asynchronously
      await queue.dispatch("killmail-value", "update", {
        killmailDbId: killmailDbId,
        killmailTime: new Date(esiData.killmail_time),
      }, {
        priority: 5, // Normal priority
        skipIfExists: true,
      });
    } catch (error) {
      logger.error(`Failed to save killmail ${esiData.killmail_id}:`, error);
      throw error;
    }
  }

  /**
   * Get killmail by ID and hash (from database or EVE-KILL/ESI)
   */
  async getKillmail(killmailId: number, hash: string): Promise<FullKillmail | null> {
    // Check database first
    const cached = await this.fetchKillmail(killmailId, hash);
    if (cached) {
      return cached;
    }

    // Fetch from EVE-KILL/ESI
    return await this.fetchAndStore(killmailId, hash);
  }

  /**
   * Fetch killmail from EVE-KILL (with ESI fallback) and store in database
   * Price fetching and value calculation is handled by a separate queue worker
   */
  private async fetchAndStore(
    killmailId: number,
    hash: string
  ): Promise<FullKillmail | null> {
    try {
      const esiData = await this.fetchWithFallback<ESIKillmailResponse>(
        `/killmail/${killmailId}/esi`,              // EVE-KILL endpoint
        `/killmails/${killmailId}/${hash}/`,        // ESI endpoint
        `killmail:${killmailId}:${hash}`            // Cache key
      );

      if (!esiData) {
        return null;
      }

      // Save to database (without prices - will be calculated by queue worker)
      await this.saveKillmail(esiData, hash);

      // Fetch the stored killmail from database
      const stored = await this.fetchKillmail(killmailId, hash);
      if (!stored) {
        throw new Error(`Failed to store killmail ${killmailId}`);
      }

      return stored;
    } catch (error) {
      if (error instanceof ESINotFoundError) {
        logger.error(`Killmail ${killmailId} not found in ESI`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Refresh killmail data from ESI (force update)
   */
  async refreshKillmail(killmailId: number, hash: string): Promise<FullKillmail | null> {
    logger.info(`Force refreshing killmail ${killmailId} from ESI`);
    return await this.fetchAndStore(killmailId, hash);
  }
}

// Export singleton instance
export const killmailService = new KillmailService();

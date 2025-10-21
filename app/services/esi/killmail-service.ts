import { db } from "../../../src/db";
import { killmails, victims, attackers, items, prices, types } from "../../../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { logger } from "../../../src/utils/logger";
import { BaseESIService, ESINotFoundError } from "../../../src/services/esi/base-service";
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
 * Fetches and caches killmail data from ESI with normalized storage
 */
export class KillmailService extends BaseESIService {
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
   * Now also calculates and stores ISK values
   */
  async saveKillmail(
    esiData: ESIKillmailResponse,
    hash: string,
    priceMap?: Map<number, { average: number }>
  ): Promise<void> {
    try {
      // Calculate metadata
      const attackerCount = esiData.attackers.length;
      const firstAttacker = esiData.attackers[0];
      const isSolo = attackerCount === 1 && firstAttacker && !firstAttacker.faction_id;
      const isNpc = esiData.attackers.every((a) => a.faction_id || !a.character_id);

      // Calculate ISK values if prices are provided
      const values = priceMap
        ? this.calculateValues(esiData, priceMap)
        : {
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

      // Collect all type IDs from the killmail
      const typeIds = new Set<number>();
      typeIds.add(esiData.victim.ship_type_id);

      for (const attacker of esiData.attackers) {
        if (attacker.ship_type_id) typeIds.add(attacker.ship_type_id);
        if (attacker.weapon_type_id) typeIds.add(attacker.weapon_type_id);
      }

      if (esiData.victim.items) {
        for (const item of esiData.victim.items) {
          typeIds.add(item.item_type_id);
        }
      }

      // Check which types are missing or have null category_id
      const typeIdArray = Array.from(typeIds);
      const existingTypes = await db
        .select({ typeId: types.typeId, categoryId: types.categoryId })
        .from(types)
        .where(inArray(types.typeId, typeIdArray));

      const existingTypeMap = new Map(
        existingTypes.map((t) => [t.typeId, t.categoryId])
      );

      // Queue type-fetch jobs for missing or incomplete types
      const typesToFetch = typeIdArray.filter(
        (typeId) => !existingTypeMap.has(typeId) || existingTypeMap.get(typeId) === null
      );

      if (typesToFetch.length > 0) {
        logger.info(
          `Queueing ${typesToFetch.length} type-fetch jobs for killmail ${esiData.killmail_id}`
        );

        await Promise.all(
          typesToFetch.map((typeId) =>
            queue.dispatch("type-fetch", "fetch", { typeId }, { priority: 5 })
          )
        );
      }

      logger.info(
        `Saved killmail ${esiData.killmail_id} with ${attackerCount} attackers and ${esiData.victim.items?.length || 0} items`
      );
    } catch (error) {
      logger.error(`Failed to save killmail ${esiData.killmail_id}:`, error);
      throw error;
    }
  }

  /**
   * Get killmail by ID and hash (from database or ESI)
   */
  async getKillmail(killmailId: number, hash: string): Promise<FullKillmail | null> {
    // Check database first
    const cached = await this.fetchKillmail(killmailId, hash);
    if (cached) {
      return cached;
    }

    // Fetch from ESI
    logger.info(`Fetching killmail ${killmailId} from ESI`);
    return await this.fetchAndStore(killmailId, hash);
  }

  /**
   * Fetch killmail from ESI and store in database
   */
  private async fetchAndStore(
    killmailId: number,
    hash: string
  ): Promise<FullKillmail | null> {
    try {
      const esiData = await this.fetchFromESI<ESIKillmailResponse>(
        `/killmails/${killmailId}/${hash}/`,
        `killmail:${killmailId}:${hash}`
      );

      if (!esiData) {
        return null;
      }

      // Collect all type IDs for price fetching
      const typeIds = new Set<number>();

      // Add victim ship
      if (esiData.victim.ship_type_id) {
        typeIds.add(esiData.victim.ship_type_id);
      }

      // Add items
      if (esiData.victim.items) {
        for (const item of esiData.victim.items) {
          typeIds.add(item.item_type_id);
        }
      }

      // Fetch prices for all types
      const priceMap = await this.fetchPricesForTypes(
        Array.from(typeIds),
        new Date(esiData.killmail_time)
      );

      // Save to database with calculated values
      await this.saveKillmail(esiData, hash, priceMap);

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

  /**
   * Calculate ISK values for a killmail based on items and prices
   */
  private calculateValues(
    esiData: ESIKillmailResponse,
    priceMap: Map<number, { average: number }>
  ): {
    shipValue: string;
    fittedValue: string;
    droppedValue: string;
    destroyedValue: string;
    totalValue: string;
  } {
    let shipValue = 0;
    let fittedValue = 0;
    let droppedValue = 0;
    let destroyedValue = 0;

    // Ship value (victim's ship)
    if (esiData.victim.ship_type_id) {
      const shipPrice = priceMap.get(esiData.victim.ship_type_id);
      if (shipPrice) {
        shipValue = shipPrice.average;
      }
    }

    // Calculate item values
    if (esiData.victim.items) {
      for (const item of esiData.victim.items) {
        const price = priceMap.get(item.item_type_id);
        if (!price) continue;

        const droppedQty = item.quantity_dropped || 0;
        const destroyedQty = item.quantity_destroyed || 0;

        if (droppedQty > 0) {
          droppedValue += droppedQty * price.average;
        }
        if (destroyedQty > 0) {
          destroyedValue += destroyedQty * price.average;
        }
      }
    }

    fittedValue = droppedValue + destroyedValue;
    const totalValue = shipValue + fittedValue;

    return {
      shipValue: shipValue.toFixed(2),
      fittedValue: fittedValue.toFixed(2),
      droppedValue: droppedValue.toFixed(2),
      destroyedValue: destroyedValue.toFixed(2),
      totalValue: totalValue.toFixed(2),
    };
  }

  /**
   * Fetch prices for item type IDs, finding closest to target date
   * If prices don't exist in database, fetch from EVE-KILL API and save
   */
  async fetchPricesForTypes(
    typeIds: number[],
    targetDate: Date
  ): Promise<Map<number, { average: number }>> {
    logger.info(`[KillmailService] fetchPricesForTypes called with ${typeIds.length} types for date ${targetDate.toISOString()}`);

    if (typeIds.length === 0) {
      return new Map();
    }

    const priceMap = new Map<number, { average: number }>();

    for (const typeId of typeIds) {
      // Check database first
      const priceRecords = await db
        .select()
        .from(prices)
        .where(eq(prices.typeId, typeId));

      // If we have prices in database, find closest to target date
      if (priceRecords.length > 0) {
        let closestRecord: (typeof priceRecords)[0] | undefined = priceRecords[0];
        let minDiff =
          closestRecord && closestRecord.date
            ? Math.abs(new Date(closestRecord.date).getTime() - targetDate.getTime())
            : Infinity;

        for (const record of priceRecords) {
          if (!record.date) continue;
          const diff = Math.abs(
            new Date(record.date).getTime() - targetDate.getTime()
          );
          if (diff < minDiff) {
            minDiff = diff;
            closestRecord = record;
          }
        }

        if (closestRecord && closestRecord.average) {
          priceMap.set(typeId, {
            average: closestRecord.average,
          });
          continue; // Found in database, move to next type
        }
      }

      // No prices in database - fetch from EVE-KILL API
      try {
        logger.info(`Fetching price for type ${typeId} from EVE-KILL API`);

        // Get price history from the target date
        const targetDateUnix = Math.floor(targetDate.getTime() / 1000);
        const priceData = await priceService.getPriceForTypeOnDate(typeId, targetDateUnix);

        if (priceData.length > 0) {
          // Find the closest date to our target date
          const firstRecord = priceData[0];
          if (!firstRecord) {
            logger.warn(`No valid price record for type ${typeId}`);
            continue;
          }

          let closestPriceRecord = firstRecord;
          let minDiff = Math.abs(new Date(firstRecord.date).getTime() - targetDate.getTime());

          for (const record of priceData) {
            const diff = Math.abs(new Date(record.date).getTime() - targetDate.getTime());
            if (diff < minDiff) {
              minDiff = diff;
              closestPriceRecord = record;
            }
          }

          const avgPrice = closestPriceRecord.average;
          logger.debug(`[KillmailService] Found price for type ${typeId}: ${avgPrice.toFixed(2)} ISK (from ${closestPriceRecord.date})`);

          // Save to database for future use
          const priceDate = new Date(closestPriceRecord.date);
          priceDate.setHours(0, 0, 0, 0);

          await db.insert(prices).values({
            typeId,
            date: priceDate,
            average: avgPrice,
            highest: closestPriceRecord.highest,
            lowest: closestPriceRecord.lowest,
            orderCount: closestPriceRecord.order_count,
            volume: closestPriceRecord.volume,
          }).onConflictDoNothing();

          priceMap.set(typeId, {
            average: avgPrice,
          });

          logger.debug(`Saved price for type ${typeId}: ${avgPrice.toFixed(2)} ISK`);
        } else {
          logger.warn(`No price data available for type ${typeId}`);
        }
      } catch (error) {
        logger.error(`Failed to fetch price for type ${typeId}:`, error);
        // Continue without price for this item
      }
    }

    return priceMap;
  }
}

// Export singleton instance
export const killmailService = new KillmailService();

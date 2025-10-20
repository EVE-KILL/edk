import { BaseCronjob, type CronjobResult } from "../../src/scheduler/base-cronjob";
import { db } from "../../src/db";
import { characters, corporations, alliances, types, solarSystems } from "../../db/schema";
import { queue } from "../../src/queue/job-dispatcher";
import { lt, sql } from "drizzle-orm";

/**
 * Entity Refresh Cronjob
 *
 * Schedules ESI updates for entities older than 7 days
 * Runs every hour and spreads updates across 24 hours to avoid overwhelming ESI
 *
 * Entities refreshed:
 * - Characters
 * - Corporations
 * - Alliances
 * - Types (ships, items, etc.)
 * - Solar Systems
 *
 * Strategy:
 * - Check entities with updatedAt older than 7 days
 * - Limit updates per run to spread across 24 hours
 * - Process in batches to manage queue load
 */
export default class EntityRefreshCronjob extends BaseCronjob {
  metadata = {
    name: "entity-refresh",
    description: "Refresh stale entity data from ESI (older than 7 days)",
    schedule: "0 * * * *", // Every hour on the hour
    timeout: 300000, // 5 minutes max
  };

  // How many entities to refresh per hour for each type
  // 24 runs per day, so these numbers will be processed over 24 hours
  private readonly BATCH_SIZE = {
    characters: 100,    // 2,400 characters/day
    corporations: 50,   // 1,200 corporations/day
    alliances: 25,      // 600 alliances/day
    types: 50,          // 1,200 types/day
    systems: 50,        // 1,200 systems/day
  };

  async execute(): Promise<CronjobResult> {
    try {
      this.info("Starting entity refresh...");

      // Calculate date threshold (7 days ago)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      let totalScheduled = 0;

      // Refresh characters
      const charactersScheduled = await this.refreshCharacters(sevenDaysAgo);
      totalScheduled += charactersScheduled;

      // Refresh corporations
      const corporationsScheduled = await this.refreshCorporations(sevenDaysAgo);
      totalScheduled += corporationsScheduled;

      // Refresh alliances
      const alliancesScheduled = await this.refreshAlliances(sevenDaysAgo);
      totalScheduled += alliancesScheduled;

      // Refresh types
      const typesScheduled = await this.refreshTypes(sevenDaysAgo);
      totalScheduled += typesScheduled;

      // Refresh solar systems
      const systemsScheduled = await this.refreshSystems(sevenDaysAgo);
      totalScheduled += systemsScheduled;

      this.info(`Scheduled ${totalScheduled} entity updates`);

      return {
        success: true,
        message: `Scheduled ${totalScheduled} entity updates (chars: ${charactersScheduled}, corps: ${corporationsScheduled}, alliances: ${alliancesScheduled}, types: ${typesScheduled}, systems: ${systemsScheduled})`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.error(`Failed: ${message}`);
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Refresh stale characters
   */
  private async refreshCharacters(threshold: Date): Promise<number> {
    const staleCharacters = await db
      .select({ characterId: characters.characterId })
      .from(characters)
      .where(lt(characters.updatedAt, threshold))
      .limit(this.BATCH_SIZE.characters);

    for (const char of staleCharacters) {
      await queue.dispatch("esi", "character", {
        type: "character",
        id: char.characterId,
      });
    }

    if (staleCharacters.length > 0) {
      this.info(`  ↳ Scheduled ${staleCharacters.length} characters for refresh`);
    }

    return staleCharacters.length;
  }

  /**
   * Refresh stale corporations
   */
  private async refreshCorporations(threshold: Date): Promise<number> {
    const staleCorporations = await db
      .select({ corporationId: corporations.corporationId })
      .from(corporations)
      .where(lt(corporations.updatedAt, threshold))
      .limit(this.BATCH_SIZE.corporations);

    for (const corp of staleCorporations) {
      await queue.dispatch("esi", "corporation", {
        type: "corporation",
        id: corp.corporationId,
      });
    }

    if (staleCorporations.length > 0) {
      this.info(`  ↳ Scheduled ${staleCorporations.length} corporations for refresh`);
    }

    return staleCorporations.length;
  }

  /**
   * Refresh stale alliances
   */
  private async refreshAlliances(threshold: Date): Promise<number> {
    const staleAlliances = await db
      .select({ allianceId: alliances.allianceId })
      .from(alliances)
      .where(lt(alliances.updatedAt, threshold))
      .limit(this.BATCH_SIZE.alliances);

    for (const alliance of staleAlliances) {
      await queue.dispatch("esi", "alliance", {
        type: "alliance",
        id: alliance.allianceId,
      });
    }

    if (staleAlliances.length > 0) {
      this.info(`  ↳ Scheduled ${staleAlliances.length} alliances for refresh`);
    }

    return staleAlliances.length;
  }

  /**
   * Refresh stale types
   */
  private async refreshTypes(threshold: Date): Promise<number> {
    const staleTypes = await db
      .select({ typeId: types.typeId })
      .from(types)
      .where(lt(types.updatedAt, threshold))
      .limit(this.BATCH_SIZE.types);

    for (const type of staleTypes) {
      await queue.dispatch("esi", "type", {
        type: "type",
        id: type.typeId,
      });
    }

    if (staleTypes.length > 0) {
      this.info(`  ↳ Scheduled ${staleTypes.length} types for refresh`);
    }

    return staleTypes.length;
  }

  /**
   * Refresh stale solar systems
   */
  private async refreshSystems(threshold: Date): Promise<number> {
    const staleSystems = await db
      .select({ systemId: solarSystems.systemId })
      .from(solarSystems)
      .where(lt(solarSystems.updatedAt, threshold))
      .limit(this.BATCH_SIZE.systems);

    for (const system of staleSystems) {
      await queue.dispatch("esi", "system", {
        type: "system",
        id: system.systemId,
      });
    }

    if (staleSystems.length > 0) {
      this.info(`  ↳ Scheduled ${staleSystems.length} systems for refresh`);
    }

    return staleSystems.length;
  }
}

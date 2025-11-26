import { Worker, Job } from 'bullmq';
import { fetchESI } from '../server/helpers/esi';
import { storeKillmail, type ESIKillmail } from '../server/models/killmails';
import { fetchAndStoreCharacter } from '../server/fetchers/character';
import { fetchAndStoreCorporation } from '../server/fetchers/corporation';
import { fetchAndStoreAlliance } from '../server/fetchers/alliance';
import { fetchPrices } from '../server/fetchers/price';
import { storePrices } from '../server/models/prices';
import { createRedisClient } from '../server/helpers/redis';
import { database } from '../server/helpers/database';
import { logger } from '../server/helpers/logger';

export const name = 'killmail';

interface KillmailJobData {
  killmailId: number;
  hash: string;
  warId?: number;
}

/**
 * Killmail Queue Processor
 *
 * This processor handles the complete killmail ingestion flow:
 * 1. Fetch killmail from ESI
 * 2. Extract all entity IDs (characters, corporations, alliances, types)
 * 3. Ensure all entity data exists in database (fetch if needed)
 * 4. Ensure all price data exists in database (fetch if needed)
 * 5. Store the killmail (materialized view will have complete data)
 *
 * This approach ensures that when a killmail is stored, all referenced
 * entities and prices are already in the database, allowing the materialized
 * view to be fully populated with names and values.
 */
export async function processor(job: Job<KillmailJobData>): Promise<void> {
  const { killmailId, hash, warId } = job.data;

  logger.info(`[killmail] Processing killmail ${killmailId}...`);

  try {
    // Step 1: Fetch killmail from ESI
    const response = await fetchESI<ESIKillmail>(
      `/killmails/${killmailId}/${hash}/`
    );
    if (!response.ok || !response.data || !response.data.victim) {
      logger.warn(
        `⚠️  [killmail] Killmail ${killmailId} not found or invalid (status: ${response.status})`
      );
      return;
    }

    const killmail = response.data;
    if (warId && !killmail.war_id) {
      killmail.war_id = warId;
    }

    // Step 2: Extract all entity IDs and type IDs
    const victim = killmail.victim;
    const characterIds = new Set<number>();
    const corporationIds = new Set<number>();
    const allianceIds = new Set<number>();
    const typeIds = new Set<number>();

    // Add victim
    if (victim.character_id) characterIds.add(victim.character_id);
    if (victim.corporation_id) corporationIds.add(victim.corporation_id);
    if (victim.alliance_id) allianceIds.add(victim.alliance_id);
    typeIds.add(victim.ship_type_id);

    // Add attackers
    for (const attacker of killmail.attackers) {
      if (attacker.character_id) characterIds.add(attacker.character_id);
      if (attacker.corporation_id) corporationIds.add(attacker.corporation_id);
      if (attacker.alliance_id) allianceIds.add(attacker.alliance_id);
      if (attacker.ship_type_id) typeIds.add(attacker.ship_type_id);
    }

    // Add item types
    if (victim.items) {
      for (const item of victim.items) {
        typeIds.add(item.item_type_id);
      }
    }

    logger.info(
      `[killmail] ${killmailId}: Extracted ${characterIds.size} characters, ${corporationIds.size} corporations, ${allianceIds.size} alliances, ${typeIds.size} types`
    );

    // Step 3: Fetch all entity data in parallel
    logger.info(`[killmail] ${killmailId}: Fetching entity data...`);
    await Promise.all([
      // Characters
      ...Array.from(characterIds).map((id) =>
        fetchAndStoreCharacter(id).catch((err) => {
          logger.warn(
            `⚠️  [killmail] ${killmailId}: Failed to fetch character ${id}:`,
            err.message
          );
        })
      ),

      // Corporations
      ...Array.from(corporationIds).map((id) =>
        fetchAndStoreCorporation(id).catch((err) => {
          logger.warn(
            `⚠️  [killmail] ${killmailId}: Failed to fetch corporation ${id}:`,
            err.message
          );
        })
      ),

      // Alliances
      ...Array.from(allianceIds).map((id) =>
        fetchAndStoreAlliance(id).catch((err) => {
          logger.warn(
            `⚠️  [killmail] ${killmailId}: Failed to fetch alliance ${id}:`,
            err.message
          );
        })
      ),
    ]);

    // Step 4: Fetch price data for all type IDs
    const killmailDate = new Date(killmail.killmail_time);
    const unixTimestamp = Math.floor(killmailDate.getTime() / 1000);
    logger.info(
      `[killmail] ${killmailId}: Fetching prices for ${typeIds.size} types...`
    );

    // Fetch prices for each type
    for (const typeId of typeIds) {
      try {
        const prices = await fetchPrices(typeId, 14, unixTimestamp);
        if (prices.length > 0) {
          await storePrices(prices);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.warn(
          `⚠️  [killmail] ${killmailId}: Failed to fetch prices for type ${typeId}:`,
          { error: errorMsg }
        );
        // Continue with other types
      }
    }

    // Step 5: Store the killmail
    // At this point, all entity and price data should be in the database
    // The materialized view will populate with complete data
    logger.info(`[killmail] ${killmailId}: Storing killmail...`);
    await storeKillmail(killmail, hash, warId);

    // Step 6: Publish to Redis for WebSocket broadcast
    logger.info(`[killmail] ${killmailId}: Publishing to WebSocket...`);
    await publishKillmailToWebSocket(killmailId);

    logger.success(
      `✅ [killmail] Successfully processed killmail ${killmailId}`
    );
  } catch (error) {
    logger.error(`❌ [killmail] Error processing killmail ${killmailId}:`, {
      error,
    });
    throw error; // Re-throw to trigger retry
  }
}

/**
 * Publish killmail to Redis for WebSocket broadcast
 * Fetches the killmail with all entity names from killmails table with JOINs
 */
async function publishKillmailToWebSocket(killmailId: number): Promise<void> {
  try {
    // Query killmails table with JOINs for entity names
    const [killmail] = await database.sql<any[]>`
      SELECT
        k."killmailId",
        k."killmailTime",
        k."solarSystemId",
        k."regionId",
        k."securityStatus" as security,
        k."victimCharacterId",
        k."victimCorporationId",
        k."victimAllianceId",
        k."victimShipTypeId",
        k."victimDamageTaken",
        k."topAttackerCharacterId" as "attackerCharacterId",
        k."topAttackerCorporationId" as "attackerCorporationId",
        k."topAttackerAllianceId" as "attackerAllianceId",
        k."topAttackerShipTypeId" as "attackerShipTypeId",
        k."totalValue",
        k."attackerCount",
        k.npc,
        k.solo,
        k.awox,
        
        -- Entity names from JOINs
        sys.name as "solarSystemName",
        reg.name as "regionName",
        
        vc.name as "victimCharacterName",
        vcorp.name as "victimCorporationName",
        vcorp.ticker as "victimCorporationTicker",
        va.name as "victimAllianceName",
        va.ticker as "victimAllianceTicker",
        vship.name as "victimShipName",
        vgroup.name as "victimShipGroup",
        vgroup."groupId" as "victimShipGroupId",
        
        ac.name as "attackerCharacterName",
        acorp.name as "attackerCorporationName",
        acorp.ticker as "attackerCorporationTicker",
        aa.name as "attackerAllianceName",
        aa.ticker as "attackerAllianceTicker",
        aship.name as "attackerShipName"
        
      FROM killmails k
      LEFT JOIN solarsystems sys ON k."solarSystemId" = sys."solarSystemId"
      LEFT JOIN regions reg ON k."regionId" = reg."regionId"
      LEFT JOIN characters vc ON k."victimCharacterId" = vc."characterId"
      LEFT JOIN corporations vcorp ON k."victimCorporationId" = vcorp."corporationId"
      LEFT JOIN alliances va ON k."victimAllianceId" = va."allianceId"
      LEFT JOIN types vship ON k."victimShipTypeId" = vship."typeId"
      LEFT JOIN groups vgroup ON vship."groupId" = vgroup."groupId"
      LEFT JOIN characters ac ON k."topAttackerCharacterId" = ac."characterId"
      LEFT JOIN corporations acorp ON k."topAttackerCorporationId" = acorp."corporationId"
      LEFT JOIN alliances aa ON k."topAttackerAllianceId" = aa."allianceId"
      LEFT JOIN types aship ON k."topAttackerShipTypeId" = aship."typeId"
      WHERE k."killmailId" = ${killmailId}
    `;

    if (!killmail) {
      logger.warn(`⚠️  [killmail] ${killmailId}: Not found in killmails table`);
      return;
    }

    // Format for WebSocket (nested structure expected by handlers)
    const websocketData = {
      killmailId: killmail.killmailId,
      killmailTime: killmail.killmailTime,
      solarSystemId: killmail.solarSystemId,
      regionId: killmail.regionId,
      regionName: killmail.regionName,
      securityStatus: killmail.security,
      totalValue: killmail.totalValue,
      attackerCount: killmail.attackerCount,
      npc: killmail.npc,
      solo: killmail.solo,
      awox: killmail.awox,
      solarSystem: {
        id: killmail.solarSystemId,
        name: killmail.solarSystemName,
        regionId: killmail.regionId,
        securityStatus: killmail.security,
      },
      victim: {
        character: killmail.victimCharacterId
          ? {
              id: killmail.victimCharacterId,
              name: killmail.victimCharacterName,
            }
          : null,
        corporation: {
          id: killmail.victimCorporationId,
          name: killmail.victimCorporationName,
          ticker: killmail.victimCorporationTicker,
        },
        alliance: killmail.victimAllianceId
          ? {
              id: killmail.victimAllianceId,
              name: killmail.victimAllianceName,
              ticker: killmail.victimAllianceTicker,
            }
          : null,
        ship: {
          id: killmail.victimShipTypeId,
          name: killmail.victimShipName,
          group: killmail.victimShipGroup,
          groupId: killmail.victimShipGroupId,
        },
        damageTaken: killmail.victimDamageTaken,
      },
      attackers: [
        {
          character: killmail.attackerCharacterId
            ? {
                id: killmail.attackerCharacterId,
                name: killmail.attackerCharacterName,
              }
            : null,
          corporation: killmail.attackerCorporationId
            ? {
                id: killmail.attackerCorporationId,
                name: killmail.attackerCorporationName,
                ticker: killmail.attackerCorporationTicker,
              }
            : null,
          alliance: killmail.attackerAllianceId
            ? {
                id: killmail.attackerAllianceId,
                name: killmail.attackerAllianceName,
                ticker: killmail.attackerAllianceTicker,
              }
            : null,
          ship: killmail.attackerShipTypeId
            ? {
                id: killmail.attackerShipTypeId,
                name: killmail.attackerShipName,
              }
            : null,
        },
      ],
    };

    // Publish to Redis
    const redis = createRedisClient();
    await redis.publish('killmails', JSON.stringify(websocketData));
    await redis.quit();

    logger.info(`[killmail] ${killmailId}: Published to WebSocket`);
  } catch (error) {
    logger.warn(
      `⚠️  [killmail] ${killmailId}: Failed to publish to WebSocket:`,
      { error }
    );
    // Don't throw - this is not critical for the queue processing
  }
}

/**
 * Create worker instance
 * Used by main queue.ts runner
 */
export function createWorker(
  connection: any,
  options?: { concurrency?: number }
) {
  return new Worker(name, processor, {
    connection,
    concurrency: options?.concurrency ?? 3, // Process 3 killmails concurrently by default
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000, // Per second
    },
  });
}

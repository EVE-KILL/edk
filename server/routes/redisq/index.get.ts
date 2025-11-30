import { defineEventHandler, getQuery } from 'h3';
import { database } from '../../helpers/database';
import { cache } from '../../helpers/cache';
import { logger } from '../../helpers/logger';

/**
 * RedisQ-compatible endpoint for long-polling killmail delivery
 * Compatible with existing zKillboard RedisQ clients
 *
 * Query parameters:
 * - queueID: Required. Unique identifier for the client
 * - ttw: Optional. Time to wait in seconds (1-10, default 10)
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const queueID = ((query.queueID as string) || '').trim();
    const ttw = Math.min(
      10,
      Math.max(1, parseInt((query.ttw as string) || '10'))
    );

    // queueID is required
    if (!queueID || queueID.length === 0) {
      return { package: null };
    }

    const positionKey = `redisq:position:${queueID}`;
    const activeKey = `redisq:queue:${queueID}`;

    // Mark client as active (expires in 3 hours)
    await cache.set(activeKey, 'active', 10800);

    // Get client's last position (killmailId as string)
    const lastPosition = await cache.get(positionKey);
    let lastKillmailId: number | null = null;

    if (lastPosition) {
      const parsed = parseInt(lastPosition);
      if (!isNaN(parsed)) {
        lastKillmailId = parsed;
      }
    }

    // Try to get the next killmail immediately
    let nextKillmail = await getNextKillmail(lastKillmailId);
    if (nextKillmail) {
      // Update client position
      await cache.set(positionKey, nextKillmail.killmailId.toString());
      return await formatRedisQResponse(nextKillmail);
    }

    // No killmail available, wait for new ones
    const startTime = Date.now();
    const pollInterval = 500; // Poll every 500ms
    const maxWaitTime = ttw * 1000;

    while (Date.now() - startTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      nextKillmail = await getNextKillmail(lastKillmailId);
      if (nextKillmail) {
        await cache.set(positionKey, nextKillmail.killmailId.toString());
        return await formatRedisQResponse(nextKillmail);
      }
    }

    return { package: null };
  } catch (error) {
    logger.error('RedisQ error:', error);
    return { package: null };
  }
});

/**
 * Get the next killmail after the client's current position
 * Returns NEWER killmails (higher killmail IDs)
 */
async function getNextKillmail(
  afterKillmailId: number | null
): Promise<any | null> {
  try {
    const query = afterKillmailId
      ? `
        WITH next_killmail AS (
          SELECT *
          FROM killmails
          WHERE "killmailId" > :afterKillmailId
          ORDER BY "killmailId" ASC
          LIMIT 1
        )
        SELECT
          k.*,
          (
            SELECT json_agg(
              json_build_object(
                'allianceId', a."allianceId",
                'corporationId', a."corporationId",
                'characterId', a."characterId",
                'damageDone', a."damageDone",
                'finalBlow', a."finalBlow",
                'securityStatus', a."securityStatus",
                'shipTypeId', a."shipTypeId",
                'weaponTypeId', a."weaponTypeId",
                'factionId', a."factionId"
              ) ORDER BY a."finalBlow" DESC, a."damageDone" DESC
            )
            FROM attackers a
            WHERE a."killmailId" = k."killmailId"
          ) as attackers,
          (
            SELECT json_agg(
              json_build_object(
                'itemTypeId', i."itemTypeId",
                'flag', i.flag,
                'quantityDropped', i."quantityDropped",
                'quantityDestroyed', i."quantityDestroyed",
                'singleton', i.singleton
              ) ORDER BY i.id
            )
            FROM items i
            WHERE i."killmailId" = k."killmailId"
          ) as items
        FROM next_killmail k
      `
      : `
        WITH next_killmail AS (
          SELECT *
          FROM killmails
          ORDER BY "killmailId" DESC
          LIMIT 1
        )
        SELECT
          k.*,
          (
            SELECT json_agg(
              json_build_object(
                'allianceId', a."allianceId",
                'corporationId', a."corporationId",
                'characterId', a."characterId",
                'damageDone', a."damageDone",
                'finalBlow', a."finalBlow",
                'securityStatus', a."securityStatus",
                'shipTypeId', a."shipTypeId",
                'weaponTypeId', a."weaponTypeId",
                'factionId', a."factionId"
              ) ORDER BY a."finalBlow" DESC, a."damageDone" DESC
            )
            FROM attackers a
            WHERE a."killmailId" = k."killmailId"
          ) as attackers,
          (
            SELECT json_agg(
              json_build_object(
                'itemTypeId', i."itemTypeId",
                'flag', i.flag,
                'quantityDropped', i."quantityDropped",
                'quantityDestroyed', i."quantityDestroyed",
                'singleton', i.singleton
              ) ORDER BY i.id
            )
            FROM items i
            WHERE i."killmailId" = k."killmailId"
          ) as items
        FROM next_killmail k
      `;

    const params = afterKillmailId ? { afterKillmailId } : {};
    const killmail = await database.query(query, params);

    return killmail[0] || null;
  } catch (error) {
    logger.error('Error fetching next killmail:', error);
    return null;
  }
}

/**
 * Format killmail in RedisQ-compatible format
 * Compatible with zKillboard RedisQ response structure
 */
async function formatRedisQResponse(killmail: any) {
  // Get locationID from celestials
  const locationID = await getLocationId(killmail.solarSystemId);

  // Calculate dropped and destroyed values from items
  const { droppedValue, destroyedValue } = calculateItemValues(
    killmail.items || []
  );

  return {
    package: {
      killID: killmail.killmailId,
      killmail: {
        killmail_id: killmail.killmailId,
        killmail_time: killmail.killmailTime,
        solar_system_id: killmail.solarSystemId,
        moon_id: killmail.moonId || undefined,
        war_id: killmail.warId || undefined,
        victim: {
          ship_type_id: killmail.victimShipTypeId,
          character_id: killmail.victimCharacterId || undefined,
          corporation_id: killmail.victimCorporationId || undefined,
          alliance_id: killmail.victimAllianceId || undefined,
          faction_id: killmail.victimFactionId || undefined,
          damage_taken: killmail.victimDamageTaken || 0,
          position: {
            x: killmail.positionX || 0,
            y: killmail.positionY || 0,
            z: killmail.positionZ || 0,
          },
        },
        attackers: (killmail.attackers || []).map((attacker: any) => ({
          ship_type_id: attacker.shipTypeId || 0,
          character_id: attacker.characterId || undefined,
          corporation_id: attacker.corporationId || undefined,
          alliance_id: attacker.allianceId || undefined,
          faction_id: attacker.factionId || undefined,
          damage_done: attacker.damageDone || 0,
          final_blow: attacker.finalBlow || false,
          security_status: attacker.securityStatus || 0,
          weapon_type_id: attacker.weaponTypeId || 0,
        })),
      },
      zkb: {
        locationID,
        hash: killmail.hash,
        fittedValue: 0, // Not calculated in new system
        droppedValue,
        destroyedValue,
        totalValue: killmail.totalValue || 0,
        points: killmail.pointsAwarded || 0,
        npc: killmail.npc || false,
        solo: killmail.solo || false,
        awox: killmail.awox || false,
        href: `https://esi.evetech.net/v1/killmails/${killmail.killmailId}/${killmail.hash}/`,
        labels: [],
      },
    },
  };
}

/**
 * Get locationID for a solar system
 * Returns the first celestial's item_id or 0
 */
async function getLocationId(solarSystemId: number): Promise<number> {
  const result = await database.query<{
    itemId: number;
  }>(
    `
      SELECT "itemId"
      FROM celestials
      WHERE "solarSystemId" = :solarSystemId
      LIMIT 1
    `,
    { solarSystemId }
  );

  return result[0]?.itemId || 0;
}

/**
 * Calculate dropped and destroyed values from items
 * Note: We don't have item prices in the killmail data
 * These would need to be looked up from the prices table
 * For now, returning 0 values like the fitting values
 * TODO: Consider adding price lookups if needed for RedisQ compatibility
 */
function calculateItemValues(_items: any[]): {
  droppedValue: number;
  destroyedValue: number;
} {
  const droppedValue = 0;
  const destroyedValue = 0;

  return { droppedValue, destroyedValue };
}

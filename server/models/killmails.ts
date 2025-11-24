import { database } from '../helpers/database';
import { logger } from '../helpers/logger';
import { createHash } from 'crypto';
import { getLatestPricesForTypes } from './prices';
import { getSolarSystem } from './solarSystems';

/**
 * Killmails Model
 *
 * Provides query methods for killmails table
 */

export interface Killmail {
  killmailId: number;
  killmailTime: string;
  solarSystemId: number;
  regionId?: number;
  constellationId?: number;
  victimAllianceId?: number;
  victimCharacterId: number;
  victimCorporationId: number;
  victimDamageTaken: number;
  victimShipTypeId: number;
  positionX: number;
  positionY: number;
  positionZ: number;
}

export interface ESIKillmailItem {
  flag: number;
  item_type_id: number;
  quantity_dropped?: number;
  quantity_destroyed?: number;
  singleton: number;
  items?: ESIKillmailItem[];
}

/**
 * ESI Killmail format - matches exactly what ESI API returns/expects
 * Used for both input (from ESI) and output (to our API)
 */
export interface ESIKillmail {
  killmail_id: number;
  killmail_time: string;
  solar_system_id: number;
  victim: {
    alliance_id?: number;
    character_id?: number;
    corporation_id: number;
    damage_taken: number;
    ship_type_id: number;
    position?: {
      x: number;
      y: number;
      z: number;
    };
    items?: ESIKillmailItem[];
  };
  attackers: Array<{
    alliance_id?: number;
    character_id?: number;
    corporation_id?: number;
    damage_done: number;
    final_blow: boolean;
    security_status: number;
    ship_type_id?: number;
    weapon_type_id?: number;
  }>;
}

const PRICE_REGION_ID = 10000002;

export interface KillmailValueBreakdown {
  shipValue: number;
  droppedValue: number;
  destroyedValue: number;
  totalValue: number;
}

function collectItemTypeIds(
  items: ESIKillmailItem[] | undefined,
  typeIds: Set<number>
): void {
  if (!items) return;
  for (const item of items) {
    typeIds.add(item.item_type_id);
    if (item.items && item.items.length > 0) {
      collectItemTypeIds(item.items, typeIds);
    }
  }
}

function accumulateItemValues(
  items: ESIKillmailItem[] | undefined,
  priceMap: Map<number, number>,
  totals: { dropped: number; destroyed: number }
): void {
  if (!items) return;
  for (const item of items) {
    // Only count item value if it doesn't have nested items
    // Containers with contents should only count the contents
    const hasNestedItems = item.items && item.items.length > 0;
    
    if (!hasNestedItems) {
      let price = priceMap.get(item.item_type_id) ?? 0.01;
      
      // Blueprint Copies (singleton === 2) are worth 1/100th of BPO price
      if (item.singleton === 2) {
        price = price / 100;
      }
      
      const droppedQty = item.quantity_dropped ?? 0;
      const destroyedQty = item.quantity_destroyed ?? 0;
      totals.dropped += price * droppedQty;
      totals.destroyed += price * destroyedQty;
    }

    if (hasNestedItems) {
      accumulateItemValues(item.items, priceMap, totals);
    }
  }
}

export async function calculateKillmailValues(
  esiData: ESIKillmail
): Promise<KillmailValueBreakdown> {
  const victim = esiData.victim;
  const typeIds = new Set<number>();
  typeIds.add(victim.ship_type_id);
  collectItemTypeIds(victim.items, typeIds);

  if (typeIds.size === 0) {
    return { shipValue: 0, droppedValue: 0, destroyedValue: 0, totalValue: 0 };
  }

  const priceDate = esiData.killmail_time;
  const priceMap = await getLatestPricesForTypes(
    Array.from(typeIds),
    PRICE_REGION_ID,
    priceDate
  );

  // Exclude blueprints by setting their price to 0.01
  const blueprintTypes = await database.find<{ typeId: number }>(
    `SELECT "typeId" FROM types WHERE "typeId" = ANY(:typeIds) AND name LIKE '%Blueprint%'`,
    { typeIds: Array.from(typeIds) }
  );
  for (const bp of blueprintTypes) {
    priceMap.set(bp.typeId, 0.01);
  }

  const shipValue = priceMap.get(victim.ship_type_id) ?? 0;
  const itemTotals = { dropped: 0, destroyed: 0 };
  accumulateItemValues(victim.items, priceMap, itemTotals);

  const totalValue = shipValue + itemTotals.dropped + itemTotals.destroyed;

  return {
    shipValue,
    droppedValue: itemTotals.dropped,
    destroyedValue: itemTotals.destroyed,
    totalValue,
  };
}

async function resolveKillmailValueBreakdowns(
  esiDataArray: Array<{ esi: ESIKillmail; hash?: string }>,
  valueOverrides?: Map<number, KillmailValueBreakdown>
): Promise<KillmailValueBreakdown[]> {
  const results: KillmailValueBreakdown[] = new Array(esiDataArray.length);
  const pendingIndices: number[] = [];

  for (let index = 0; index < esiDataArray.length; index++) {
    const { esi } = esiDataArray[index];
    const override = valueOverrides?.get(esi.killmail_id);

    if (override) {
      results[index] = {
        shipValue: override.shipValue ?? 0,
        droppedValue: override.droppedValue ?? 0,
        destroyedValue: override.destroyedValue ?? 0,
        totalValue: override.totalValue ?? 0,
      };
    } else {
      pendingIndices.push(index);
    }
  }

  if (pendingIndices.length > 0) {
    // Throttle price lookups to avoid overwhelming ClickHouse during bulk backfills
    const CONCURRENCY = 10;

    for (let i = 0; i < pendingIndices.length; i += CONCURRENCY) {
      const slice = pendingIndices.slice(i, i + CONCURRENCY);
      const values = await Promise.all(
        slice.map((index) => calculateKillmailValues(esiDataArray[index].esi))
      );

      for (let j = 0; j < slice.length; j++) {
        results[slice[j]] = values[j];
      }
    }
  }

  for (let index = 0; index < results.length; index++) {
    if (!results[index]) {
      results[index] = {
        shipValue: 0,
        droppedValue: 0,
        destroyedValue: 0,
        totalValue: 0,
      };
    }
  }

  return results;
}

/**
 * Get a killmail by ID in ESI format
 * Reconstructs the killmail from the database tables
 */
export async function getKillmail(
  killmailId: number
): Promise<ESIKillmail | null> {
  // Get main killmail record
  const killmail = await database.findOne<any>(
    'SELECT * FROM killmails WHERE "killmailId" = :killmailId',
    { killmailId }
  );

  if (!killmail) {
    return null;
  }

  // Get attackers
  const attackers = await database.find<any>(
    'SELECT * FROM attackers WHERE "killmailId" = :killmailId',
    { killmailId }
  );

  // Get items
  const items = await database.find<any>(
    'SELECT * FROM items WHERE "killmailId" = :killmailId',
    { killmailId }
  );

  // Convert Unix timestamp back to ISO string
  // ClickHouse DateTime is returned as a string "YYYY-MM-DD HH:MM:SS"
  // Convert to ISO format
  const killmailTime = new Date(killmail.killmailTime).toISOString();

  // Reconstruct ESI format
  return {
    killmail_id: killmail.killmailId,
    killmail_time: killmailTime,
    solar_system_id: killmail.solarSystemId,
    victim: {
      alliance_id: killmail.victimAllianceId,
      character_id: killmail.victimCharacterId,
      corporation_id: killmail.victimCorporationId,
      damage_taken: killmail.victimDamageTaken,
      ship_type_id: killmail.victimShipTypeId,
      position: {
        x: killmail.positionX,
        y: killmail.positionY,
        z: killmail.positionZ,
      },
      items: items.map((item: any) => ({
        flag: item.flag,
        item_type_id: item.itemTypeId,
        quantity_dropped: item.quantityDropped || 0,
        quantity_destroyed: item.quantityDestroyed || 0,
        singleton: item.singleton,
      })),
    },
    attackers: attackers.map((attacker: any) => ({
      alliance_id: attacker.allianceId,
      character_id: attacker.characterId,
      corporation_id: attacker.corporationId,
      damage_done: attacker.damageDone,
      final_blow: attacker.finalBlow === true, // Postgres BOOLEAN
      security_status: attacker.securityStatus,
      ship_type_id: attacker.shipTypeId,
      weapon_type_id: attacker.weaponTypeId,
    })),
  };
}

/**
 * Calculate SHA1 hash of ESI killmail JSON (used for ESI endpoints)
 * NOTE: This is a fallback - proper hashes should come from ESI/everef data
 * The hash calculation here will NOT match CCP's algorithm
 */
function calculateKillmailHash(esiData: ESIKillmail): string {
  // WARNING: This is just a placeholder hash when we don't have the real one
  // CCP's actual hash algorithm is proprietary and we can't reproduce it
  // Always prefer passing the real hash from the data source
  const json = JSON.stringify(esiData);
  return createHash('sha1').update(json).digest('hex');
}

/**
 * Store complete ESI killmail data with related records
 */
export async function storeKillmail(
  esiData: ESIKillmail,
  hash?: string
): Promise<void> {
  try {
    const victim = esiData.victim;
    const killmailHash = hash || calculateKillmailHash(esiData);
  const valueBreakdown = await calculateKillmailValues(esiData);
  const killmailIso =
    esiData.killmail_time ??
    new Date().toISOString(); // ESI already provides Z; keep it UTC

  // Get location info (region/constellation/security) from solar system
  const systemInfo = await getSolarSystem(esiData.solar_system_id);

    // Get victim ship group from types
    const victimShipType = await database.findOne<{ groupId: number }>(
      'SELECT "groupId" FROM types WHERE "typeId" = :typeId',
      { typeId: victim?.ship_type_id }
    );

    // Find top attacker (final blow or highest damage)
    const finalBlowAttacker = esiData.attackers.find((a) => a.final_blow);
    const topAttacker =
      finalBlowAttacker ||
      esiData.attackers.reduce(
        (max, a) => (a.damage_done > max.damage_done ? a : max),
        esiData.attackers[0]
      );

    // Calculate flags
    const attackerCount = esiData.attackers.length;
    const solo = attackerCount === 1;
    const npc = esiData.attackers.every((a) => !a.character_id); // All attackers are NPC
    const awox = !!(
      victim.alliance_id &&
      victim.alliance_id > 0 &&
      esiData.attackers.some((a) => a.alliance_id === victim.alliance_id)
    );

    // Insert main killmail record
    const killmailRecord = {
      killmailId: esiData.killmail_id ?? 0,
      killmailTime: killmailIso,
      solarSystemId: esiData.solar_system_id ?? 0,
      regionId: systemInfo?.regionId ?? null,
      constellationId: systemInfo?.constellationId ?? null,
      securityStatus: systemInfo?.securityStatus ?? null,

      // Victim information
      victimAllianceId: victim?.alliance_id ?? null,
      victimCharacterId: victim?.character_id ?? null,
      victimCorporationId: victim?.corporation_id ?? 0,
      victimDamageTaken: victim?.damage_taken ?? 0,
      victimShipTypeId: victim?.ship_type_id ?? 0,
      victimShipGroupId: victimShipType?.groupId ?? null,

      // Victim position
      positionX: victim?.position?.x ?? null,
      positionY: victim?.position?.y ?? null,
      positionZ: victim?.position?.z ?? null,

      // ESI hash for API access
      hash: killmailHash ?? '',

      // Denormalized attacker info
      topAttackerCharacterId: topAttacker?.character_id ?? null,
      topAttackerCorporationId: topAttacker?.corporation_id ?? null,
      topAttackerAllianceId: topAttacker?.alliance_id ?? null,
      topAttackerShipTypeId: topAttacker?.ship_type_id ?? null,
      topAttackerShipGroupId: topAttacker?.ship_type_id
        ? (await database.findOne<{ groupId: number }>(
            'SELECT "groupId" FROM types WHERE "typeId" = :typeId',
            { typeId: topAttacker.ship_type_id }
          ))?.groupId ?? null
        : null,

      // Aggregate stats
      totalValue: valueBreakdown?.totalValue ?? 0,
      attackerCount: attackerCount ?? 0,

      // Flags
      npc: npc ?? false,
      solo: solo ?? false,
      awox: awox ?? false,
    };

    // Insert killmail
    await database.bulkInsert('killmails', [killmailRecord]);
    logger.info(
      `[Killmail] Stored killmail ${esiData.killmail_id} with hash ${killmailHash}`
    );

    // Insert attackers
    const attackerRecords = esiData.attackers.map((attacker) => ({
      killmailId: esiData.killmail_id,
      killmailTime: killmailIso,
      allianceId: attacker.alliance_id ?? null,
      corporationId: attacker.corporation_id ?? null,
      characterId: attacker.character_id ?? null,
      damageDone: attacker.damage_done ?? 0,
      finalBlow: attacker.final_blow ? true : false,
      securityStatus: attacker.security_status ?? null,
      shipTypeId: attacker.ship_type_id ?? null,
      weaponTypeId: attacker.weapon_type_id ?? null,
    }));

    if (attackerRecords.length > 0) {
      await database.bulkInsert('attackers', attackerRecords);
    }

    // Insert items
    if (victim.items && victim.items.length > 0) {
      const itemRecords = victim.items.map((item) => ({
        killmailId: esiData.killmail_id,
        killmailTime: killmailIso,
        flag: item.flag ?? 0,
        itemTypeId: item.item_type_id ?? 0,
        quantityDropped: item.quantity_dropped ?? 0,
        quantityDestroyed: item.quantity_destroyed ?? 0,
        singleton: item.singleton ?? 0,
      }));

      await database.bulkInsert('items', itemRecords);
    }
  } catch (error) {
    logger.error(`[Killmail] Error storing killmail:`, { error });
    throw error;
  }
}

/**
 * Fetch region, constellation, and security status for solar systems in bulk
 */
async function fetchSolarSystemData(
  solarSystemIds: number[]
): Promise<
  Map<
    number,
    { regionId: number; constellationId: number; securityStatus: number }
  >
> {
  if (solarSystemIds.length === 0) return new Map();

  const results = await database.find<{
    solarSystemId: number;
    regionId: number;
    constellationId: number;
    securityStatus: number;
  }>(
    'SELECT "solarSystemId", "regionId", "constellationId", "securityStatus" FROM solarsystems WHERE "solarSystemId" = ANY(:ids)',
    { ids: solarSystemIds }
  );

  return new Map(
    results.map((row) => [
      row.solarSystemId,
      {
        regionId: row.regionId,
        constellationId: row.constellationId,
        securityStatus: row.securityStatus,
      },
    ])
  );
}

/**
 * Store multiple ESI killmails with related records in bulk
 * More efficient than calling storeKillmail repeatedly
 */
export interface StoreKillmailsResult {
  inserted: number;
  skippedExisting: number;
}

export async function storeKillmailsBulk(
  esiDataArray: Array<{ esi: ESIKillmail; hash?: string }>,
  valueOverrides?: Map<number, KillmailValueBreakdown>
): Promise<StoreKillmailsResult> {
  if (esiDataArray.length === 0) return { inserted: 0, skippedExisting: 0 };

  try {

    const uniqueKillmails: Array<{ esi: ESIKillmail; hash?: string }> = [];
    const seenIds = new Set<number>();
    for (const entry of esiDataArray) {
      const killmailId = entry.esi.killmail_id;
      if (!killmailId || seenIds.has(killmailId)) continue;
      seenIds.add(killmailId);
      uniqueKillmails.push(entry);
    }
    const duplicateInBatch = esiDataArray.length - uniqueKillmails.length;

    const existingRows =
      uniqueKillmails.length === 0
        ? []
        : await database.find<{ killmailId: number }>(
            'SELECT "killmailId" FROM killmails WHERE "killmailId" = ANY(:ids)',
            { ids: Array.from(seenIds) }
          );
    const existingIds = new Set(existingRows.map((row) => row.killmailId));

    const newKillmails = uniqueKillmails.filter(
      ({ esi }) => !existingIds.has(esi.killmail_id)
    );
    const skippedExisting =
      uniqueKillmails.length - newKillmails.length + duplicateInBatch;

    if (newKillmails.length === 0) {
      logger.info(
        `[Killmail] Skipping batch; ${skippedExisting} killmails already present`
      );
      return { inserted: 0, skippedExisting };
    }

    const valueBreakdowns = await resolveKillmailValueBreakdowns(
      newKillmails,
      valueOverrides
    );

    // Fetch region/constellation/security for all unique solar systems
    const uniqueSolarSystemIds = Array.from(
      new Set(newKillmails.map(({ esi }) => esi.solar_system_id))
    );
    const solarSystemData = await fetchSolarSystemData(uniqueSolarSystemIds);

    // Fetch ship group IDs for all unique victim and attacker ship types
    const uniqueShipTypeIds = Array.from(
      new Set([
        ...newKillmails.map(({ esi }) => esi.victim.ship_type_id),
        ...newKillmails.flatMap(({ esi }) =>
          esi.attackers
            .filter((a) => a.ship_type_id)
            .map((a) => a.ship_type_id!)
        ),
      ])
    );
    const shipGroupData = await database.find<{
      typeId: number;
      groupId: number;
    }>(
      'SELECT "typeId", "groupId" FROM types WHERE "typeId" = ANY(:ids)',
      { ids: uniqueShipTypeIds }
    );
    const shipGroupMap = new Map(
      shipGroupData.map((row) => [row.typeId, row.groupId])
    );

    // Prepare all killmail records
    const killmailRecords = newKillmails.map(({ esi, hash }, index) => {
      const victim = esi.victim;
      const killmailHash = hash || calculateKillmailHash(esi);
      const valueBreakdown = valueBreakdowns[index];
      const systemData = solarSystemData.get(esi.solar_system_id);
      const killmailIso =
        esi.killmail_time ?? new Date().toISOString(); // preserve UTC input

      // Find top attacker (final blow or highest damage)
      const finalBlowAttacker = esi.attackers.find((a) => a.final_blow);
      const topAttacker =
        finalBlowAttacker ||
        esi.attackers.reduce(
          (max, a) => (a.damage_done > max.damage_done ? a : max),
          esi.attackers[0]
        );

      // Calculate flags
      const attackerCount = esi.attackers.length;
      const solo = attackerCount === 1;
      const npc = esi.attackers.every((a) => !a.character_id); // All attackers are NPC
      const awox = !!(
        victim.alliance_id &&
        victim.alliance_id > 0 &&
        esi.attackers.some((a) => a.alliance_id === victim.alliance_id)
      );

      return {
        killmailId: esi.killmail_id ?? 0,
        killmailTime: killmailIso,
        solarSystemId: esi.solar_system_id ?? 0,
        regionId: systemData?.regionId ?? null,
        constellationId: systemData?.constellationId ?? null,
        securityStatus: systemData?.securityStatus ?? null,
        victimAllianceId: victim?.alliance_id ?? null,
        victimCharacterId: victim?.character_id ?? null,
        victimCorporationId: victim?.corporation_id ?? 0,
        victimDamageTaken: victim?.damage_taken ?? 0,
        victimShipTypeId: victim?.ship_type_id ?? 0,
        victimShipGroupId: shipGroupMap.get(victim?.ship_type_id ?? 0) ?? null,
        positionX: victim?.position?.x ?? null,
        positionY: victim?.position?.y ?? null,
        positionZ: victim?.position?.z ?? null,
        hash: killmailHash ?? '',
        topAttackerCharacterId: topAttacker?.character_id ?? null,
        topAttackerCorporationId: topAttacker?.corporation_id ?? null,
        topAttackerAllianceId: topAttacker?.alliance_id ?? null,
        topAttackerShipTypeId: topAttacker?.ship_type_id ?? null,
        topAttackerShipGroupId:
          shipGroupMap.get(topAttacker?.ship_type_id ?? 0) ?? null,
        totalValue: valueBreakdown?.totalValue ?? 0,
        attackerCount: attackerCount ?? 0,
        npc: npc ?? false,
        solo: solo ?? false,
        awox: awox ?? false,
      };
    });

    // Insert all killmails at once (DO NOTHING on conflict to handle duplicates)
    await database.bulkUpsert(
      'killmails',
      killmailRecords,
      ['killmailId', 'killmailTime'],
      [] // Empty update list = DO NOTHING on conflict
    );
    logger.info(
      `[Killmail] Stored ${killmailRecords.length} new killmails (skipped ${skippedExisting} existing)`
    );

    // Prepare all attacker records
    const allAttackerRecords = newKillmails.flatMap(({ esi }) =>
      esi.attackers.map((attacker) => ({
        killmailId: esi.killmail_id ?? 0,
        killmailTime: esi.killmail_time ?? new Date().toISOString(),
        allianceId: attacker.alliance_id ?? null,
        corporationId: attacker.corporation_id ?? null,
        characterId: attacker.character_id ?? null,
        damageDone: attacker.damage_done ?? 0,
        finalBlow: attacker.final_blow ? true : false,
        securityStatus: attacker.security_status ?? null,
        shipTypeId: attacker.ship_type_id ?? null,
        weaponTypeId: attacker.weapon_type_id ?? null,
      }))
    );

    // Insert attackers in chunks to avoid parameter limit (65534)
    // Each attacker has ~9 columns, so max ~7000 attackers per batch
    if (allAttackerRecords.length > 0) {
      const ATTACKER_CHUNK_SIZE = 5000;
      for (let i = 0; i < allAttackerRecords.length; i += ATTACKER_CHUNK_SIZE) {
        const chunk = allAttackerRecords.slice(i, i + ATTACKER_CHUNK_SIZE);
        await database.bulkInsert('attackers', chunk);
      }
      logger.info(
        `[Killmail] Stored ${allAttackerRecords.length} attackers in bulk`
      );
    }

    // Prepare all item records
    const allItemRecords = newKillmails.flatMap(({ esi }) => {
      const victim = esi.victim;
      if (!victim.items || victim.items.length === 0) return [];

      return victim.items.map((item) => ({
        killmailId: esi.killmail_id ?? 0,
        killmailTime: esi.killmail_time ?? new Date().toISOString(),
        flag: item.flag ?? 0,
        itemTypeId: item.item_type_id ?? 0,
        quantityDropped: item.quantity_dropped ?? 0,
        quantityDestroyed: item.quantity_destroyed ?? 0,
        singleton: item.singleton ?? 0,
      }));
    });

    // Insert items in chunks to avoid parameter limit (65534)
    // Each item has ~8 columns, so max ~8000 items per batch
    if (allItemRecords.length > 0) {
      const ITEM_CHUNK_SIZE = 5000;
      for (let i = 0; i < allItemRecords.length; i += ITEM_CHUNK_SIZE) {
        const chunk = allItemRecords.slice(i, i + ITEM_CHUNK_SIZE);
        await database.bulkInsert('items', chunk);
      }
      logger.info(`[Killmail] Stored ${allItemRecords.length} items in bulk`);
    }

    return { inserted: killmailRecords.length, skippedExisting };
  } catch (error) {
    logger.error(`[Killmail] Error storing killmails in bulk:`, { error });
    throw error;
  }
}

/**
 * Detailed killmail view interfaces
 */
export interface KillmailDetails {
  killmailId: number;
  killmailTime: string;
  victimDamageTaken: number;
  hash: string;
  victimCharacterId: number | null;
  victimCharacterName: string;
  victimCorporationId: number;
  victimCorporationName: string;
  victimCorporationTicker: string;
  victimAllianceId: number | null;
  victimAllianceName: string;
  victimAllianceTicker: string;
  victimShipTypeId: number;
  victimShipName: string;
  victimShipGroup: string;
  victimShipValue: number;
  totalValue: number;
  solarSystemId: number;
  solarSystemName: string;
  regionName: string;
  solarSystemSecurity: number;
}

export interface KillmailItem {
  itemTypeId: number;
  name: string;
  quantityDropped: number;
  quantityDestroyed: number;
  flag: number;
  price: number;
}

export interface KillmailAttacker {
  characterId: number;
  characterName: string;
  corporationId: number;
  corporationName: string;
  corporationTicker: string;
  allianceId: number | null;
  allianceName: string;
  allianceTicker: string;
  damageDone: number;
  finalBlow: number;
  securityStatus: number | null;
  shipTypeId: number | null;
  shipName: string | null;
  weaponTypeId: number | null;
  weaponName: string | null;
}

export interface SiblingKillmail {
  killmailId: number;
  killmailTime: string;
  victimCharacterName: string;
  victimCharacterId: number | null;
  victimShipName: string;
  victimShipTypeId: number;
  totalValue: number;
}

/**
 * Get detailed killmail information for display page
 */
export async function getKillmailDetails(
  killmailId: number
): Promise<KillmailDetails | null> {
  return database.findOne<KillmailDetails>(
    `SELECT
      k."killmailId" as "killmailId",
      k."killmailTime" as "killmailTime",
      k."victimDamageTaken" as "victimDamageTaken",
      k.hash as hash,
      k."victimCharacterId" as "victimCharacterId",
      coalesce(vc.name, vnpc.name, 'Unknown') as "victimCharacterName",
      k."victimCorporationId" as "victimCorporationId",
      coalesce(vcorp.name, vnpc_corp.name, 'Unknown') as "victimCorporationName",
      coalesce(vcorp.ticker, vnpc_corp."tickerName", '???') as "victimCorporationTicker",
      k."victimAllianceId" as "victimAllianceId",
      coalesce(valliance.name, 'Unknown') as "victimAllianceName",
      coalesce(valliance.ticker, '???') as "victimAllianceTicker",
      k."victimShipTypeId" as "victimShipTypeId",
      coalesce(vship.name, 'Unknown') as "victimShipName",
      coalesce(vship_group.name, 'Unknown') as "victimShipGroup",
      coalesce(vship_price."averagePrice", 0.0) as "victimShipValue",
      coalesce(k."totalValue", 0.0) as "totalValue",
      k."solarSystemId" as "solarSystemId",
      coalesce(sys.name, 'Unknown') as "solarSystemName",
      coalesce(reg.name, 'Unknown') as "regionName",
      coalesce(sys."securityStatus", 0.0) as "solarSystemSecurity"
    FROM killmails k


    LEFT JOIN characters vc ON k."victimCharacterId" = vc."characterId"
    LEFT JOIN npcCharacters vnpc ON k."victimCharacterId" = vnpc."characterId"

    LEFT JOIN corporations vcorp ON k."victimCorporationId" = vcorp."corporationId"
    LEFT JOIN npcCorporations vnpc_corp ON k."victimCorporationId" = vnpc_corp."corporationId"

    LEFT JOIN alliances valliance ON k."victimAllianceId" = valliance."allianceId"

    LEFT JOIN types vship ON k."victimShipTypeId" = vship."typeId"
    LEFT JOIN groups vship_group ON vship."groupId" = vship_group."groupId"

    LEFT JOIN (
      SELECT DISTINCT ON ("typeId")
        "typeId",
        "averagePrice"
      FROM prices
      WHERE "regionId" = 10000002
        AND "volume" > 100
      ORDER BY "typeId", "priceDate" DESC
    ) vship_price ON k."victimShipTypeId" = vship_price."typeId"

    LEFT JOIN solarSystems sys ON k."solarSystemId" = sys."solarSystemId"
    LEFT JOIN regions reg ON sys."regionId" = reg."regionId"

    WHERE k."killmailId" = :killmailId
    LIMIT 1`,
    { killmailId }
  );
}

/**
 * Get all items for a killmail with prices
 */
export async function getKillmailItems(
  killmailId: number
): Promise<KillmailItem[]> {
  return database.find<KillmailItem>(
    `WITH killmail_date AS (
      SELECT DATE("killmailTime") AS killmail_date
      FROM killmails
      WHERE "killmailId" = :killmailId
    ),
    killmail_items AS (
      SELECT *
      FROM items
      WHERE "killmailId" = :killmailId
        AND "itemTypeId" IS NOT NULL
    ),
    latest_prices AS (
      SELECT DISTINCT ON (p."typeId")
        p."typeId",
        p."averagePrice"
      FROM prices p
      JOIN killmail_items i ON p."typeId" = i."itemTypeId"
      CROSS JOIN killmail_date kd
      WHERE p."regionId" = 10000002
        AND p."volume" > 100
        AND p."priceDate" <= kd.killmail_date
        AND p."priceDate" >= kd.killmail_date - INTERVAL '30 days'
      ORDER BY p."typeId", p."priceDate" DESC
    )
    SELECT
      i."itemTypeId",
      t.name,
      i."quantityDropped",
      i."quantityDestroyed",
      i.flag,
      i.singleton,
      CASE 
        -- Blueprint Copies (BPCs) are essentially worthless
        WHEN i.singleton = 2 THEN coalesce(p."averagePrice", 0.01) / 100
        -- All other blueprints (BPOs) set to 0.01 since market prices are unreliable
        WHEN t.name LIKE '%Blueprint%' THEN 0.01
        ELSE coalesce(p."averagePrice", 0.01)
      END as price
    FROM killmail_items i
    LEFT JOIN types t ON i."itemTypeId" = t."typeId"
    LEFT JOIN latest_prices p ON i."itemTypeId" = p."typeId"`,
    { killmailId }
  );
}

/**
 * Get all attackers for a killmail
 */
export async function getKillmailAttackers(
  killmailId: number
): Promise<KillmailAttacker[]> {
  return database.find<KillmailAttacker>(
    `SELECT
      a."characterId",
      coalesce(c.name, nc.name, 'Unknown') as "characterName",
      a."corporationId",
      coalesce(corp.name, npc_corp.name, 'Unknown') as "corporationName",
      coalesce(corp.ticker, npc_corp."tickerName", '???') as "corporationTicker",
      a."allianceId",
      coalesce(a_alliance.name, 'Unknown') as "allianceName",
      coalesce(a_alliance.ticker, '???') as "allianceTicker",
      a."damageDone",
      a."finalBlow",
      a."securityStatus",
      a."shipTypeId",
      coalesce(t.name, 'Unknown') as "shipName",
      a."weaponTypeId",
      coalesce(w.name, 'Unknown') as "weaponName"
    FROM attackers a

    LEFT JOIN characters c ON a."characterId" = c."characterId"
    LEFT JOIN npcCharacters nc ON a."characterId" = nc."characterId"
    LEFT JOIN corporations corp ON a."corporationId" = corp."corporationId"
    LEFT JOIN npcCorporations npc_corp ON a."corporationId" = npc_corp."corporationId"
    LEFT JOIN alliances a_alliance ON a."allianceId" = a_alliance."allianceId"
    LEFT JOIN types t ON a."shipTypeId" = t."typeId"
    LEFT JOIN types w ON a."weaponTypeId" = w."typeId"
    WHERE a."killmailId" = :killmailId
    ORDER BY a."damageDone" DESC`,
    { killmailId }
  );
}

/**
 * Get sibling killmails (same victim within time range)
 */
export async function getSiblingKillmails(
  victimCharacterId: number,
  startTime: string,
  endTime: string,
  excludeKillmailId: number,
  limit: number = 20
): Promise<SiblingKillmail[]> {
  if (!victimCharacterId) {
    return [];
  }

  return database.find<SiblingKillmail>(
    `SELECT
      k."killmailId" as "killmailId",
      k."killmailTime" as "killmailTime",
      coalesce(vc.name, vnpc.name, 'Unknown') as "victimCharacterName",
      k."victimCharacterId" as "victimCharacterId",
      coalesce(vship.name, 'Unknown') as "victimShipName",
      k."victimShipTypeId" as "victimShipTypeId",
      k."totalValue" as "totalValue"
    FROM killmails k

    LEFT JOIN characters vc ON k."victimCharacterId" = vc."characterId"
    LEFT JOIN npcCharacters vnpc ON k."victimCharacterId" = vnpc."characterId"
    LEFT JOIN types vship ON k."victimShipTypeId" = vship."typeId"
    WHERE k."victimCharacterId" = :victimCharacterId
      AND k."killmailTime" >= :startTime::timestamp
      AND k."killmailTime" <= :endTime::timestamp
      AND k."killmailId" != :excludeKillmailId
    ORDER BY k."killmailTime" DESC
    LIMIT :limit`,
    { victimCharacterId, startTime, endTime, excludeKillmailId, limit }
  );
}

/**
 * Check if a killmail exists in the database
 * @param killmailId Killmail ID to check
 * @returns True if killmail exists
 */
export async function killmailExists(killmailId: number): Promise<boolean> {
  const result = await database.findOne<{ count: number }>(
    'SELECT count(*) as count FROM killmails WHERE "killmailId" = :killmailId',
    { killmailId }
  );
  return Number(result?.count || 0) > 0;
}

/**
 * Get approximate total killmail count (very fast, uses PostgreSQL statistics)
 * Note: Includes all partitions automatically
 */
export async function getApproximateKillmailCount(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COALESCE(reltuples::bigint, 0) as count 
     FROM pg_class 
     WHERE relname = 'killmails'`
  );
  return Number(result?.count || 0);
}

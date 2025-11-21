import { database } from "../helpers/database";
import { logger } from "../helpers/logger";
import { createHash } from "crypto";
import { getLatestPricesForTypes } from "./prices";

/**
 * Killmails Model
 *
 * Provides query methods for killmails table
 */

export interface Killmail {
  killmailId: number;
  killmailTime: string;
  solarSystemId: number;
  victimAllianceId?: number;
  victimCharacterId: number;
  victimCorporationId: number;
  victimDamageTaken: number;
  victimShipTypeId: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  createdAt: string;
  version: number;
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
    const price = priceMap.get(item.item_type_id) ?? 0;
    const droppedQty = item.quantity_dropped ?? 0;
    const destroyedQty = item.quantity_destroyed ?? 0;
    totals.dropped += price * droppedQty;
    totals.destroyed += price * destroyedQty;

    if (item.items && item.items.length > 0) {
      accumulateItemValues(item.items, priceMap, totals);
    }
  }
}

async function calculateKillmailValues(
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
        totalValue: override.totalValue ?? 0
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
        totalValue: 0
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
  const [killmail] = await database.sql<any[]>`
    SELECT * FROM killmails WHERE "killmailId" = ${killmailId}
  `;

  if (!killmail) {
    return null;
  }

  // Get attackers
  const attackers = await database.sql<any[]>`
    SELECT * FROM attackers WHERE "killmailId" = ${killmailId}
  `;

  // Get items
  const items = await database.sql<any[]>`
    SELECT * FROM items WHERE "killmailId" = ${killmailId}
  `;

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
 * Calculate MD5 hash of ESI killmail JSON (used for ESI endpoints)
 */
function calculateKillmailHash(esiData: ESIKillmail): string {
  const json = JSON.stringify(esiData);
  return createHash("md5").update(json).digest("hex");
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
    const nowUnix = Math.floor(Date.now() / 1000);
    const version = Date.now();
    const killmailHash = hash || calculateKillmailHash(esiData);
    const valueBreakdown = await calculateKillmailValues(esiData);

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
    const awox =
      victim.alliance_id &&
      victim.alliance_id > 0 &&
      esiData.attackers.some((a) => a.alliance_id === victim.alliance_id);

    // Insert main killmail record
    const killmailRecord = {
      killmailId: esiData.killmail_id,
      killmailTime: esiData.killmail_time.replace("Z", "").replace("T", " "), // Convert ISO to ClickHouse DateTime format
      solarSystemId: esiData.solar_system_id,

      // Victim information
      victimAllianceId: victim.alliance_id || null,
      victimCharacterId: victim.character_id || null,
      victimCorporationId: victim.corporation_id,
      victimDamageTaken: victim.damage_taken,
      victimShipTypeId: victim.ship_type_id,

      // Victim position
      positionX: victim.position?.x || null,
      positionY: victim.position?.y || null,
      positionZ: victim.position?.z || null,

      // ESI hash for API access
      hash: killmailHash,

      // Denormalized attacker info
      topAttackerCharacterId: topAttacker?.character_id || null,
      topAttackerCorporationId: topAttacker?.corporation_id || null,
      topAttackerAllianceId: topAttacker?.alliance_id || null,
      topAttackerShipTypeId: topAttacker?.ship_type_id || null,

      // Aggregate stats
      totalValue: valueBreakdown.totalValue,
      attackerCount,

      // Flags
      npc,
      solo,
      awox,

      createdAt: new Date(nowUnix * 1000),
      version,
    };

    // Insert killmail
    await database.insert("killmails", killmailRecord);
    logger.info(
      `[Killmail] Stored killmail ${esiData.killmail_id} with hash ${killmailHash}`
    );

    // Insert attackers
    const attackerRecords = esiData.attackers.map((attacker) => ({
      killmailId: esiData.killmail_id,
      killmailTime: esiData.killmail_time.replace('Z', '').replace('T', ' '),
      allianceId: attacker.alliance_id || null,
      corporationId: attacker.corporation_id || null,
      characterId: attacker.character_id || null,
      damageDone: attacker.damage_done,
      finalBlow: attacker.final_blow ? true : false,
      securityStatus: attacker.security_status || null,
      shipTypeId: attacker.ship_type_id || null,
      weaponTypeId: attacker.weapon_type_id || null,
      createdAt: new Date(nowUnix * 1000),
      version,
    }));

    if (attackerRecords.length > 0) {
      await database.bulkInsert("attackers", attackerRecords);
    }

    // Insert items
    if (victim.items && victim.items.length > 0) {
      const itemRecords = victim.items.map((item) => ({
        killmailId: esiData.killmail_id,
        killmailTime: esiData.killmail_time.replace('Z', '').replace('T', ' '),
        flag: item.flag,
        itemTypeId: item.item_type_id,
        quantityDropped: item.quantity_dropped || 0,
        quantityDestroyed: item.quantity_destroyed || 0,
        singleton: item.singleton,
        createdAt: new Date(nowUnix * 1000),
        version,
      }));

      await database.bulkInsert("items", itemRecords);
    }
  } catch (error) {
    logger.error(`[Killmail] Error storing killmail:`, { error });
    throw error;
  }
}

/**
 * Store multiple ESI killmails with related records in bulk
 * More efficient than calling storeKillmail repeatedly
 */
export async function storeKillmailsBulk(
  esiDataArray: Array<{ esi: ESIKillmail; hash?: string }>,
  valueOverrides?: Map<number, KillmailValueBreakdown>
): Promise<void> {
  if (esiDataArray.length === 0) return;

  try {
    const nowUnix = Math.floor(Date.now() / 1000);
    const version = Date.now();
    const valueBreakdowns = await resolveKillmailValueBreakdowns(
      esiDataArray,
      valueOverrides
    );

    // Prepare all killmail records
    const killmailRecords = esiDataArray.map(({ esi, hash }, index) => {
      const victim = esi.victim;
      const killmailHash = hash || calculateKillmailHash(esi);
      const valueBreakdown = valueBreakdowns[index];

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
      const awox =
        victim.alliance_id &&
        victim.alliance_id > 0 &&
        esi.attackers.some((a) => a.alliance_id === victim.alliance_id);

      return {
        killmailId: esi.killmail_id,
        killmailTime: esi.killmail_time.replace("Z", "").replace("T", " "),
        solarSystemId: esi.solar_system_id,
        victimAllianceId: victim.alliance_id || null,
        victimCharacterId: victim.character_id || null,
        victimCorporationId: victim.corporation_id,
        victimDamageTaken: victim.damage_taken,
        victimShipTypeId: victim.ship_type_id,
        positionX: victim.position?.x || null,
        positionY: victim.position?.y || null,
        positionZ: victim.position?.z || null,
        hash: killmailHash,
        topAttackerCharacterId: topAttacker?.character_id || null,
        topAttackerCorporationId: topAttacker?.corporation_id || null,
        topAttackerAllianceId: topAttacker?.alliance_id || null,
        topAttackerShipTypeId: topAttacker?.ship_type_id || null,
        totalValue: valueBreakdown?.totalValue ?? 0,
        attackerCount,
        npc,
        solo,
        awox,
        createdAt: new Date(nowUnix * 1000),
        version,
      };
    });

    // Insert all killmails at once
    await database.bulkInsert("killmails", killmailRecords);
    logger.info(
      `[Killmail] Stored ${killmailRecords.length} killmails in bulk`
    );

    // Prepare all attacker records
    const allAttackerRecords = esiDataArray.flatMap(({ esi }) =>
      esi.attackers.map((attacker) => ({
        killmailId: esi.killmail_id,
        killmailTime: esi.killmail_time.replace('Z', '').replace('T', ' '),
        allianceId: attacker.alliance_id || null,
        corporationId: attacker.corporation_id || null,
        characterId: attacker.character_id || null,
        damageDone: attacker.damage_done,
        finalBlow: attacker.final_blow ? true : false,
        securityStatus: attacker.security_status || null,
        shipTypeId: attacker.ship_type_id || null,
        weaponTypeId: attacker.weapon_type_id || null,
        createdAt: new Date(nowUnix * 1000),
        version,
      }))
    );

    // Insert all attackers at once
    if (allAttackerRecords.length > 0) {
      await database.bulkInsert("attackers", allAttackerRecords);
      logger.info(
        `[Killmail] Stored ${allAttackerRecords.length} attackers in bulk`
      );
    }

    // Prepare all item records
    const allItemRecords = esiDataArray.flatMap(({ esi }) => {
      const victim = esi.victim;
      if (!victim.items || victim.items.length === 0) return [];

      return victim.items.map((item) => ({
        killmailId: esi.killmail_id,
        killmailTime: esi.killmail_time.replace('Z', '').replace('T', ' '),
        flag: item.flag,
        itemTypeId: item.item_type_id,
        quantityDropped: item.quantity_dropped || 0,
        quantityDestroyed: item.quantity_destroyed || 0,
        singleton: item.singleton,
        createdAt: new Date(nowUnix * 1000),
        version,
      }));
    });

    // Insert all items at once
    if (allItemRecords.length > 0) {
      await database.bulkInsert("items", allItemRecords);
      logger.info(`[Killmail] Stored ${allItemRecords.length} items in bulk`);
    }
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
  const [row] = await database.sql<KillmailDetails[]>`
    SELECT
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
        AND "priceDate" = (
          SELECT max("priceDate") FROM prices WHERE "regionId" = 10000002
        )
      ORDER BY "typeId", version DESC
    ) vship_price ON k."victimShipTypeId" = vship_price."typeId"

    LEFT JOIN solarSystems sys ON k."solarSystemId" = sys."solarSystemId"
    LEFT JOIN regions reg ON sys."regionId" = reg."regionId"

    WHERE k."killmailId" = ${killmailId}
    LIMIT 1
  `;
  return row || null;
}

/**
 * Get all items for a killmail with prices
 */
export async function getKillmailItems(
  killmailId: number
): Promise<KillmailItem[]> {
  return await database.sql<KillmailItem[]>`
    SELECT
      i."itemTypeId",
      t.name,
      i."quantityDropped",
      i."quantityDestroyed",
      i.flag,
      coalesce(p."averagePrice", 0) as price
    FROM items i

    LEFT JOIN types t ON i."itemTypeId" = t."typeId"
    LEFT JOIN (
      SELECT DISTINCT ON ("typeId")
        "typeId",
        "averagePrice"
      FROM prices
      WHERE "regionId" = 10000002
      AND "priceDate" = (SELECT max("priceDate") FROM prices WHERE "regionId" = 10000002)
      ORDER BY "typeId", version DESC
    ) p ON i."itemTypeId" = p."typeId"
    WHERE i."killmailId" = ${killmailId}
    AND i."itemTypeId" IS NOT NULL
  `;
}

/**
 * Get all attackers for a killmail
 */
export async function getKillmailAttackers(
  killmailId: number
): Promise<KillmailAttacker[]> {
  return await database.sql<KillmailAttacker[]>`
    SELECT
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
    WHERE a."killmailId" = ${killmailId}
    ORDER BY a."damageDone" DESC
  `;
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

  return await database.sql<SiblingKillmail[]>`
    SELECT
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
    WHERE k."victimCharacterId" = ${victimCharacterId}
      AND k."killmailTime" >= ${startTime}::timestamp
      AND k."killmailTime" <= ${endTime}::timestamp
      AND k."killmailId" != ${excludeKillmailId}
    ORDER BY k."killmailTime" DESC
    LIMIT ${limit}
  `;
}

/**
 * Check if a killmail exists in the database
 * @param killmailId Killmail ID to check
 * @returns True if killmail exists
 */
export async function killmailExists(killmailId: number): Promise<boolean> {
  const [result] = await database.sql<{count: number}[]>`
    SELECT count(*) as count FROM killmails WHERE "killmailId" = ${killmailId}
  `;
  return Number(result?.count || 0) > 0;
}

import { db } from "../../src/db";
import {
  killmails,
  victims,
  attackers,
  characters,
  corporations,
  alliances,
  solarSystems,
  regions,
  types,
  groups,
  items as itemsTable,
  prices,
} from "../../db/schema";
import { eq, and, desc } from "drizzle-orm";

export interface KillmailDetail {
  killmail: {
    id: number;
    killmailId: number;
    hash: string;
    killmailTime: Date;
    solarSystemId: number;
  };
  victim: {
    character: { id: number; name: string; } | null;
    corporation: { id: number; name: string; ticker: string; } | null;
    alliance: { id: number; name: string; ticker: string; } | null;
    ship: { typeId: number; name: string; groupName: string; };
    damageTaken: number;
  };
  solarSystem: {
    id: number;
    name: string;
    security: string;
    securityStatus: number;
    region: string;
  };
  attackers: Array<{
    character: { id: number; name: string; } | null;
    corporation: { id: number; name: string; ticker: string; } | null;
    alliance: { id: number; name: string; ticker: string; } | null;
    ship: { typeId: number; name: string; groupName: string; } | null;
    weapon: { typeId: number; name: string; } | null;
    damageDone: number;
    finalBlow: boolean;
    securityStatus: number;
  }>;
  items: {
    destroyed: ItemsBySlot;
    dropped: ItemsBySlot;
    totalDestroyed: number;
    totalDropped: number;
  };
  fittingWheel: {
    destroyed: ItemsBySlot;
    dropped: ItemsBySlot;
  };
  stats: {
    attackerCount: number;
    totalValue: number;
    shipValue: number;
    itemsValue: number;
    destroyedValue: number;
    droppedValue: number;
    fitValue: number;
    isSolo: boolean;
  };
}

export interface ItemSlot {
  typeId: number;
  name: string;
  quantity: number;
  flag: number;
  flagName: string;
  singleton: number;
  categoryId?: number;
  isAmmo?: boolean;
  ammo?: ItemSlot; // Ammo loaded in this slot
  price?: {
    average: number;
    highest: number;
    lowest: number;
  };
  totalValue?: number;
}

export interface ItemsBySlot {
  highSlots: ItemSlot[];
  medSlots: ItemSlot[];
  lowSlots: ItemSlot[];
  rigSlots: ItemSlot[];
  subSlots: ItemSlot[];
  droneBay: ItemSlot[];
  cargo: ItemSlot[];
  other: ItemSlot[];
}

const SLOT_MAPPING: Record<string, keyof ItemsBySlot> = {
  // High slots (27-34)
  "27": "highSlots", "28": "highSlots", "29": "highSlots", "30": "highSlots",
  "31": "highSlots", "32": "highSlots", "33": "highSlots", "34": "highSlots",
  // Med slots (19-26)
  "19": "medSlots", "20": "medSlots", "21": "medSlots", "22": "medSlots",
  "23": "medSlots", "24": "medSlots", "25": "medSlots", "26": "medSlots",
  // Low slots (11-18)
  "11": "lowSlots", "12": "lowSlots", "13": "lowSlots", "14": "lowSlots",
  "15": "lowSlots", "16": "lowSlots", "17": "lowSlots", "18": "lowSlots",
  // Rig slots (92-94)
  "92": "rigSlots", "93": "rigSlots", "94": "rigSlots",
  // Subsystem slots (125-128)
  "125": "subSlots", "126": "subSlots", "127": "subSlots", "128": "subSlots",
  // Drone bay
  "87": "droneBay",
  // Cargo/Container
  "5": "cargo",
};

const SLOT_NAMES: Record<number, string> = {
  27: "High Slot 1", 28: "High Slot 2", 29: "High Slot 3", 30: "High Slot 4",
  31: "High Slot 5", 32: "High Slot 6", 33: "High Slot 7", 34: "High Slot 8",
  19: "Med Slot 1", 20: "Med Slot 2", 21: "Med Slot 3", 22: "Med Slot 4",
  23: "Med Slot 5", 24: "Med Slot 6", 25: "Med Slot 7", 26: "Med Slot 8",
  11: "Low Slot 1", 12: "Low Slot 2", 13: "Low Slot 3", 14: "Low Slot 4",
  15: "Low Slot 5", 16: "Low Slot 6", 17: "Low Slot 7", 18: "Low Slot 8",
  92: "Rig Slot 1", 93: "Rig Slot 2", 94: "Rig Slot 3",
  125: "Subsystem 1", 126: "Subsystem 2", 127: "Subsystem 3", 128: "Subsystem 4",
  87: "Drone Bay",
  5: "Cargo Hold",
};

/**
 * Categorize items for display - groups items by typeId for item lists
 * Ammo is included in the lists AND attached to their parent modules by flag
 */
function categorizeItemsGrouped(items: any[]): { destroyed: ItemsBySlot; dropped: ItemsBySlot } {
  const destroyed: ItemsBySlot = {
    highSlots: [], medSlots: [], lowSlots: [], rigSlots: [],
    subSlots: [], droneBay: [], cargo: [], other: []
  };
  const dropped: ItemsBySlot = {
    highSlots: [], medSlots: [], lowSlots: [], rigSlots: [],
    subSlots: [], droneBay: [], cargo: [], other: []
  };

  const destroyedMaps: Record<keyof ItemsBySlot, Map<number, ItemSlot>> = {
    highSlots: new Map(), medSlots: new Map(), lowSlots: new Map(), rigSlots: new Map(),
    subSlots: new Map(), droneBay: new Map(), cargo: new Map(), other: new Map()
  };
  const droppedMaps: Record<keyof ItemsBySlot, Map<number, ItemSlot>> = {
    highSlots: new Map(), medSlots: new Map(), lowSlots: new Map(), rigSlots: new Map(),
    subSlots: new Map(), droneBay: new Map(), cargo: new Map(), other: new Map()
  };

  const AMMO_CATEGORY_ID = 8; // Charges category

  // Helper to check if item is ammo/charge
  const isAmmo = (item: any): boolean => {
    // First try category_id if available on itemType
    if (item.itemType?.categoryId === AMMO_CATEGORY_ID) return true;

    // Then try to parse from raw_data
    if (item.itemType?.raw_data) {
      try {
        const rawData = typeof item.itemType.raw_data === 'string'
          ? JSON.parse(item.itemType.raw_data)
          : item.itemType.raw_data;
        if (rawData.category_id === AMMO_CATEGORY_ID) return true;
      } catch (e) {
        // Continue to next check
      }
    }

    return false;
  };

  for (const item of items) {
    const itemIsAmmo = isAmmo(item);
    const slotKey = SLOT_MAPPING[item.flag.toString()] || "other";
    const typeId = item.itemTypeId;
    const quantity = item.quantityDestroyed || item.quantityDropped || 1;

    if (item.quantityDestroyed > 0) {
      // Add to destroyed map, combining quantities
      const existing = destroyedMaps[slotKey].get(typeId);
      if (existing) {
        existing.quantity += quantity;
      } else {
        destroyedMaps[slotKey].set(typeId, {
          typeId: item.itemTypeId,
          name: item.itemType?.name || `Item ${item.itemTypeId}`,
          quantity: quantity,
          flag: item.flag,
          flagName: SLOT_NAMES[item.flag] || `Slot ${item.flag}`,
          singleton: item.singleton || 0,
          categoryId: item.itemType?.categoryId,
          isAmmo: itemIsAmmo,
        });
      }
    }

    if (item.quantityDropped > 0) {
      // Add to dropped map, combining quantities
      const existing = droppedMaps[slotKey].get(typeId);
      if (existing) {
        existing.quantity += quantity;
      } else {
        droppedMaps[slotKey].set(typeId, {
          typeId: item.itemTypeId,
          name: item.itemType?.name || `Item ${item.itemTypeId}`,
          quantity: quantity,
          flag: item.flag,
          flagName: SLOT_NAMES[item.flag] || `Slot ${item.flag}`,
          singleton: item.singleton || 0,
          categoryId: item.itemType?.categoryId,
          isAmmo: itemIsAmmo,
        });
      }
    }
  }

  // Convert maps back to arrays
  for (const key of Object.keys(destroyed) as Array<keyof ItemsBySlot>) {
    destroyed[key] = Array.from(destroyedMaps[key].values());
    dropped[key] = Array.from(droppedMaps[key].values());
  }

  return { destroyed, dropped };
}

/**
 * Categorize items for fitting wheel - organize by slot flag position
 * Uses the same base data as categorizeItemsGrouped but organizes by slot position
 * Ammo is attached to modules by matching flag values
 */
function categorizeItemsUngrouped(items: Array<any>): { destroyed: ItemsBySlot; dropped: ItemsBySlot } {
  const HIGH_SLOT_FLAGS = [27, 28, 29, 30, 31, 32, 33, 34];
  const MID_SLOT_FLAGS = [19, 20, 21, 22, 23, 24, 25, 26];
  const LOW_SLOT_FLAGS = [11, 12, 13, 14, 15, 16, 17, 18];
  const RIG_SLOT_FLAGS = [92, 93, 94];
  const SUBSYSTEM_FLAGS = [125, 126, 127, 128];
  const AMMO_CATEGORY_ID = 8;

  const destroyed: ItemsBySlot = {
    highSlots: [],
    medSlots: [],
    lowSlots: [],
    rigSlots: [],
    subSlots: [],
    droneBay: [],
    cargo: [],
    other: []
  };

  const dropped: ItemsBySlot = {
    highSlots: [],
    medSlots: [],
    lowSlots: [],
    rigSlots: [],
    subSlots: [],
    droneBay: [],
    cargo: [],
    other: []
  };

  // Helper to check if item is ammo/charge
  const isAmmo = (item: any): boolean => {
    // First try category_id if available on itemType
    if (item.itemType?.categoryId === AMMO_CATEGORY_ID) return true;

    // Then try to parse from raw_data
    if (item.itemType?.raw_data) {
      try {
        const rawData = typeof item.itemType.raw_data === 'string'
          ? JSON.parse(item.itemType.raw_data)
          : item.itemType.raw_data;
        if (rawData.category_id === AMMO_CATEGORY_ID) return true;
      } catch (e) {
        // Continue to next check
      }
    }

    return false;
  };

  // Separate ammo and non-ammo items
  const ammoItems = items.filter(i => isAmmo(i));
  const moduleItems = items.filter(i => !isAmmo(i));

  // Helper to organize items into slot arrays by flag position
  const organizeSlots = (moduleItems: any[], ammoItems: any[], flagRange: number[], isDestroyed: boolean): ItemSlot[] => {
    const slots: ItemSlot[] = [];

    // Create slot positions
    for (let i = 0; i < flagRange.length; i++) {
      slots[i] = null as any;
    }

    // Place modules by flag index
    for (const item of moduleItems) {
      const flagIndex = flagRange.indexOf(item.flag);
      if (flagIndex !== -1) {
        const quantity = isDestroyed ? (item.quantityDestroyed || 0) : (item.quantityDropped || 0);
        if (quantity === 0) continue;

        const moduleSlot: ItemSlot = {
          typeId: item.itemTypeId,
          name: item.itemType?.name || `Item ${item.itemTypeId}`,
          quantity: quantity,
          flag: item.flag,
          flagName: SLOT_NAMES[item.flag] || `Slot ${item.flag}`,
          singleton: item.singleton || 0,
          categoryId: item.itemType?.categoryId,
          isAmmo: false,
        };

        // Find and attach ammo that shares this flag (check both destroyed and dropped)
        const ammoForSlot = ammoItems.find(a => a.flag === item.flag);
        if (ammoForSlot) {
          // Ammo can be destroyed OR dropped, attach whichever exists
          const ammoQuantity = (ammoForSlot.quantityDestroyed || 0) + (ammoForSlot.quantityDropped || 0);
          if (ammoQuantity > 0) {
            moduleSlot.ammo = {
              typeId: ammoForSlot.itemTypeId,
              name: ammoForSlot.itemType?.name || `Ammo ${ammoForSlot.itemTypeId}`,
              quantity: ammoQuantity,
              flag: ammoForSlot.flag,
              flagName: SLOT_NAMES[ammoForSlot.flag] || `Slot ${ammoForSlot.flag}`,
              singleton: ammoForSlot.singleton || 0,
              categoryId: ammoForSlot.itemType?.categoryId,
              isAmmo: true,
            };
          }
        }

        slots[flagIndex] = moduleSlot;
      }
    }

    // Filter out nulls and return
    return slots.filter((item): item is ItemSlot => item !== null);
  };

  // Organize each slot type for destroyed items
  destroyed.highSlots = organizeSlots(moduleItems, ammoItems, HIGH_SLOT_FLAGS, true);
  destroyed.medSlots = organizeSlots(moduleItems, ammoItems, MID_SLOT_FLAGS, true);
  destroyed.lowSlots = organizeSlots(moduleItems, ammoItems, LOW_SLOT_FLAGS, true);
  destroyed.rigSlots = organizeSlots(moduleItems, ammoItems, RIG_SLOT_FLAGS, true);
  destroyed.subSlots = organizeSlots(moduleItems, ammoItems, SUBSYSTEM_FLAGS, true);

  // Organize each slot type for dropped items
  dropped.highSlots = organizeSlots(moduleItems, ammoItems, HIGH_SLOT_FLAGS, false);
  dropped.medSlots = organizeSlots(moduleItems, ammoItems, MID_SLOT_FLAGS, false);
  dropped.lowSlots = organizeSlots(moduleItems, ammoItems, LOW_SLOT_FLAGS, false);
  dropped.rigSlots = organizeSlots(moduleItems, ammoItems, RIG_SLOT_FLAGS, false);
  dropped.subSlots = organizeSlots(moduleItems, ammoItems, SUBSYSTEM_FLAGS, false);

  return { destroyed, dropped };
}

function categorizeItems(items: any[]): { destroyed: ItemsBySlot; dropped: ItemsBySlot } {
  return categorizeItemsGrouped(items);
}

/**
 * Get price information for items closest to a specific date
 */
async function getPriceForItems(
  typeIds: number[],
  targetDate: Date
): Promise<Map<number, { average: number; highest: number; lowest: number }>> {
  if (typeIds.length === 0) {
    return new Map();
  }

  // Get prices for each type, ordered by date distance from targetDate
  const priceMap = new Map<number, { average: number; highest: number; lowest: number }>();

  for (const typeId of typeIds) {
    const priceRecords = await db
      .select()
      .from(prices)
      .where(eq(prices.typeId, typeId));

    // Find the closest price record to the target date
    if (priceRecords.length > 0) {
      let closestRecord: typeof priceRecords[0] | undefined = priceRecords[0];
      let minDiff = closestRecord && closestRecord.date
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

      if (closestRecord && closestRecord.date) {
        priceMap.set(typeId, {
          average: closestRecord.average || 0,
          highest: closestRecord.highest || 0,
          lowest: closestRecord.lowest || 0,
        });
      }
    }
  }

  return priceMap;
}

/**
 * Calculate total ISK value for items using prices
 */
function calculateItemValue(items: ItemSlot[]): number {
  return items.reduce((total, item) => {
    const itemValue = (item.price?.average || 0) * item.quantity;
    return total + itemValue;
  }, 0);
}

export async function generateKillmailDetail(killmailId: number): Promise<KillmailDetail | null> {
  try {
    // Fetch the killmail with all related data
    const result = await db
      .select({
        // Killmail
        killmailDbId: killmails.id,
        killmailId: killmails.killmailId,
        killmailHash: killmails.hash,
        killmailTime: killmails.killmailTime,
        killmailSolarSystemId: killmails.solarSystemId,
        killmailAttackerCount: killmails.attackerCount,
        killmailIsSolo: killmails.isSolo,

        // Pre-calculated ISK values
        killmailShipValue: killmails.shipValue,
        killmailFittedValue: killmails.fittedValue,
        killmailDroppedValue: killmails.droppedValue,
        killmailDestroyedValue: killmails.destroyedValue,
        killmailTotalValue: killmails.totalValue,

        // Victim
        victimCharacterId: victims.characterId,
        victimCorporationId: victims.corporationId,
        victimAllianceId: victims.allianceId,
        victimShipTypeId: victims.shipTypeId,
        victimDamageTaken: victims.damageTaken,

        // Victim related entities
        victimCharacter: {
          id: characters.characterId,
          name: characters.name,
        },
        victimCorporation: {
          id: corporations.corporationId,
          name: corporations.name,
          ticker: corporations.ticker,
        },
        victimAlliance: {
          id: alliances.allianceId,
          name: alliances.name,
          ticker: alliances.ticker,
        },
        victimShipType: {
          typeId: types.typeId,
          name: types.name,
          groupId: types.groupId,
          groupName: groups.name,
        },

        // Solar System
        solarSystem: {
          id: solarSystems.systemId,
          name: solarSystems.name,
          securityStatus: solarSystems.securityStatus,
        },

        // Region
        region: {
          id: regions.regionId,
          name: regions.name,
        },
      })
      .from(killmails)
      .leftJoin(victims, eq(victims.killmailId, killmails.id))
      .leftJoin(characters, eq(characters.characterId, victims.characterId))
      .leftJoin(corporations, eq(corporations.corporationId, victims.corporationId))
      .leftJoin(alliances, eq(alliances.allianceId, victims.allianceId))
      .leftJoin(types, eq(types.typeId, victims.shipTypeId))
      .leftJoin(groups, eq(groups.groupId, types.groupId))
      .leftJoin(solarSystems, eq(solarSystems.systemId, killmails.solarSystemId))
      .leftJoin(regions, eq(regions.regionId, solarSystems.regionId))
      .where(eq(killmails.killmailId, killmailId))
      .limit(1);

    if (!result || result.length === 0) {
      return null;
    }

    const km = result[0];
    if (!km) {
      return null;
    }

    // Fetch attackers
    const attackersData = await db
      .select({
        characterId: attackers.characterId,
        corporationId: attackers.corporationId,
        allianceId: attackers.allianceId,
        shipTypeId: attackers.shipTypeId,
        weaponTypeId: attackers.weaponTypeId,
        damageDone: attackers.damageDone,
        finalBlow: attackers.finalBlow,
        securityStatus: attackers.securityStatus,

        character: {
          id: characters.characterId,
          name: characters.name,
        },
        corporation: {
          id: corporations.corporationId,
          name: corporations.name,
          ticker: corporations.ticker,
        },
        alliance: {
          id: alliances.allianceId,
          name: alliances.name,
          ticker: alliances.ticker,
        },
        shipType: {
          typeId: types.typeId,
          name: types.name,
          groupId: types.groupId,
          groupName: groups.name,
        },
      })
      .from(attackers)
      .leftJoin(characters, eq(characters.characterId, attackers.characterId))
      .leftJoin(corporations, eq(corporations.corporationId, attackers.corporationId))
      .leftJoin(alliances, eq(alliances.allianceId, attackers.allianceId))
      .leftJoin(types, eq(types.typeId, attackers.shipTypeId))
      .leftJoin(groups, eq(groups.groupId, types.groupId))
      .where(eq(attackers.killmailId, km.killmailDbId))
      .orderBy(desc(attackers.damageDone));

    // Fetch weapon types for attackers
    const weaponTypeIds = [...new Set(attackersData.map(a => a.weaponTypeId).filter(Boolean))] as number[];
    const weaponTypes = weaponTypeIds.length > 0
      ? await Promise.all(weaponTypeIds.map(async (id) =>
          db.select().from(types).where(eq(types.typeId, id)).limit(1).then(r => r[0])
        ))
      : [];

    const weaponTypeMap = new Map(weaponTypes.filter(Boolean).map(t => [t?.typeId, t]));

    // Fetch items
    const itemsData = await db
      .select({
        itemTypeId: itemsTable.itemTypeId,
        quantity: itemsTable.quantity,
        dropped: itemsTable.dropped,
        destroyed: itemsTable.destroyed,
        flag: itemsTable.flag,
        singleton: itemsTable.singleton,
        itemType: {
          typeId: types.typeId,
          name: types.name,
          categoryId: types.categoryId,
          raw_data: types.rawData,
        },
      })
      .from(itemsTable)
      .leftJoin(types, eq(types.typeId, itemsTable.itemTypeId))
      .where(eq(itemsTable.killmailId, km.killmailDbId));

    // Transform items to match expected format
    const transformedItems = itemsData.map(item => ({
      ...item,
      quantityDestroyed: item.destroyed ? item.quantity : 0,
      quantityDropped: item.dropped ? item.quantity : 0,
    }));

    // Categorize items (grouped for display)
    const categorized = categorizeItems(transformedItems);

    // Categorize items (ungrouped for fitting wheel)
    const categorizedUngrouped = categorizeItemsUngrouped(transformedItems);

    // Get all unique item type IDs (including victim ship)
    const itemTypeIds = [
      km.victimShipTypeId,
      ...transformedItems.map(i => i.itemTypeId).filter(Boolean),
    ].filter((id, idx, arr) => id && arr.indexOf(id) === idx) as number[];

    // Fetch prices for all items closest to killmail date
    const priceMap = await getPriceForItems(itemTypeIds, km.killmailTime);

    // Add prices to categorized items
    const addPricesToItems = (items: ItemSlot[]): ItemSlot[] => {
      return items.map(item => {
        const price = priceMap.get(item.typeId);
        if (price) {
          return {
            ...item,
            price,
            totalValue: item.quantity * price.average,
          };
        }
        return item;
      });
    };

    // Apply prices to all item slots
    const categorizedWithPrices = {
      destroyed: {
        highSlots: addPricesToItems(categorized.destroyed.highSlots),
        medSlots: addPricesToItems(categorized.destroyed.medSlots),
        lowSlots: addPricesToItems(categorized.destroyed.lowSlots),
        rigSlots: addPricesToItems(categorized.destroyed.rigSlots),
        subSlots: addPricesToItems(categorized.destroyed.subSlots),
        droneBay: addPricesToItems(categorized.destroyed.droneBay),
        cargo: addPricesToItems(categorized.destroyed.cargo),
        other: addPricesToItems(categorized.destroyed.other),
      },
      dropped: {
        highSlots: addPricesToItems(categorized.dropped.highSlots),
        medSlots: addPricesToItems(categorized.dropped.medSlots),
        lowSlots: addPricesToItems(categorized.dropped.lowSlots),
        rigSlots: addPricesToItems(categorized.dropped.rigSlots),
        subSlots: addPricesToItems(categorized.dropped.subSlots),
        droneBay: addPricesToItems(categorized.dropped.droneBay),
        cargo: addPricesToItems(categorized.dropped.cargo),
        other: addPricesToItems(categorized.dropped.other),
      },
    };

    // Apply prices to ungrouped items for fitting wheel
    const categorizedUngroupedWithPrices = {
      destroyed: {
        highSlots: addPricesToItems(categorizedUngrouped.destroyed.highSlots),
        medSlots: addPricesToItems(categorizedUngrouped.destroyed.medSlots),
        lowSlots: addPricesToItems(categorizedUngrouped.destroyed.lowSlots),
        rigSlots: addPricesToItems(categorizedUngrouped.destroyed.rigSlots),
        subSlots: addPricesToItems(categorizedUngrouped.destroyed.subSlots),
        droneBay: addPricesToItems(categorizedUngrouped.destroyed.droneBay),
        cargo: addPricesToItems(categorizedUngrouped.destroyed.cargo),
        other: addPricesToItems(categorizedUngrouped.destroyed.other),
      },
      dropped: {
        highSlots: addPricesToItems(categorizedUngrouped.dropped.highSlots),
        medSlots: addPricesToItems(categorizedUngrouped.dropped.medSlots),
        lowSlots: addPricesToItems(categorizedUngrouped.dropped.lowSlots),
        rigSlots: addPricesToItems(categorizedUngrouped.dropped.rigSlots),
        subSlots: addPricesToItems(categorizedUngrouped.dropped.subSlots),
        droneBay: addPricesToItems(categorizedUngrouped.dropped.droneBay),
        cargo: addPricesToItems(categorizedUngrouped.dropped.cargo),
        other: addPricesToItems(categorizedUngrouped.dropped.other),
      },
    };

    // Add prices to ammo items in the fittingWheel
    const addPricesToAmmo = (slots: ItemSlot[]) => {
      for (const slot of slots) {
        if (slot.ammo) {
          const ammoPrice = priceMap.get(slot.ammo.typeId);
          if (ammoPrice) {
            slot.ammo.price = ammoPrice;
            slot.ammo.totalValue = slot.ammo.quantity * ammoPrice.average;
          }
        }
      }
    };

    // Apply prices to all ammo in fittingWheel
    addPricesToAmmo(categorizedUngroupedWithPrices.destroyed.highSlots);
    addPricesToAmmo(categorizedUngroupedWithPrices.destroyed.medSlots);
    addPricesToAmmo(categorizedUngroupedWithPrices.destroyed.lowSlots);
    addPricesToAmmo(categorizedUngroupedWithPrices.destroyed.rigSlots);
    addPricesToAmmo(categorizedUngroupedWithPrices.destroyed.subSlots);

    addPricesToAmmo(categorizedUngroupedWithPrices.dropped.highSlots);
    addPricesToAmmo(categorizedUngroupedWithPrices.dropped.medSlots);
    addPricesToAmmo(categorizedUngroupedWithPrices.dropped.lowSlots);
    addPricesToAmmo(categorizedUngroupedWithPrices.dropped.rigSlots);
    addPricesToAmmo(categorizedUngroupedWithPrices.dropped.subSlots);

    // Use pre-calculated ISK values from database
    const shipValue = parseFloat(km.killmailShipValue || "0");
    const itemsValue = parseFloat(km.killmailFittedValue || "0");
    const destroyedValue = parseFloat(km.killmailDestroyedValue || "0");
    const droppedValue = parseFloat(km.killmailDroppedValue || "0");
    const totalValue = parseFloat(km.killmailTotalValue || "0");

    // Calculate fit value (high+med+low+rig+subsystem) - still need this for display
    const fitItems = [
      ...categorizedWithPrices.destroyed.highSlots,
      ...categorizedWithPrices.destroyed.medSlots,
      ...categorizedWithPrices.destroyed.lowSlots,
      ...categorizedWithPrices.destroyed.rigSlots,
      ...categorizedWithPrices.destroyed.subSlots,
      ...categorizedWithPrices.dropped.highSlots,
      ...categorizedWithPrices.dropped.medSlots,
      ...categorizedWithPrices.dropped.lowSlots,
      ...categorizedWithPrices.dropped.rigSlots,
      ...categorizedWithPrices.dropped.subSlots,
    ];
    const fitValue = calculateItemValue(fitItems);

    // Calculate totals
    const totalDestroyed = transformedItems
      .filter(i => i.quantityDestroyed > 0)
      .reduce((sum, i) => sum + i.quantityDestroyed, 0);
    const totalDropped = transformedItems
      .filter(i => i.quantityDropped > 0)
      .reduce((sum, i) => sum + i.quantityDropped, 0);

    // Format security status
    const securityRaw = km.solarSystem?.securityStatus;
    const securityStatus = typeof securityRaw === 'string' ? parseFloat(securityRaw) : (securityRaw || 0);
    const securityClass = securityStatus >= 0.5 ? "high-sec" : securityStatus > 0 ? "low-sec" : "null-sec";
    const securityFormatted = securityStatus.toFixed(1);

    return {
      killmail: {
        id: km.killmailDbId,
        killmailId: km.killmailId,
        hash: km.killmailHash,
        killmailTime: km.killmailTime,
        solarSystemId: km.killmailSolarSystemId,
      },
      victim: {
        character: km.victimCharacter?.id ? km.victimCharacter : null,
        corporation: km.victimCorporation?.id ? km.victimCorporation : null,
        alliance: km.victimAlliance?.id ? km.victimAlliance : null,
        ship: {
          typeId: km.victimShipTypeId || 0,
          name: km.victimShipType?.name || `Ship ${km.victimShipTypeId}`,
          groupName: km.victimShipType?.groupName || "Ship",
        },
        damageTaken: km.victimDamageTaken || 0,
      },
      solarSystem: {
        id: km.solarSystem?.id || km.killmailSolarSystemId,
        name: km.solarSystem?.name || `System ${km.killmailSolarSystemId}`,
        security: securityFormatted,
        securityStatus,
        region: km.region?.name || "Unknown Region",
      },
      attackers: attackersData.map(a => ({
        character: a.character?.id ? a.character : null,
        corporation: a.corporation?.id ? a.corporation : null,
        alliance: a.alliance?.id ? a.alliance : null,
        ship: a.shipType?.typeId ? {
          typeId: a.shipType.typeId,
          name: a.shipType.name || `Ship ${a.shipType.typeId}`,
          groupName: a.shipType.groupName || "Ship",
        } : null,
        weapon: a.weaponTypeId ? {
          typeId: a.weaponTypeId,
          name: weaponTypeMap.get(a.weaponTypeId)?.name || `Weapon ${a.weaponTypeId}`,
        } : null,
        damageDone: a.damageDone,
        finalBlow: a.finalBlow === true,
        securityStatus: parseFloat(a.securityStatus || "0"),
      })),
      items: {
        destroyed: categorizedWithPrices.destroyed,
        dropped: categorizedWithPrices.dropped,
        totalDestroyed,
        totalDropped,
      },
      fittingWheel: {
        destroyed: categorizedUngroupedWithPrices.destroyed,
        dropped: categorizedUngroupedWithPrices.dropped,
      },
      stats: {
        attackerCount: km.killmailAttackerCount || attackersData.length,
        totalValue,
        shipValue,
        itemsValue,
        destroyedValue,
        droppedValue,
        fitValue,
        isSolo: km.killmailIsSolo || false,
      },
    };
  } catch (error) {
    console.error("[Killmail Generator] Error:", error);
    return null;
  }
}

import { db } from "../db";
import {
  killmails,
  victims,
  attackers,
  characters,
  corporations,
  alliances,
  solarSystems,
  types,
  items as itemsTable,
} from "../db/schema";
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
  stats: {
    attackerCount: number;
    totalValue: number;
    shipValue: number;
    itemsValue: number;
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

function categorizeItems(items: any[]): { destroyed: ItemsBySlot; dropped: ItemsBySlot } {
  const destroyed: ItemsBySlot = {
    highSlots: [], medSlots: [], lowSlots: [], rigSlots: [],
    subSlots: [], droneBay: [], cargo: [], other: []
  };
  const dropped: ItemsBySlot = {
    highSlots: [], medSlots: [], lowSlots: [], rigSlots: [],
    subSlots: [], droneBay: [], cargo: [], other: []
  };

  // Use maps to combine items with same typeId per slot category
  const destroyedMaps: Record<keyof ItemsBySlot, Map<number, ItemSlot>> = {
    highSlots: new Map(), medSlots: new Map(), lowSlots: new Map(), rigSlots: new Map(),
    subSlots: new Map(), droneBay: new Map(), cargo: new Map(), other: new Map()
  };
  const droppedMaps: Record<keyof ItemsBySlot, Map<number, ItemSlot>> = {
    highSlots: new Map(), medSlots: new Map(), lowSlots: new Map(), rigSlots: new Map(),
    subSlots: new Map(), droneBay: new Map(), cargo: new Map(), other: new Map()
  };

  for (const item of items) {
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
        });
      }
    } else if (item.quantityDropped > 0) {
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
        },

        // Solar System
        solarSystem: {
          id: solarSystems.systemId,
          name: solarSystems.name,
          securityStatus: solarSystems.securityStatus,
        },
      })
      .from(killmails)
      .leftJoin(victims, eq(victims.killmailId, killmails.id))
      .leftJoin(characters, eq(characters.characterId, victims.characterId))
      .leftJoin(corporations, eq(corporations.corporationId, victims.corporationId))
      .leftJoin(alliances, eq(alliances.allianceId, victims.allianceId))
      .leftJoin(types, eq(types.typeId, victims.shipTypeId))
      .leftJoin(solarSystems, eq(solarSystems.systemId, killmails.solarSystemId))
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
        },
      })
      .from(attackers)
      .leftJoin(characters, eq(characters.characterId, attackers.characterId))
      .leftJoin(corporations, eq(corporations.corporationId, attackers.corporationId))
      .leftJoin(alliances, eq(alliances.allianceId, attackers.allianceId))
      .leftJoin(types, eq(types.typeId, attackers.shipTypeId))
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

    // Categorize items
    const categorized = categorizeItems(transformedItems);

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
          groupName: "Ship", // TODO: Get group name from groupId
        },
        damageTaken: km.victimDamageTaken || 0,
      },
      solarSystem: {
        id: km.solarSystem?.id || km.killmailSolarSystemId,
        name: km.solarSystem?.name || `System ${km.killmailSolarSystemId}`,
        security: securityFormatted,
        securityStatus,
        region: "Unknown Region", // TODO: Add region lookup
      },
      attackers: attackersData.map(a => ({
        character: a.character?.id ? a.character : null,
        corporation: a.corporation?.id ? a.corporation : null,
        alliance: a.alliance?.id ? a.alliance : null,
        ship: a.shipType?.typeId ? {
          typeId: a.shipType.typeId,
          name: a.shipType.name,
          groupName: "Ship", // TODO: Get group name from groupId
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
        destroyed: categorized.destroyed,
        dropped: categorized.dropped,
        totalDestroyed,
        totalDropped,
      },
      stats: {
        attackerCount: attackersData.length,
        totalValue: 0, // TODO: Calculate from item values
        shipValue: 0, // TODO: Get from ship type
        itemsValue: 0, // TODO: Calculate from items
        isSolo: attackersData.length === 1,
      },
    };
  } catch (error) {
    console.error("[Killmail Generator] Error:", error);
    return null;
  }
}

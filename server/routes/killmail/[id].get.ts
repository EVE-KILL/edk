/**
 * Killmail detail page
 * Shows complete killmail information including victim, attackers, items, and stats
 * Layout: 65% left (items/fitting wheel), 35% right (victim/attackers)
 */
import type { H3Event } from 'h3';
import { timeAgo } from '../../helpers/time';
import { render } from '../../helpers/templates';
import {
  getKillmailDetails,
  getKillmailItems,
  getKillmailAttackers,
  getSiblingKillmails,
} from '../../models/killmails';
import { track } from '../../utils/performance-decorators';
import {
  generateKillmailStructuredData,
  generateKillmailOGImage,
  generateKillmailDescription,
  generateKillmailKeywords,
} from '../../helpers/seo';

// Item slot mapping - which flag number corresponds to which slot
const SLOT_MAPPING: Record<number, string> = {
  // High slots (27-34)
  27: 'highSlots',
  28: 'highSlots',
  29: 'highSlots',
  30: 'highSlots',
  31: 'highSlots',
  32: 'highSlots',
  33: 'highSlots',
  34: 'highSlots',
  // Med slots (19-26)
  19: 'medSlots',
  20: 'medSlots',
  21: 'medSlots',
  22: 'medSlots',
  23: 'medSlots',
  24: 'medSlots',
  25: 'medSlots',
  26: 'medSlots',
  // Low slots (11-18)
  11: 'lowSlots',
  12: 'lowSlots',
  13: 'lowSlots',
  14: 'lowSlots',
  15: 'lowSlots',
  16: 'lowSlots',
  17: 'lowSlots',
  18: 'lowSlots',
  // Rig slots (92-99)
  92: 'rigSlots',
  93: 'rigSlots',
  94: 'rigSlots',
  95: 'rigSlots',
  96: 'rigSlots',
  97: 'rigSlots',
  98: 'rigSlots',
  99: 'rigSlots',
  // Subsystem slots (125-132)
  125: 'subSlots',
  126: 'subSlots',
  127: 'subSlots',
  128: 'subSlots',
  129: 'subSlots',
  130: 'subSlots',
  131: 'subSlots',
  132: 'subSlots',
  // Drone bay
  87: 'droneBay',
  // Cargo/Container
  5: 'cargo',
  // Fuel bay
  133: 'fuelBay',
  // Ore hold
  134: 'oreHold',
  // Gas hold
  135: 'gasHold',
  // Mineral hold
  136: 'mineralHold',
  // Salvage hold
  137: 'salvageHold',
  // Ship hold
  138: 'shipHold',
  // Small ship hold
  139: 'smallShipHold',
  // Medium ship hold
  140: 'mediumShipHold',
  // Large ship hold
  141: 'largeShipHold',
  // Industrial ship hold
  142: 'industrialShipHold',
  // Ammo hold
  143: 'ammoHold',
  // Quafe bay
  154: 'quafeBay',
  // Fleet hangar
  155: 'fleetHangar',
  // Fighter bay
  158: 'fighterBay',
  // Fighter launch tubes
  159: 'fighterTube1',
  160: 'fighterTube2',
  161: 'fighterTube3',
  162: 'fighterTube4',
  163: 'fighterTube5',
  // Structure services
  164: 'structureService1',
  165: 'structureService2',
  166: 'structureService3',
  167: 'structureService4',
  168: 'structureService5',
  169: 'structureService6',
  170: 'structureService7',
  171: 'structureService8',
  // Structure fuel
  172: 'structureFuel',
  // Core room
  180: 'coreRoom',
  // Infrastructure hangar
  185: 'infrastructureHangar',
  // Moon material bay
  186: 'moonMaterialBay',
  // Ship hangar
  90: 'shipHangar',
  // Implants
  89: 'implants',
  // Unflagged
  0: 'other',
};

const SLOT_NAMES: Record<number, string> = {
  27: 'High Slot 1',
  28: 'High Slot 2',
  29: 'High Slot 3',
  30: 'High Slot 4',
  31: 'High Slot 5',
  32: 'High Slot 6',
  33: 'High Slot 7',
  34: 'High Slot 8',
  19: 'Med Slot 1',
  20: 'Med Slot 2',
  21: 'Med Slot 3',
  22: 'Med Slot 4',
  23: 'Med Slot 5',
  24: 'Med Slot 6',
  25: 'Med Slot 7',
  26: 'Med Slot 8',
  11: 'Low Slot 1',
  12: 'Low Slot 2',
  13: 'Low Slot 3',
  14: 'Low Slot 4',
  15: 'Low Slot 5',
  16: 'Low Slot 6',
  17: 'Low Slot 7',
  18: 'Low Slot 8',
  92: 'Rig Slot 1',
  93: 'Rig Slot 2',
  94: 'Rig Slot 3',
  125: 'Subsystem Slot 1',
  126: 'Subsystem Slot 2',
  127: 'Subsystem Slot 3',
  128: 'Subsystem Slot 4',
  87: 'Drone Bay',
  5: 'Cargo Hold',
};

interface ItemSlot {
  typeId: number;
  name: string;
  quantity: number;
  quantityDropped: number;
  quantityDestroyed: number;
  price: number;
  totalValue: number;
  slotName: string;
  flag: number;
  isDestroyed: boolean;
  ammo?: ItemSlot;
}

interface ItemsBySlot {
  highSlots: ItemSlot[];
  medSlots: ItemSlot[];
  lowSlots: ItemSlot[];
  rigSlots: ItemSlot[];
  subSlots: ItemSlot[];
  droneBay: ItemSlot[];
  cargo: ItemSlot[];
  fuelBay: ItemSlot[];
  oreHold: ItemSlot[];
  gasHold: ItemSlot[];
  mineralHold: ItemSlot[];
  salvageHold: ItemSlot[];
  shipHold: ItemSlot[];
  smallShipHold: ItemSlot[];
  mediumShipHold: ItemSlot[];
  largeShipHold: ItemSlot[];
  industrialShipHold: ItemSlot[];
  ammoHold: ItemSlot[];
  quafeBay: ItemSlot[];
  fleetHangar: ItemSlot[];
  fighterBay: ItemSlot[];
  fighterTube1: ItemSlot[];
  fighterTube2: ItemSlot[];
  fighterTube3: ItemSlot[];
  fighterTube4: ItemSlot[];
  fighterTube5: ItemSlot[];
  structureService1: ItemSlot[];
  structureService2: ItemSlot[];
  structureService3: ItemSlot[];
  structureService4: ItemSlot[];
  structureService5: ItemSlot[];
  structureService6: ItemSlot[];
  structureService7: ItemSlot[];
  structureService8: ItemSlot[];
  structureFuel: ItemSlot[];
  coreRoom: ItemSlot[];
  infrastructureHangar: ItemSlot[];
  moonMaterialBay: ItemSlot[];
  shipHangar: ItemSlot[];
  implants: ItemSlot[];
  other: ItemSlot[];
}

import { handleError } from '../../utils/error';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const killmailId = getRouterParam(event, 'id');

    if (!killmailId) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Killmail not found',
      });
    }

    const id = parseInt(killmailId, 10);

    // Fetch killmail data
    const [killmail, itemsWithDetails] = await track(
      'killmail:fetch_data',
      'application',
      async () => {
        return await Promise.all([
          getKillmailDetails(id),
          getKillmailItems(id),
        ]);
      }
    );

    if (!killmail) {
      throw createError({
        statusCode: 404,
        statusMessage: `Killmail #${id} not found`,
      });
    }

    // Organize items by slot
    const {
      itemsBySlot,
      fittingWheelData,
      totalDestroyed,
      totalDropped,
      fitValue,
    } = await track('killmail:organize_items', 'application', async () => {
      const itemsBySlot: ItemsBySlot = {
        highSlots: [],
        medSlots: [],
        lowSlots: [],
        rigSlots: [],
        subSlots: [],
        droneBay: [],
        cargo: [],
        fuelBay: [],
        oreHold: [],
        gasHold: [],
        mineralHold: [],
        salvageHold: [],
        shipHold: [],
        smallShipHold: [],
        mediumShipHold: [],
        largeShipHold: [],
        industrialShipHold: [],
        ammoHold: [],
        quafeBay: [],
        fleetHangar: [],
        fighterBay: [],
        fighterTube1: [],
        fighterTube2: [],
        fighterTube3: [],
        fighterTube4: [],
        fighterTube5: [],
        structureService1: [],
        structureService2: [],
        structureService3: [],
        structureService4: [],
        structureService5: [],
        structureService6: [],
        structureService7: [],
        structureService8: [],
        structureFuel: [],
        coreRoom: [],
        infrastructureHangar: [],
        moonMaterialBay: [],
        shipHangar: [],
        implants: [],
        other: [],
      };

      let totalDestroyed = 0;
      let totalDropped = 0;
      let fitValue = 0;

      // Define fitting slots
      const HIGH_SLOT_FLAGS = [27, 28, 29, 30, 31, 32, 33, 34];
      const MID_SLOT_FLAGS = [19, 20, 21, 22, 23, 24, 25, 26];
      const LOW_SLOT_FLAGS = [11, 12, 13, 14, 15, 16, 17, 18];
      const RIG_SLOT_FLAGS = [92, 93, 94];
      const SUBSYSTEM_FLAGS = [125, 126, 127, 128];

      const fittingSlots = [
        ...HIGH_SLOT_FLAGS,
        ...MID_SLOT_FLAGS,
        ...LOW_SLOT_FLAGS,
        ...RIG_SLOT_FLAGS,
        ...SUBSYSTEM_FLAGS,
      ];

      const AMMO_CATEGORY_ID = 8;

      // Step 1: Group items for Items Destroyed & Dropped table
      // Group by typeId + dropped/destroyed status
      const groupedItemsMap = new Map<string, (typeof itemsWithDetails)[0]>();

      for (const item of itemsWithDetails) {
        const hasDropped = item.quantityDropped > 0 ? '1' : '0';
        const hasDestroyed = item.quantityDestroyed > 0 ? '1' : '0';
        const key = `${item.itemTypeId}_${hasDropped}_${hasDestroyed}`;

        const existing = groupedItemsMap.get(key);

        if (existing) {
          existing.quantityDropped += item.quantityDropped;
          existing.quantityDestroyed += item.quantityDestroyed;
        } else {
          groupedItemsMap.set(key, { ...item });
        }
      }

      const groupedItems = Array.from(groupedItemsMap.values());

      // Process grouped items for the items table
      for (const item of groupedItems) {
        const slotKey =
          (SLOT_MAPPING[item.flag] as keyof ItemsBySlot) || 'other';
        const totalQuantity = item.quantityDropped + item.quantityDestroyed;
        const itemValue = (item.price || 0) * totalQuantity;

        const slotItem: ItemSlot = {
          typeId: item.itemTypeId,
          name: item.name || 'Unknown',
          quantity: totalQuantity,
          quantityDropped: item.quantityDropped,
          quantityDestroyed: item.quantityDestroyed,
          price: item.price || 0,
          totalValue: itemValue,
          slotName: SLOT_NAMES[item.flag] || `Slot ${item.flag}`,
          flag: item.flag,
          isDestroyed: item.quantityDestroyed > 0,
        };

        itemsBySlot[slotKey].push(slotItem);

        totalDestroyed += item.quantityDestroyed * (item.price || 0);
        totalDropped += item.quantityDropped * (item.price || 0);
      }

      // Step 2: Build fitting wheel data structure
      // Organize modules by flag (one per slot)
      const modulesByFlag = new Map<number, (typeof itemsWithDetails)[0]>();
      const ammoByFlag = new Map<number, (typeof itemsWithDetails)[0]>();

      for (const item of itemsWithDetails) {
        if (item.categoryId === AMMO_CATEGORY_ID) {
          // Store ammo separately
          if (!ammoByFlag.has(item.flag)) {
            ammoByFlag.set(item.flag, item);
          }
        } else if (
          fittingSlots.includes(item.flag) &&
          item.categoryId !== AMMO_CATEGORY_ID
        ) {
          // Only add non-ammo items to fitting slots
          if (!modulesByFlag.has(item.flag)) {
            modulesByFlag.set(item.flag, item);
          }
        }
      }

      // Build fitting wheel arrays by slot type
      const fittingWheelData = {
        highSlots: [] as ItemSlot[],
        medSlots: [] as ItemSlot[],
        lowSlots: [] as ItemSlot[],
        rigSlots: [] as ItemSlot[],
        subSlots: [] as ItemSlot[],
      };

      // Helper to create slot item with ammo
      const createSlotItem = (
        item: (typeof itemsWithDetails)[0],
        flag: number
      ): ItemSlot => {
        const totalQuantity = item.quantityDropped + item.quantityDestroyed;
        const itemValue = (item.price || 0) * totalQuantity;

        let ammoSlot: ItemSlot | undefined;
        const ammoItem = ammoByFlag.get(flag);

        if (ammoItem) {
          const ammoQuantity =
            ammoItem.quantityDropped + ammoItem.quantityDestroyed;
          const ammoValue = (ammoItem.price || 0) * ammoQuantity;
          ammoSlot = {
            typeId: ammoItem.itemTypeId,
            name: ammoItem.name || 'Unknown',
            quantity: ammoQuantity,
            quantityDropped: ammoItem.quantityDropped,
            quantityDestroyed: ammoItem.quantityDestroyed,
            price: ammoItem.price || 0,
            totalValue: ammoValue,
            slotName: SLOT_NAMES[flag] || `Slot ${flag}`,
            flag: flag,
            isDestroyed: ammoItem.quantityDestroyed > 0,
          };
        }

        return {
          typeId: item.itemTypeId,
          name: item.name || 'Unknown',
          quantity: totalQuantity,
          quantityDropped: item.quantityDropped,
          quantityDestroyed: item.quantityDestroyed,
          price: item.price || 0,
          totalValue: itemValue,
          slotName: SLOT_NAMES[flag] || `Slot ${flag}`,
          flag: flag,
          isDestroyed: item.quantityDestroyed > 0,
          ammo: ammoSlot,
        };
      };

      // Populate fitting wheel slots
      HIGH_SLOT_FLAGS.forEach((flag) => {
        const item = modulesByFlag.get(flag);
        if (item) {
          fittingWheelData.highSlots.push(createSlotItem(item, flag));
          if (item.quantityDestroyed > 0) {
            fitValue += (item.price || 0) * item.quantityDestroyed;
          }
        }
      });

      MID_SLOT_FLAGS.forEach((flag) => {
        const item = modulesByFlag.get(flag);
        if (item) {
          fittingWheelData.medSlots.push(createSlotItem(item, flag));
          if (item.quantityDestroyed > 0) {
            fitValue += (item.price || 0) * item.quantityDestroyed;
          }
        }
      });

      LOW_SLOT_FLAGS.forEach((flag) => {
        const item = modulesByFlag.get(flag);
        if (item) {
          fittingWheelData.lowSlots.push(createSlotItem(item, flag));
          if (item.quantityDestroyed > 0) {
            fitValue += (item.price || 0) * item.quantityDestroyed;
          }
        }
      });

      RIG_SLOT_FLAGS.forEach((flag) => {
        const item = modulesByFlag.get(flag);
        if (item) {
          fittingWheelData.rigSlots.push(createSlotItem(item, flag));
          if (item.quantityDestroyed > 0) {
            fitValue += (item.price || 0) * item.quantityDestroyed;
          }
        }
      });

      SUBSYSTEM_FLAGS.forEach((flag) => {
        const item = modulesByFlag.get(flag);
        if (item) {
          fittingWheelData.subSlots.push(createSlotItem(item, flag));
          if (item.quantityDestroyed > 0) {
            fitValue += (item.price || 0) * item.quantityDestroyed;
          }
        }
      });

      return {
        itemsBySlot,
        fittingWheelData,
        totalDestroyed,
        totalDropped,
        fitValue,
      };
    });

    // Use the stored totalValue from the database (calculated when killmail was stored)
    // This ensures consistency across all pages
    const totalKillValue = killmail.totalValue || 0;
    const shipValue = killmail.victimShipValue || 0;
    const itemsValue = totalKillValue - shipValue;
    const killmailTimeIso = ensureUtcString(killmail.killmailTime);

    // Fetch attackers and siblings in parallel
    const [attackers, siblings] = await track(
      'killmail:fetch_attackers_siblings',
      'application',
      async () => {
        const killmailDate = new Date(killmailTimeIso);
        const startDate = new Date(killmailDate.getTime() - 60 * 60 * 1000);
        const endDate = new Date(killmailDate.getTime() + 60 * 60 * 1000);

        const formatDateTime = (date: Date): string => {
          const year = date.getUTCFullYear();
          const month = String(date.getUTCMonth() + 1).padStart(2, '0');
          const day = String(date.getUTCDate()).padStart(2, '0');
          const hours = String(date.getUTCHours()).padStart(2, '0');
          const minutes = String(date.getUTCMinutes()).padStart(2, '0');
          const seconds = String(date.getUTCSeconds()).padStart(2, '0');
          return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+00`;
        };

        // Fetch siblings - we'll add current kill to the list after
        const [attackersResult, siblingsResult] = await Promise.all([
          getKillmailAttackers(id),
          getSiblingKillmails(
            killmail.victimCharacterId || 0,
            formatDateTime(startDate),
            formatDateTime(endDate),
            0, // Don't exclude any killmail
            20
          ),
        ]);

        return [attackersResult, siblingsResult];
      }
    );

    // Calculate stats after attackers are fetched
    const finalBlowAttacker = attackers.find((a) => a.finalBlow === 1);
    const topDamageAttacker = attackers[0] || null;
    const totalDamage = attackers.reduce((sum, a) => sum + a.damageDone, 0);

    // Format data for template
    const victimName = killmail.victimCharacterName || 'Unknown';
    const shipName = killmail.victimShipName || 'Unknown';
    const valueBillion = (totalKillValue / 1_000_000_000).toFixed(2);
    const solarSystemName = killmail.solarSystemName || 'Unknown System';
    const regionName = killmail.regionName || 'Unknown Region';

    // Generate SEO metadata
    const ogImage = generateKillmailOGImage({
      victimShipTypeId: killmail.victimShipTypeId,
    });

    const description = generateKillmailDescription({
      victimName,
      shipName,
      totalValue: totalKillValue,
      solarSystemName,
      regionName,
      attackerCount: attackers.length,
      killmailTime: killmailTimeIso,
    });

    const keywords = generateKillmailKeywords({
      victimName,
      shipName,
      solarSystemName,
      regionName,
      shipGroup: killmail.victimShipGroup,
      attackerNames: attackers
        .slice(0, 3)
        .map((a) => a.characterName)
        .filter(Boolean) as string[],
    });

    const structuredData = generateKillmailStructuredData({
      killmailId: id,
      victimName,
      shipName,
      totalValue: totalKillValue,
      killmailTime: killmailTimeIso,
      solarSystemName,
      regionName,
      attackerCount: attackers.length,
    });

    const templateData = await track(
      'killmail:build_template_data',
      'application',
      async () => ({
        killmail: {
          id: killmail.killmailId,
          killmailId: killmail.killmailId,
          hash: killmail.hash,
          time: killmailTimeIso,
          timeAgo: timeAgo(killmail.killmailTime),
          systemName: killmail.solarSystemName,
          systemId: killmail.solarSystemId,
          regionName: killmail.regionName,
          securityStatus: killmail.solarSystemSecurity,
        },
        victim: {
          character: killmail.victimCharacterId
            ? {
                id: killmail.victimCharacterId,
                name: killmail.victimCharacterName,
              }
            : null,
          corporation: killmail.victimCorporationId
            ? {
                id: killmail.victimCorporationId,
                name: killmail.victimCorporationName,
                ticker: killmail.victimCorporationTicker,
              }
            : null,
          alliance: killmail.victimAllianceId
            ? {
                id: killmail.victimAllianceId,
                name: killmail.victimAllianceName,
                ticker: killmail.victimAllianceTicker,
              }
            : null,
          ship: {
            typeId: killmail.victimShipTypeId,
            name: killmail.victimShipName,
            groupName: killmail.victimShipGroup,
          },
          damageTaken: killmail.victimDamageTaken || 0,
        },
        solarSystem: {
          id: killmail.solarSystemId,
          name: killmail.solarSystemName,
          region: killmail.regionName,
          security: killmail.solarSystemSecurity,
        },
        attackers: attackers.map((a) => ({
          character: a.characterId
            ? {
                id: a.characterId,
                name: a.characterName,
              }
            : null,
          corporation: a.corporationId
            ? {
                id: a.corporationId,
                name: a.corporationName,
                ticker: a.corporationTicker,
              }
            : null,
          alliance: a.allianceId
            ? {
                id: a.allianceId,
                name: a.allianceName,
                ticker: a.allianceTicker,
              }
            : null,
          ship: a.shipTypeId
            ? {
                typeId: a.shipTypeId,
                name: a.shipName,
              }
            : null,
          weapon: a.weaponTypeId
            ? {
                typeId: a.weaponTypeId,
                name: a.weaponName,
              }
            : null,
          damageDone: a.damageDone,
          finalBlow: a.finalBlow === 1,
          securityStatus: a.securityStatus,
        })),
        items: itemsBySlot,
        fittingWheel: fittingWheelData,
        stats: {
          attackerCount: attackers.length,
          totalValue: totalKillValue,
          shipValue,
          itemsValue,
          destroyedValue: totalDestroyed,
          droppedValue: totalDropped,
          fitValue,
          isSolo: attackers.length === 1,
        },
        siblings: siblings.map((s) => ({
          killmailId: s.killmailId,
          killmailTime: ensureUtcString(s.killmailTime),
          victimName: s.victimCharacterName,
          victimCharacterId: s.victimCharacterId,
          shipName: s.victimShipName,
          shipTypeId: s.victimShipTypeId,
          totalValue: s.totalValue,
        })),
        finalBlow: finalBlowAttacker
          ? {
              character: finalBlowAttacker.characterId
                ? {
                    id: finalBlowAttacker.characterId,
                    name: finalBlowAttacker.characterName,
                  }
                : null,
              corporation: finalBlowAttacker.corporationId
                ? {
                    id: finalBlowAttacker.corporationId,
                    name: finalBlowAttacker.corporationName,
                    ticker: finalBlowAttacker.corporationTicker,
                  }
                : null,
              alliance: finalBlowAttacker.allianceId
                ? {
                    id: finalBlowAttacker.allianceId,
                    name: finalBlowAttacker.allianceName,
                    ticker: finalBlowAttacker.allianceTicker,
                  }
                : null,
              ship: finalBlowAttacker.shipTypeId
                ? {
                    typeId: finalBlowAttacker.shipTypeId,
                    name: finalBlowAttacker.shipName,
                  }
                : null,
              weapon: finalBlowAttacker.weaponTypeId
                ? {
                    typeId: finalBlowAttacker.weaponTypeId,
                    name: finalBlowAttacker.weaponName,
                  }
                : null,
              damageDone: finalBlowAttacker.damageDone,
              damagePercent:
                totalDamage > 0
                  ? (finalBlowAttacker.damageDone / totalDamage) * 100
                  : 0,
              isFinalBlow: true,
            }
          : null,
        topDamage: topDamageAttacker
          ? {
              character: topDamageAttacker.characterId
                ? {
                    id: topDamageAttacker.characterId,
                    name: topDamageAttacker.characterName,
                  }
                : null,
              corporation: topDamageAttacker.corporationId
                ? {
                    id: topDamageAttacker.corporationId,
                    name: topDamageAttacker.corporationName,
                    ticker: topDamageAttacker.corporationTicker,
                  }
                : null,
              alliance: topDamageAttacker.allianceId
                ? {
                    id: topDamageAttacker.allianceId,
                    name: topDamageAttacker.allianceName,
                    ticker: topDamageAttacker.allianceTicker,
                  }
                : null,
              ship: topDamageAttacker.shipTypeId
                ? {
                    typeId: topDamageAttacker.shipTypeId,
                    name: topDamageAttacker.shipName,
                  }
                : null,
              weapon: topDamageAttacker.weaponTypeId
                ? {
                    typeId: topDamageAttacker.weaponTypeId,
                    name: topDamageAttacker.weaponName,
                  }
                : null,
              damageDone: topDamageAttacker.damageDone,
              damagePercent:
                totalDamage > 0
                  ? (topDamageAttacker.damageDone / totalDamage) * 100
                  : 0,
            }
          : null,
        totalDamage,
      })
    );

    return render(
      'pages/killmail',
      {
        title: `${victimName} (${shipName}) - ${valueBillion}B ISK`,
        description,
        keywords,
        url: `/killmail/${id}`,
        image: ogImage,
        type: 'article',
        structuredData,
      },
      templateData,
      event
    );
  } catch (error) {
    return handleError(event, error);
  }
});

function ensureUtcString(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toISOString();
  }
  const str = String(value);
  if (/[+-]\d{2}:?\d{2}$/.test(str) || str.endsWith('Z')) return str;
  return str.includes('T') ? `${str}Z` : `${str.replace(' ', 'T')}Z`;
}

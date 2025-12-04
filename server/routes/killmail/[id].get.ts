/**
 * Killmail detail page
 * Shows complete killmail information including victim, attackers, items, and stats
 * Layout: 65% left (items/fitting wheel), 35% right (victim/attackers)
 */
import type { H3Event } from 'h3';
import { timeAgo } from '../../helpers/time';
import { render } from '../../helpers/templates';
import { renderErrorPage } from '../../utils/error';
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
import { loadFlagMappings, getSlotKey } from '../../models/inventoryFlags';

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
  singleton?: number;
  ammo?: ItemSlot;
  nestedItems?: ItemSlot[];
}

interface ItemsBySlot {
  [key: string]: ItemSlot[];
  highSlots: ItemSlot[];
  medSlots: ItemSlot[];
  lowSlots: ItemSlot[];
  rigSlots: ItemSlot[];
  subSlots: ItemSlot[];
  droneBay: ItemSlot[];
  cargo: ItemSlot[];
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

import type { H3Event } from 'h3';
import { timeAgo } from '../../helpers/time';
import { render } from '../../helpers/templates';
import { renderErrorPage } from '../../utils/error';
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
import { loadFlagMappings, getSlotKey } from '../../models/inventoryFlags';
import { env } from '../../helpers/env';

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
  singleton?: number;
  ammo?: ItemSlot;
  nestedItems?: ItemSlot[];
}

interface ItemsBySlot {
  [key: string]: ItemSlot[];
  highSlots: ItemSlot[];
  medSlots: ItemSlot[];
  lowSlots: ItemSlot[];
  rigSlots: ItemSlot[];
  subSlots: ItemSlot[];
  droneBay: ItemSlot[];
  cargo: ItemSlot[];
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

export default defineCachedEventHandler(
  async (event: H3Event) => {
    try {
      const killmailId = getRouterParam(event, 'id');

      if (!killmailId) {
        return renderErrorPage(
          event,
          404,
          'Killmail Not Found',
          'No killmail ID provided.'
        );
      }

      const id = parseInt(killmailId, 10);

      // Load flag mappings (synchronous) and fetch killmail data
      const flagNames = loadFlagMappings();

      const [killmail, itemsWithDetails] = await track(
        'killmail:fetch_data',
        'database',
        async () => {
          return await Promise.all([
            getKillmailDetails(id),
            getKillmailItems(id),
          ]);
        }
      );

      if (!killmail) {
        return renderErrorPage(
          event,
          404,
          'Killmail Not Found',
          `Killmail #${id} not found in the database.`
        );
      }

      // Flag name lookup map
      const flagToSlotName = flagNames;

      // Organize items by slot
      const {
        itemsBySlot,
        fittingWheelData,
        totalDestroyed,
        totalDropped,
        fitValue,
      } = await track('killmail:organize_items', 'application', async () => {
        // Initialize itemsBySlot with core slots
        // Additional bay/hold slots will be created dynamically as needed
        const itemsBySlot: ItemsBySlot = {
          highSlots: [],
          medSlots: [],
          lowSlots: [],
          rigSlots: [],
          subSlots: [],
          droneBay: [],
          cargo: [],
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

        // Step 1: Build item map for nesting lookup
        const itemMap = new Map<number, (typeof itemsWithDetails)[0]>();
        for (const item of itemsWithDetails) {
          itemMap.set(item.id, item);
        }

        // Step 2: Group root items only (items without parentItemId) for Items Destroyed & Dropped table
        // Group by typeId + dropped/destroyed status
        const groupedItemsMap = new Map<
          string,
          (typeof itemsWithDetails)[0] & {
            nestedItems?: (typeof itemsWithDetails)[0][];
          }
        >();

        // First pass: separate ammo from other items
        const ammoItemsByFlag = new Map<
          number,
          (typeof itemsWithDetails)[0][]
        >();

        for (const item of itemsWithDetails) {
          // Skip items that are nested inside containers
          if (item.parentItemId !== null) continue;

          // Collect ammo separately by flag
          if (item.categoryId === AMMO_CATEGORY_ID) {
            if (!ammoItemsByFlag.has(item.flag)) {
              ammoItemsByFlag.set(item.flag, []);
            }
            ammoItemsByFlag.get(item.flag)!.push(item);
            continue; // Don't add ammo to main items list
          }

          const hasDropped = item.quantityDropped > 0 ? '1' : '0';
          const hasDestroyed = item.quantityDestroyed > 0 ? '1' : '0';
          const key = `${item.itemTypeId}_${hasDropped}_${hasDestroyed}`;

          const existing = groupedItemsMap.get(key);

          if (existing) {
            existing.quantityDropped += item.quantityDropped;
            existing.quantityDestroyed += item.quantityDestroyed;
          } else {
            groupedItemsMap.set(key, { ...item, nestedItems: [] });
          }
        }

        // Second pass: attach container contents and ammo to their parent items
        for (const item of itemsWithDetails) {
          if (item.parentItemId === null) continue;

          const parent = itemMap.get(item.parentItemId);
          if (!parent) continue;

          // Find the grouped parent item
          for (const [, groupedItem] of groupedItemsMap) {
            if (
              groupedItem.id === parent.id ||
              (groupedItem.itemTypeId === parent.itemTypeId &&
                groupedItem.flag === parent.flag)
            ) {
              if (!groupedItem.nestedItems) groupedItem.nestedItems = [];
              groupedItem.nestedItems.push(item);
              break;
            }
          }
        }

        // Third pass: attach ammo to modules ONLY in high/mid/low slots
        for (const [, groupedItem] of groupedItemsMap) {
          // Only attach ammo to items in fitting slots (not cargo, drone bay, etc.)
          const slotKey = getSlotKey(groupedItem.flag);
          if (
            slotKey !== 'highSlots' &&
            slotKey !== 'medSlots' &&
            slotKey !== 'lowSlots'
          ) {
            continue;
          }

          const ammoItems = ammoItemsByFlag.get(groupedItem.flag);
          if (ammoItems && ammoItems.length > 0) {
            if (!groupedItem.nestedItems) groupedItem.nestedItems = [];
            groupedItem.nestedItems.push(...ammoItems);
          }
        }

        const groupedItems = Array.from(groupedItemsMap.values());

        // Process grouped items for the items table
        for (const item of groupedItems) {
          const slotKey = getSlotKey(item.flag);
          const totalQuantity = item.quantityDropped + item.quantityDestroyed;

          // Calculate item value including nested items
          let itemValue = (item.price || 0) * totalQuantity;
          const nestedItems: ItemSlot[] = [];

          if (item.nestedItems && item.nestedItems.length > 0) {
            for (const nested of item.nestedItems) {
              const nestedQty =
                nested.quantityDropped + nested.quantityDestroyed;
              const nestedValue = (nested.price || 0) * nestedQty;
              itemValue += nestedValue;

              nestedItems.push({
                typeId: nested.itemTypeId,
                name: nested.name || 'Unknown',
                quantity: nestedQty,
                quantityDropped: nested.quantityDropped,
                quantityDestroyed: nested.quantityDestroyed,
                price: nested.price || 0,
                totalValue: nestedValue,
                slotName: flagToSlotName.get(item.flag) || `Flag ${item.flag}`,
                flag: nested.flag,
                singleton: nested.singleton || 0,
                isDestroyed: nested.quantityDestroyed > 0,
              });
            }
          }

          const slotItem: ItemSlot & { nestedItems?: ItemSlot[] } = {
            typeId: item.itemTypeId,
            name: item.name || 'Unknown',
            quantity: totalQuantity,
            quantityDropped: item.quantityDropped,
            quantityDestroyed: item.quantityDestroyed,
            price: item.price || 0,
            totalValue: itemValue,
            slotName: flagToSlotName.get(item.flag) || `Flag ${item.flag}`,
            flag: item.flag,
            singleton: item.singleton || 0,
            isDestroyed: item.quantityDestroyed > 0,
            nestedItems: nestedItems.length > 0 ? nestedItems : undefined,
          };

          // Initialize slot array if it doesn't exist
          if (!itemsBySlot[slotKey]) {
            itemsBySlot[slotKey] = [];
          }

          itemsBySlot[slotKey].push(slotItem);

          totalDestroyed += item.quantityDestroyed * (item.price || 0);
          totalDropped += item.quantityDropped * (item.price || 0);

          // Add nested item values to totals
          for (const nested of nestedItems) {
            totalDestroyed += nested.quantityDestroyed * nested.price;
            totalDropped += nested.quantityDropped * nested.price;
          }
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
              slotName: flagToSlotName.get(flag) || `Flag ${flag}`,
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
            slotName: flagToSlotName.get(flag) || `Flag ${flag}`,
            flag: flag,
            singleton: item.singleton || 0,
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
      // Convert to Number to handle potential type issues from database
      const totalKillValue = Number(killmail.totalValue) || 0;
      const shipValue = Number(killmail.victimShipValue) || 0;
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

      // Smart ISK formatting for title - use millions for < 1B, billions for >= 1B
      let valueFormatted: string;
      if (totalKillValue >= 1_000_000_000) {
        valueFormatted = `${(totalKillValue / 1_000_000_000).toFixed(2)}B`;
      } else if (totalKillValue >= 1_000_000) {
        valueFormatted = `${(totalKillValue / 1_000_000).toFixed(1)}M`;
      } else if (totalKillValue >= 1_000) {
        valueFormatted = `${(totalKillValue / 1_000).toFixed(1)}K`;
      } else {
        valueFormatted = `${totalKillValue.toFixed(0)}`;
      }

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
            regionId: killmail.regionId,
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
            faction: killmail.victimFactionId
              ? {
                  id: killmail.victimFactionId,
                  name: killmail.victimFactionName,
                }
              : null,
            ship: {
              typeId: killmail.victimShipTypeId,
              name: killmail.victimShipName,
              groupId: killmail.victimShipGroupId,
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
            faction: a.factionId
              ? {
                  id: a.factionId,
                  name: a.factionName,
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
          meta: [
            {
              type: 'custom',
              html: `<button
                class="killmail-nav__killmail-id"
                onclick="navigator.clipboard.writeText('https://esi.evetech.net/latest/killmails/${killmail.killmailId}/${killmail.hash}/'); this.textContent='Copied!'; setTimeout(() => this.textContent='${killmail.killmailId}', 2000);"
                title="Click to copy ESI URL"
                style="background: var(--color-bg-secondary); border: 1px solid var(--color-border-default); padding: 6px 12px; border-radius: var(--radius-sm); color: var(--color-text-primary); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s ease;"
              >
                ${killmail.killmailId}
              </button>`,
            },
            {
              type: 'custom',
              html: `<a
                href="https://esi.evetech.net/latest/killmails/${killmail.killmailId}/${killmail.hash}/"
                class="killmail-nav__btn killmail-nav__btn--secondary"
                target="_blank"
                rel="noopener noreferrer"
                title="View raw killmail via ESI API"
                style="background: var(--color-bg-secondary); border: 1px solid var(--color-border-default); padding: 6px 12px; border-radius: var(--radius-sm); color: var(--color-text-primary); font-size: 13px; font-weight: 500; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; transition: all 0.2s ease;"
              >
                📄 ESI
              </a>`,
            },
          ],
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
          title: `${victimName} (${shipName}) - ${valueFormatted} ISK`,
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
  },
  {
    maxAge: 3600,
    staleMaxAge: -1,
    base: 'redis',
    shouldBypassCache: () => env.NODE_ENV !== 'production',
  }
);

function ensureUtcString(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toISOString();
  }
  const str = String(value);
  if (/[+-]\d{2}:?\d{2}$/.test(str) || str.endsWith('Z')) return str;
  return str.includes('T') ? `${str}Z` : `${str.replace(' ', 'T')}Z`;
}

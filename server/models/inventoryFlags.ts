/**
 * Inventory flag mappings
 *
 * TODO: Replace with ESI API endpoint when CCP implements it.
 *
 * Source: https://github.com/esi/eve-glue/blob/master/eve_glue/location_flag.py
 * Based on PersonalLocationFlagEnumV5 (latest as of November 2024)
 *
 * CCP removed the invFlags table from the SDE and has not yet implemented
 * the planned ESI API endpoint for inventory flag definitions.
 *
 * Last updated: 2024-11-28
 */

export interface InventoryFlag {
  id: number;
  name: string;
  text: string;
  slotKey: string;
  displayOrder: number;
}

/**
 * All known inventory flags from ESI eve-glue
 */
export const INVENTORY_FLAGS: InventoryFlag[] = [
  {
    id: 0,
    name: 'AutoFit',
    text: 'Auto Fit',
    slotKey: 'other',
    displayOrder: 999,
  },
  {
    id: 3,
    name: 'Wardrobe',
    text: 'Wardrobe',
    slotKey: 'other',
    displayOrder: 999,
  },
  {
    id: 4,
    name: 'Hangar',
    text: 'Hangar',
    slotKey: 'hangar',
    displayOrder: 13,
  },
  { id: 5, name: 'Cargo', text: 'Cargo', slotKey: 'cargo', displayOrder: 7 },
  { id: 7, name: 'Skill', text: 'Skill', slotKey: 'other', displayOrder: 999 },

  // Low Slots
  {
    id: 11,
    name: 'LoSlot0',
    text: 'Low Slot 1',
    slotKey: 'lowSlots',
    displayOrder: 3,
  },
  {
    id: 12,
    name: 'LoSlot1',
    text: 'Low Slot 2',
    slotKey: 'lowSlots',
    displayOrder: 3,
  },
  {
    id: 13,
    name: 'LoSlot2',
    text: 'Low Slot 3',
    slotKey: 'lowSlots',
    displayOrder: 3,
  },
  {
    id: 14,
    name: 'LoSlot3',
    text: 'Low Slot 4',
    slotKey: 'lowSlots',
    displayOrder: 3,
  },
  {
    id: 15,
    name: 'LoSlot4',
    text: 'Low Slot 5',
    slotKey: 'lowSlots',
    displayOrder: 3,
  },
  {
    id: 16,
    name: 'LoSlot5',
    text: 'Low Slot 6',
    slotKey: 'lowSlots',
    displayOrder: 3,
  },
  {
    id: 17,
    name: 'LoSlot6',
    text: 'Low Slot 7',
    slotKey: 'lowSlots',
    displayOrder: 3,
  },
  {
    id: 18,
    name: 'LoSlot7',
    text: 'Low Slot 8',
    slotKey: 'lowSlots',
    displayOrder: 3,
  },

  // Med Slots
  {
    id: 19,
    name: 'MedSlot0',
    text: 'Med Slot 1',
    slotKey: 'medSlots',
    displayOrder: 2,
  },
  {
    id: 20,
    name: 'MedSlot1',
    text: 'Med Slot 2',
    slotKey: 'medSlots',
    displayOrder: 2,
  },
  {
    id: 21,
    name: 'MedSlot2',
    text: 'Med Slot 3',
    slotKey: 'medSlots',
    displayOrder: 2,
  },
  {
    id: 22,
    name: 'MedSlot3',
    text: 'Med Slot 4',
    slotKey: 'medSlots',
    displayOrder: 2,
  },
  {
    id: 23,
    name: 'MedSlot4',
    text: 'Med Slot 5',
    slotKey: 'medSlots',
    displayOrder: 2,
  },
  {
    id: 24,
    name: 'MedSlot5',
    text: 'Med Slot 6',
    slotKey: 'medSlots',
    displayOrder: 2,
  },
  {
    id: 25,
    name: 'MedSlot6',
    text: 'Med Slot 7',
    slotKey: 'medSlots',
    displayOrder: 2,
  },
  {
    id: 26,
    name: 'MedSlot7',
    text: 'Med Slot 8',
    slotKey: 'medSlots',
    displayOrder: 2,
  },

  // High Slots
  {
    id: 27,
    name: 'HiSlot0',
    text: 'High Slot 1',
    slotKey: 'highSlots',
    displayOrder: 1,
  },
  {
    id: 28,
    name: 'HiSlot1',
    text: 'High Slot 2',
    slotKey: 'highSlots',
    displayOrder: 1,
  },
  {
    id: 29,
    name: 'HiSlot2',
    text: 'High Slot 3',
    slotKey: 'highSlots',
    displayOrder: 1,
  },
  {
    id: 30,
    name: 'HiSlot3',
    text: 'High Slot 4',
    slotKey: 'highSlots',
    displayOrder: 1,
  },
  {
    id: 31,
    name: 'HiSlot4',
    text: 'High Slot 5',
    slotKey: 'highSlots',
    displayOrder: 1,
  },
  {
    id: 32,
    name: 'HiSlot5',
    text: 'High Slot 6',
    slotKey: 'highSlots',
    displayOrder: 1,
  },
  {
    id: 33,
    name: 'HiSlot6',
    text: 'High Slot 7',
    slotKey: 'highSlots',
    displayOrder: 1,
  },
  {
    id: 34,
    name: 'HiSlot7',
    text: 'High Slot 8',
    slotKey: 'highSlots',
    displayOrder: 1,
  },

  {
    id: 36,
    name: 'AssetSafety',
    text: 'Asset Safety',
    slotKey: 'other',
    displayOrder: 999,
  },
  {
    id: 63,
    name: 'Locked',
    text: 'Locked',
    slotKey: 'other',
    displayOrder: 999,
  },
  {
    id: 64,
    name: 'Unlocked',
    text: 'Unlocked',
    slotKey: 'other',
    displayOrder: 999,
  },
  {
    id: 87,
    name: 'DroneBay',
    text: 'Drone Bay',
    slotKey: 'droneBay',
    displayOrder: 6,
  },
  {
    id: 89,
    name: 'Implant',
    text: 'Implant',
    slotKey: 'other',
    displayOrder: 42,
  },
  {
    id: 90,
    name: 'ShipHangar',
    text: 'Ship Hangar',
    slotKey: 'shipHangar',
    displayOrder: 12,
  },

  // Rig Slots
  {
    id: 92,
    name: 'RigSlot0',
    text: 'Rig Slot 1',
    slotKey: 'rigSlots',
    displayOrder: 4,
  },
  {
    id: 93,
    name: 'RigSlot1',
    text: 'Rig Slot 2',
    slotKey: 'rigSlots',
    displayOrder: 4,
  },
  {
    id: 94,
    name: 'RigSlot2',
    text: 'Rig Slot 3',
    slotKey: 'rigSlots',
    displayOrder: 4,
  },
  {
    id: 95,
    name: 'RigSlot3',
    text: 'Rig Slot 4',
    slotKey: 'rigSlots',
    displayOrder: 4,
  },
  {
    id: 96,
    name: 'RigSlot4',
    text: 'Rig Slot 5',
    slotKey: 'rigSlots',
    displayOrder: 4,
  },
  {
    id: 97,
    name: 'RigSlot5',
    text: 'Rig Slot 6',
    slotKey: 'rigSlots',
    displayOrder: 4,
  },
  {
    id: 98,
    name: 'RigSlot6',
    text: 'Rig Slot 7',
    slotKey: 'rigSlots',
    displayOrder: 4,
  },
  {
    id: 99,
    name: 'RigSlot7',
    text: 'Rig Slot 8',
    slotKey: 'rigSlots',
    displayOrder: 4,
  },

  // Subsystem Slots
  {
    id: 125,
    name: 'SubSystemSlot0',
    text: 'Subsystem Slot 1',
    slotKey: 'subSlots',
    displayOrder: 5,
  },
  {
    id: 126,
    name: 'SubSystemSlot1',
    text: 'Subsystem Slot 2',
    slotKey: 'subSlots',
    displayOrder: 5,
  },
  {
    id: 127,
    name: 'SubSystemSlot2',
    text: 'Subsystem Slot 3',
    slotKey: 'subSlots',
    displayOrder: 5,
  },
  {
    id: 128,
    name: 'SubSystemSlot3',
    text: 'Subsystem Slot 4',
    slotKey: 'subSlots',
    displayOrder: 5,
  },
  {
    id: 129,
    name: 'SubSystemSlot4',
    text: 'Subsystem Slot 5',
    slotKey: 'subSlots',
    displayOrder: 5,
  },
  {
    id: 130,
    name: 'SubSystemSlot5',
    text: 'Subsystem Slot 6',
    slotKey: 'subSlots',
    displayOrder: 5,
  },
  {
    id: 131,
    name: 'SubSystemSlot6',
    text: 'Subsystem Slot 7',
    slotKey: 'subSlots',
    displayOrder: 5,
  },
  {
    id: 132,
    name: 'SubSystemSlot7',
    text: 'Subsystem Slot 8',
    slotKey: 'subSlots',
    displayOrder: 5,
  },

  // Specialized Holds
  {
    id: 133,
    name: 'SpecializedFuelBay',
    text: 'Fuel Bay',
    slotKey: 'fuelBay',
    displayOrder: 8,
  },
  {
    id: 134,
    name: 'SpecializedOreHold',
    text: 'Ore Hold',
    slotKey: 'oreHold',
    displayOrder: 14,
  },
  {
    id: 135,
    name: 'SpecializedGasHold',
    text: 'Gas Hold',
    slotKey: 'gasHold',
    displayOrder: 15,
  },
  {
    id: 136,
    name: 'SpecializedMineralHold',
    text: 'Mineral Hold',
    slotKey: 'mineralHold',
    displayOrder: 16,
  },
  {
    id: 137,
    name: 'SpecializedSalvageHold',
    text: 'Salvage Hold',
    slotKey: 'salvageHold',
    displayOrder: 17,
  },
  {
    id: 138,
    name: 'SpecializedShipHold',
    text: 'Ship Hold',
    slotKey: 'shipHold',
    displayOrder: 21,
  },
  {
    id: 139,
    name: 'SpecializedSmallShipHold',
    text: 'Small Ship Hold',
    slotKey: 'smallShipHold',
    displayOrder: 22,
  },
  {
    id: 140,
    name: 'SpecializedMediumShipHold',
    text: 'Medium Ship Hold',
    slotKey: 'mediumShipHold',
    displayOrder: 23,
  },
  {
    id: 141,
    name: 'SpecializedLargeShipHold',
    text: 'Large Ship Hold',
    slotKey: 'largeShipHold',
    displayOrder: 24,
  },
  {
    id: 142,
    name: 'SpecializedIndustrialShipHold',
    text: 'Industrial Ship Hold',
    slotKey: 'industrialShipHold',
    displayOrder: 25,
  },
  {
    id: 143,
    name: 'SpecializedAmmoHold',
    text: 'Ammo Hold',
    slotKey: 'ammoHold',
    displayOrder: 26,
  },
  {
    id: 148,
    name: 'SpecializedCommandCenterHold',
    text: 'Command Center Hold',
    slotKey: 'commandCenterHold',
    displayOrder: 27,
  },
  {
    id: 149,
    name: 'SpecializedPlanetaryCommoditiesHold',
    text: 'Planetary Commodities Hold',
    slotKey: 'planetaryCommoditiesHold',
    displayOrder: 28,
  },
  {
    id: 151,
    name: 'SpecializedMaterialBay',
    text: 'Material Bay',
    slotKey: 'materialBay',
    displayOrder: 29,
  },
  {
    id: 154,
    name: 'QuafeBay',
    text: 'Quafe Bay',
    slotKey: 'quafeBay',
    displayOrder: 30,
  },
  {
    id: 155,
    name: 'FleetHangar',
    text: 'Fleet Hangar',
    slotKey: 'fleetHangar',
    displayOrder: 9,
  },
  {
    id: 156,
    name: 'HiddenModifiers',
    text: 'Hidden Modifiers',
    slotKey: 'other',
    displayOrder: 999,
  },

  // Fighter Bay & Tubes
  {
    id: 158,
    name: 'FighterBay',
    text: 'Fighter Bay',
    slotKey: 'fighterBay',
    displayOrder: 10,
  },
  {
    id: 159,
    name: 'FighterTube0',
    text: 'Fighter Tube 1',
    slotKey: 'fighterTube',
    displayOrder: 11,
  },
  {
    id: 160,
    name: 'FighterTube1',
    text: 'Fighter Tube 2',
    slotKey: 'fighterTube',
    displayOrder: 11,
  },
  {
    id: 161,
    name: 'FighterTube2',
    text: 'Fighter Tube 3',
    slotKey: 'fighterTube',
    displayOrder: 11,
  },
  {
    id: 162,
    name: 'FighterTube3',
    text: 'Fighter Tube 4',
    slotKey: 'fighterTube',
    displayOrder: 11,
  },
  {
    id: 163,
    name: 'FighterTube4',
    text: 'Fighter Tube 5',
    slotKey: 'fighterTube',
    displayOrder: 11,
  },

  {
    id: 173,
    name: 'Deliveries',
    text: 'Deliveries',
    slotKey: 'other',
    displayOrder: 999,
  },
  {
    id: 174,
    name: 'CorpseBay',
    text: 'Corpse Bay',
    slotKey: 'corpseBay',
    displayOrder: 31,
  },
  {
    id: 176,
    name: 'BoosterBay',
    text: 'Booster Bay',
    slotKey: 'boosterBay',
    displayOrder: 32,
  },
  {
    id: 177,
    name: 'SubSystemBay',
    text: 'Subsystem Bay',
    slotKey: 'subsystemBay',
    displayOrder: 33,
  },
  {
    id: 179,
    name: 'FrigateEscapeBay',
    text: 'Frigate Escape Bay',
    slotKey: 'frigateEscapeBay',
    displayOrder: 34,
  },
  {
    id: 180,
    name: 'StructureDeedBay',
    text: 'Structure Deed Bay',
    slotKey: 'structureDeedBay',
    displayOrder: 35,
  },
  {
    id: 181,
    name: 'SpecializedIceHold',
    text: 'Ice Hold',
    slotKey: 'iceHold',
    displayOrder: 18,
  },
  {
    id: 182,
    name: 'SpecializedAsteroidHold',
    text: 'Asteroid Hold',
    slotKey: 'asteroidHold',
    displayOrder: 19,
  },
  {
    id: 183,
    name: 'MobileDepotHold',
    text: 'Mobile Depot Hold',
    slotKey: 'mobileDepotHold',
    displayOrder: 36,
  },
  {
    id: 184,
    name: 'CorporationGoalDeliveries',
    text: 'Corporation Goal Deliveries',
    slotKey: 'other',
    displayOrder: 999,
  },
  {
    id: 185,
    name: 'InfrastructureHangar',
    text: 'Infrastructure Hangar',
    slotKey: 'infrastructureHangar',
    displayOrder: 39,
  },
  {
    id: 186,
    name: 'MoonMaterialBay',
    text: 'Moon Material Bay',
    slotKey: 'moonMaterialBay',
    displayOrder: 40,
  },
  {
    id: 187,
    name: 'CapsuleerDeliveries',
    text: 'Capsuleer Deliveries',
    slotKey: 'other',
    displayOrder: 999,
  },
  {
    id: 188,
    name: 'ExpeditionHold',
    text: 'Expedition Hold',
    slotKey: 'expeditionHold',
    displayOrder: 37,
  },

  {
    id: 1000,
    name: 'HangarAll',
    text: 'Hangar All',
    slotKey: 'hangar',
    displayOrder: 13,
  },
];

/**
 * Map of flag ID to flag definition for quick lookup
 */
const INVENTORY_FLAGS_MAP = new Map<number, InventoryFlag>(
  INVENTORY_FLAGS.map((flag) => [flag.id, flag])
);

/**
 * Get all inventory flag definitions
 */
export function getAllFlags(): InventoryFlag[] {
  return INVENTORY_FLAGS;
}

/**
 * Get all inventory flag definitions sorted by display order
 */
export function getAllFlagsSorted(): InventoryFlag[] {
  return [...INVENTORY_FLAGS].sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Get unique slot keys in display order
 */
export function getSlotKeysInOrder(): string[] {
  const seen = new Set<string>();
  const sorted = getAllFlagsSorted();
  const result: string[] = [];

  for (const flag of sorted) {
    if (!seen.has(flag.slotKey)) {
      seen.add(flag.slotKey);
      result.push(flag.slotKey);
    }
  }

  return result;
}

/**
 * Load flag-to-name mappings
 * Returns a map of flag number to display name
 */
export function loadFlagMappings(): Map<number, string> {
  const flagMap = new Map<number, string>();

  for (const flag of INVENTORY_FLAGS) {
    flagMap.set(flag.id, flag.text);
  }

  return flagMap;
}

/**
 * Get display name for a specific flag
 */
export function getFlagName(flag: number): string {
  const flagDef = INVENTORY_FLAGS_MAP.get(flag);
  return flagDef?.text || `Unknown Flag ${flag}`;
}

/**
 * Get slot key for a specific flag (for organizing items)
 */
export function getSlotKey(flag: number): string {
  const flagDef = INVENTORY_FLAGS_MAP.get(flag);
  return flagDef?.slotKey || 'other';
}

/**
 * Helper to categorize dogma attributes into logical groups
 */

import type { DogmaAttribute as DogmaAttributeModel } from '../models/dogmaAttributes';

export interface DogmaAttributeWithValue extends Pick<
  DogmaAttributeModel,
  'attributeId' | 'name' | 'displayName' | 'unitId'
> {
  value: number;
}

export interface CategorizedAttributes {
  categoryName: string;
  attributes: DogmaAttributeWithValue[];
}

/**
 * Categorize dogma attributes into logical groups for display
 */
export function categorizeDogmaAttributes(
  attributes: DogmaAttributeWithValue[]
): CategorizedAttributes[] {
  const categories = new Map<string, DogmaAttributeWithValue[]>();

  // Define category mappings based on attribute names/display names
  const categoryMap: Record<string, string> = {
    // Slots & Hardpoints
    'High Slots': 'Slots & Hardpoints',
    'Medium Slots': 'Slots & Hardpoints',
    'Low Slots': 'Slots & Hardpoints',
    'Rig Slots': 'Slots & Hardpoints',
    'Turret Hardpoints': 'Slots & Hardpoints',
    'Launcher Hardpoints': 'Slots & Hardpoints',
    Calibration: 'Slots & Hardpoints',

    // Capacitor
    'Capacitor Capacity': 'Capacitor',
    'Capacitor Recharge time': 'Capacitor',
    'Capacitor Warfare Resistance': 'Capacitor',

    // CPU & Powergrid
    'CPU Output': 'CPU & Powergrid',
    'CPU Load': 'CPU & Powergrid',
    'Powergrid Output': 'CPU & Powergrid',
    'Power Load': 'CPU & Powergrid',

    // Shield
    'Shield Capacity': 'Shield',
    'Shield recharge time': 'Shield',
    'Shield EM Damage Resistance': 'Shield Resistances',
    'Shield Thermal Damage Resistance': 'Shield Resistances',
    'Shield Kinetic Damage Resistance': 'Shield Resistances',
    'Shield Explosive Damage Resistance': 'Shield Resistances',

    // Armor
    'Armor Hitpoints': 'Armor',
    'Armor EM Damage Resistance': 'Armor Resistances',
    'Armor Thermal Damage Resistance': 'Armor Resistances',
    'Armor Kinetic Damage Resistance': 'Armor Resistances',
    'Armor Explosive Damage Resistance': 'Armor Resistances',

    // Structure/Hull
    'Structure Hitpoints': 'Structure',
    'Structure EM Damage Resistance': 'Structure Resistances',
    'Structure Thermal Damage Resistance': 'Structure Resistances',
    'Structure Kinetic Damage Resistance': 'Structure Resistances',
    'Structure Explosive Damage Resistance': 'Structure Resistances',

    // Navigation
    'Maximum Velocity': 'Navigation',
    'Inertia Modifier': 'Navigation',
    'Ship Warp Speed': 'Navigation',
    'Signature Radius': 'Navigation',

    // Targeting
    'Maximum Targeting Range': 'Targeting',
    'Maximum Locked Targets': 'Targeting',
    'Scan Resolution': 'Targeting',
    'Maximum Directional Scan Range': 'Targeting',

    // Sensors
    'RADAR Sensor Strength': 'Sensors',
    'Ladar Sensor Strength': 'Sensors',
    'Magnetometric Sensor Strength': 'Sensors',
    'Gravimetric Sensor Strength': 'Sensors',
    'Sensor Warfare Resistance': 'Sensors',

    // Drones
    'Drone Bandwidth': 'Drones',
    'Drone Capacity': 'Drones',

    // Electronic Warfare Resistance
    'Stasis Webifier Resistance': 'EW Resistance',
    'Weapon Disruption Resistance': 'EW Resistance',

    // Misc
    'Tech Level': 'Miscellaneous',
    'Meta Level': 'Miscellaneous',
    'Rig Size': 'Miscellaneous',
    'Primary Skill required': 'Miscellaneous',
    'Item Damage': 'Miscellaneous',
    'Cargo Scan Resistance': 'Miscellaneous',
  };

  // Priority order for categories
  const categoryOrder = [
    'Slots & Hardpoints',
    'CPU & Powergrid',
    'Capacitor',
    'Shield',
    'Shield Resistances',
    'Armor',
    'Armor Resistances',
    'Structure',
    'Structure Resistances',
    'Navigation',
    'Targeting',
    'Sensors',
    'Drones',
    'EW Resistance',
    'Miscellaneous',
  ];

  // Categorize attributes
  for (const attr of attributes) {
    const categoryName = categoryMap[attr.displayName] || 'Other';

    if (!categories.has(categoryName)) {
      categories.set(categoryName, []);
    }
    categories.get(categoryName)!.push(attr);
  }

  // Convert to array and sort by priority
  const result: CategorizedAttributes[] = [];
  for (const categoryName of categoryOrder) {
    if (categories.has(categoryName)) {
      result.push({
        categoryName,
        attributes: categories.get(categoryName)!,
      });
    }
  }

  // Add any remaining categories not in priority order
  for (const [categoryName, attrs] of categories.entries()) {
    if (!categoryOrder.includes(categoryName)) {
      result.push({ categoryName, attributes: attrs });
    }
  }

  return result.filter((cat) => cat.attributes.length > 0);
}

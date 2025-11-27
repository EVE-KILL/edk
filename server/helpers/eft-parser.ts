/**
 * EFT (EVE Fitting Tool) Parser
 *
 * Parses EFT format ship fittings and extracts item information
 */

export interface ParsedFitting {
  shipType: string;
  fitName: string;
  items: ParsedItem[];
}

export interface ParsedItem {
  name: string;
  quantity: number;
  slot?: 'low' | 'mid' | 'high' | 'rig' | 'subsystem' | 'drone' | 'cargo';
  ammo?: string;
}

/**
 * Parse EFT format fitting text
 * Format:
 * [ShipType, Fit Name]
 * Low Slot Module
 * <blank line>
 * Mid Slot Module
 * <blank line>
 * High Slot Module,Ammo Type
 * <blank line>
 * Rig Slot Module
 * <blank line>
 * Drone Name x5
 */
export function parseEFT(eftText: string): ParsedFitting | null {
  const lines = eftText
    .trim()
    .split('\n')
    .map((line) => line.trim());

  if (lines.length === 0) {
    return null;
  }

  // Parse header [ShipType, Fit Name]
  const headerMatch = lines[0].match(/^\[([^,]+),\s*([^\]]+)\]$/);
  if (!headerMatch) {
    return null;
  }

  const shipType = headerMatch[1].trim();
  const fitName = headerMatch[2].trim();
  const items: ParsedItem[] = [];

  // Add ship hull itself
  items.push({
    name: shipType,
    quantity: 1,
    slot: 'cargo',
  });

  let currentSlot: ParsedItem['slot'] = 'low';
  const slotOrder: Array<ParsedItem['slot']> = [
    'low',
    'mid',
    'high',
    'rig',
    'subsystem',
    'drone',
    'cargo',
  ];
  let slotIndex = 0;

  // Parse modules and items
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Empty line indicates next section
    if (line === '') {
      slotIndex++;
      if (slotIndex < slotOrder.length) {
        currentSlot = slotOrder[slotIndex];
      }
      continue;
    }

    // Skip empty slots marked with [Empty ... slot]
    if (line.match(/^\[Empty .* slot\]$/i)) {
      continue;
    }

    // Parse item with quantity (e.g., "Hornet EC-300 x5")
    const quantityMatch = line.match(/^(.+?)\s+x(\d+)$/i);
    if (quantityMatch) {
      items.push({
        name: quantityMatch[1].trim(),
        quantity: parseInt(quantityMatch[2], 10),
        slot: currentSlot,
      });
      continue;
    }

    // Parse item with ammo (e.g., "Torpedo Launcher II,Inferno Rage Torpedo")
    const ammoMatch = line.match(/^([^,]+),(.+)$/);
    if (ammoMatch) {
      const moduleName = ammoMatch[1].trim();
      const ammoName = ammoMatch[2].trim();

      items.push({
        name: moduleName,
        quantity: 1,
        slot: currentSlot,
        ammo: ammoName,
      });

      // Add ammo as separate item (cargo)
      items.push({
        name: ammoName,
        quantity: 1,
        slot: 'cargo',
      });
      continue;
    }

    // Regular module (no quantity or ammo)
    items.push({
      name: line,
      quantity: 1,
      slot: currentSlot,
    });
  }

  return {
    shipType,
    fitName,
    items,
  };
}

/**
 * Parse simple item name or ship name query
 * e.g., "Raven" or "Raven Navy Issue"
 */
export function parseSimpleItem(text: string): ParsedItem | null {
  const cleaned = text.trim();
  if (!cleaned) {
    return null;
  }

  return {
    name: cleaned,
    quantity: 1,
    slot: 'cargo',
  };
}

/**
 * Detect if input looks like EFT format
 */
export function isEFTFormat(text: string): boolean {
  return /^\s*\[.+,.+\]/.test(text);
}

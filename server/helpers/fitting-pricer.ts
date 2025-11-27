/**
 * Fitting Price Calculator
 *
 * Takes parsed fitting data and calculates total value using database prices
 */

import type { ParsedFitting } from './eft-parser';
import { TypeQueries } from '../models/types';
import { getLatestPricesForTypes } from '../models/prices';
import { logger } from './logger';

export interface PricedItem {
  name: string;
  typeId: number | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  slot?: string;
  ammo?: string;
  found: boolean;
}

export interface PricedFitting {
  shipType: string;
  fitName: string;
  items: PricedItem[];
  totalValue: number;
  itemsFound: number;
  itemsNotFound: number;
  regionId: number;
}

/**
 * Price a parsed fitting using database prices
 */
export async function priceFitting(
  fitting: ParsedFitting,
  regionId: number = 10000002
): Promise<PricedFitting> {
  // Get all unique item names
  const uniqueNames = new Set(fitting.items.map((item) => item.name));
  if (fitting.items.some((item) => item.ammo)) {
    fitting.items.forEach((item) => {
      if (item.ammo) uniqueNames.add(item.ammo);
    });
  }

  // Look up type IDs for all items
  const nameToTypeId = new Map<string, number>();
  const typeIds: number[] = [];

  for (const name of uniqueNames) {
    const types = await TypeQueries.searchTypes(name, 5);

    // Try exact match first (case insensitive)
    let matchedType = types.find(
      (t) => (t as any).name.toLowerCase() === name.toLowerCase()
    );

    // If no exact match, take first result if available
    if (!matchedType && types.length > 0) {
      matchedType = types[0];
      logger.debug(
        `Using fuzzy match for "${name}": ${(matchedType as any).name}`
      );
    }

    if (matchedType) {
      const typeId = (matchedType as any).typeId;
      nameToTypeId.set(name, typeId);
      typeIds.push(typeId);
    } else {
      logger.warn(`Could not find type for: ${name}`);
    }
  }

  // Get prices for all type IDs
  const priceMap = await getLatestPricesForTypes(typeIds, regionId);

  // Build priced items
  const pricedItems: PricedItem[] = [];
  let totalValue = 0;
  let itemsFound = 0;
  let itemsNotFound = 0;

  for (const item of fitting.items) {
    const typeId = nameToTypeId.get(item.name) || null;
    const unitPrice = typeId ? priceMap.get(typeId) || 0 : 0;
    const totalPrice = unitPrice * item.quantity;
    const found = typeId !== null && unitPrice > 0;

    pricedItems.push({
      name: item.name,
      typeId,
      quantity: item.quantity,
      unitPrice,
      totalPrice,
      slot: item.slot,
      ammo: item.ammo,
      found,
    });

    if (found) {
      totalValue += totalPrice;
      itemsFound++;
    } else {
      itemsNotFound++;
    }
  }

  return {
    shipType: fitting.shipType,
    fitName: fitting.fitName,
    items: pricedItems,
    totalValue,
    itemsFound,
    itemsNotFound,
    regionId,
  };
}

/**
 * Price a single item by name
 */
export async function priceItem(
  itemName: string,
  quantity: number = 1,
  regionId: number = 10000002
): Promise<PricedItem> {
  const types = await TypeQueries.searchTypes(itemName, 5);

  let matchedType = types.find(
    (t) => (t as any).name.toLowerCase() === itemName.toLowerCase()
  );

  if (!matchedType && types.length > 0) {
    matchedType = types[0];
  }

  if (!matchedType) {
    return {
      name: itemName,
      typeId: null,
      quantity,
      unitPrice: 0,
      totalPrice: 0,
      found: false,
    };
  }

  const typeId = (matchedType as any).typeId;
  const priceMap = await getLatestPricesForTypes([typeId], regionId);
  const unitPrice = priceMap.get(typeId) || 0;
  const totalPrice = unitPrice * quantity;

  return {
    name: (matchedType as any).name,
    typeId,
    quantity,
    unitPrice,
    totalPrice,
    found: unitPrice > 0,
  };
}

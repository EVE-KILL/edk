import { db } from "../../src/db";
import { types } from "../../db/schema";
import { eq } from "drizzle-orm";

export interface ItemDetail {
  item: {
    id: number;
    name: string;
  };
}

/**
 * Generate item detail information
 */
export async function generateItemDetail(itemId: number): Promise<ItemDetail | null> {
  try {
    // Fetch item data
    const item = await db.query.types.findFirst({
      where: eq(types.typeId, itemId),
    });

    if (!item) {
      return null;
    }

    return {
      item: {
        id: item.typeId,
        name: item.name,
      },
    };
  } catch (error) {
    console.error(`Failed to generate item detail for ${itemId}:`, error);
    return null;
  }
}

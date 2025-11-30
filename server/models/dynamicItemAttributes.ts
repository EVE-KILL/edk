import { database } from '../helpers/database';

export interface DynamicItemAttribute {
  typeId: number;
  attributeIds?: number[];
  inputOutputMapping?: any;
}

export async function getDynamicItemAttribute(
  typeId: number
): Promise<DynamicItemAttribute | null> {
  return database.findOne<DynamicItemAttribute>(
    `SELECT * FROM dynamicitemattributes WHERE "typeId" = :typeId`,
    { typeId }
  );
}

export async function getAllDynamicItemAttributes(): Promise<
  DynamicItemAttribute[]
> {
  return database.find<DynamicItemAttribute>(
    `SELECT * FROM dynamicitemattributes ORDER BY "typeId"`
  );
}

export async function countDynamicItemAttributes(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM dynamicitemattributes`
  );
  return result?.count ?? 0;
}

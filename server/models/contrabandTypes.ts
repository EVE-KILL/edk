import { database } from '../helpers/database';

export interface ContrabandType {
  typeId: number;
  factions?: any;
}

export async function getContrabandType(
  typeId: number
): Promise<ContrabandType | null> {
  return database.findOne<ContrabandType>(
    `SELECT * FROM contrabandtypes WHERE "typeId" = :typeId`,
    { typeId }
  );
}

export async function getAllContrabandTypes(): Promise<ContrabandType[]> {
  return database.find<ContrabandType>(
    `SELECT * FROM contrabandtypes ORDER BY "typeId"`
  );
}

export async function countContrabandTypes(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM contrabandtypes`
  );
  return result?.count ?? 0;
}

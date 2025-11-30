import { database } from '../helpers/database';

export interface FreelanceJobSchema {
  schemaId: number;
  schemaData?: any;
}

export async function getFreelanceJobSchema(
  schemaId: number
): Promise<FreelanceJobSchema | null> {
  return database.findOne<FreelanceJobSchema>(
    `SELECT * FROM freelancejobschemas WHERE "schemaId" = :schemaId`,
    { schemaId }
  );
}

export async function getAllFreelanceJobSchemas(): Promise<
  FreelanceJobSchema[]
> {
  return database.find<FreelanceJobSchema>(
    `SELECT * FROM freelancejobschemas ORDER BY "schemaId"`
  );
}

export async function countFreelanceJobSchemas(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM freelancejobschemas`
  );
  return result?.count ?? 0;
}

import { database } from '../helpers/database';

export interface ControlTowerResource {
  controlTowerTypeId: number;
  resources?: any;
}

export async function getControlTowerResource(
  controlTowerTypeId: number
): Promise<ControlTowerResource | null> {
  return database.findOne<ControlTowerResource>(
    `SELECT * FROM controltowerresources WHERE "controlTowerTypeId" = :controlTowerTypeId`,
    { controlTowerTypeId }
  );
}

export async function getAllControlTowerResources(): Promise<
  ControlTowerResource[]
> {
  return database.find<ControlTowerResource>(
    `SELECT * FROM controltowerresources ORDER BY "controlTowerTypeId"`
  );
}

export async function countControlTowerResources(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM controltowerresources`
  );
  return result?.count ?? 0;
}

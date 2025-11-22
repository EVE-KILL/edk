import { database } from '../helpers/database';

export interface ItemStats {
  kills: number;
  losses: number;
  iskDestroyed: number;
  iskLost: number;
}

export async function getItemStats(itemId: number): Promise<ItemStats> {
  const result = await database.findOne<ItemStats>(
    `SELECT
      SUM(CASE WHEN "victimShipTypeId" = :itemId THEN 1 ELSE 0 END) as losses,
      SUM(CASE WHEN "victimShipTypeId" = :itemId THEN "totalValue" ELSE 0 END) as "iskLost",
      SUM(CASE WHEN "topAttackerShipTypeId" = :itemId THEN 1 ELSE 0 END) as kills,
      SUM(CASE WHEN "topAttackerShipTypeId" = :itemId THEN "totalValue" ELSE 0 END) as "iskDestroyed"
    FROM killmails
    WHERE "victimShipTypeId" = :itemId OR "topAttackerShipTypeId" = :itemId`,
    { itemId }
  );
  return (
    result ?? {
      kills: 0,
      losses: 0,
      iskDestroyed: 0,
      iskLost: 0,
    }
  );
}

import { database } from '../helpers/database';

export interface SovereigntyUpgrade {
  upgradeId: number;
  fuel?: any;
  mutuallyExclusiveGroup?: number;
  powerAllocation?: number;
  workforceAllocation?: number;
}

export async function getSovereigntyUpgrade(
  upgradeId: number
): Promise<SovereigntyUpgrade | null> {
  return database.findOne<SovereigntyUpgrade>(
    `SELECT * FROM sovereigntyupgrades WHERE "upgradeId" = :upgradeId`,
    { upgradeId }
  );
}

export async function getAllSovereigntyUpgrades(): Promise<
  SovereigntyUpgrade[]
> {
  return database.find<SovereigntyUpgrade>(
    `SELECT * FROM sovereigntyupgrades ORDER BY "upgradeId"`
  );
}

export async function countSovereigntyUpgrades(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM sovereigntyupgrades`
  );
  return result?.count ?? 0;
}

import { database } from '../helpers/database';
import { logger } from '../helpers/logger';

export interface ESIWarSide {
  alliance_id?: number;
  corporation_id?: number;
  isk_destroyed?: number;
  ships_killed?: number;
}

export interface ESIWarAlly {
  alliance_id?: number;
  corporation_id?: number;
}

export interface ESIWar {
  aggressor: ESIWarSide;
  defender: ESIWarSide;
  allies?: ESIWarAlly[];
  declared?: string;
  started?: string;
  retracted?: string;
  finished?: string;
  mutual?: boolean;
  open_for_allies?: boolean;
}

export interface WarRecord {
  warId: number;
  aggressorAllianceId?: number | null;
  aggressorCorporationId?: number | null;
  aggressorIskDestroyed?: number | null;
  aggressorShipsKilled?: number | null;
  defenderAllianceId?: number | null;
  defenderCorporationId?: number | null;
  defenderIskDestroyed?: number | null;
  defenderShipsKilled?: number | null;
  declared?: string | null;
  started?: string | null;
  retracted?: string | null;
  finished?: string | null;
  mutual?: boolean | null;
  openForAllies?: boolean | null;
  lastUpdated?: string | null;
}

export async function upsertWar(warId: number, war: ESIWar): Promise<void> {
  const now = new Date();

  const warRow = {
    warId,
    aggressorAllianceId: war.aggressor?.alliance_id ?? null,
    aggressorCorporationId: war.aggressor?.corporation_id ?? null,
    aggressorIskDestroyed: war.aggressor?.isk_destroyed ?? 0,
    aggressorShipsKilled: war.aggressor?.ships_killed ?? 0,
    defenderAllianceId: war.defender?.alliance_id ?? null,
    defenderCorporationId: war.defender?.corporation_id ?? null,
    defenderIskDestroyed: war.defender?.isk_destroyed ?? 0,
    defenderShipsKilled: war.defender?.ships_killed ?? 0,
    declared: war.declared ? new Date(war.declared) : null,
    started: war.started ? new Date(war.started) : null,
    retracted: war.retracted ? new Date(war.retracted) : null,
    finished: war.finished ? new Date(war.finished) : null,
    mutual: war.mutual ?? false,
    openForAllies: war.open_for_allies ?? false,
    lastUpdated: now,
  };

  await database.bulkUpsert('wars', [warRow], 'warId');

  const allies = (war.allies ?? [])
    .map((ally) => ({
      warId,
      allianceId: ally.alliance_id ?? null,
      corporationId: ally.corporation_id ?? null,
    }))
    .filter((ally) => ally.allianceId || ally.corporationId);

  await database.execute('DELETE FROM "warAllies" WHERE "warId" = :warId', {
    warId,
  });

  if (allies.length > 0) {
    await database.bulkInsert('warAllies', allies);
  }
}

export async function getExistingWarIds(
  warIds: number[]
): Promise<Set<number>> {
  if (warIds.length === 0) {
    return new Set();
  }

  const rows = await database.find<{ warId: number }>(
    'SELECT "warId" FROM wars WHERE "warId" = ANY(:ids)',
    { ids: warIds }
  );
  return new Set(rows.map((row) => row.warId));
}

export async function clearWars(): Promise<void> {
  await database.execute('TRUNCATE "warAllies", wars RESTART IDENTITY');
  logger.warn('[war] Cleared wars and warAllies tables');
}

export async function getWar(warId: number): Promise<WarRecord | null> {
  return database.findOne<WarRecord>(
    'SELECT * FROM wars WHERE "warId" = :warId',
    { warId }
  );
}

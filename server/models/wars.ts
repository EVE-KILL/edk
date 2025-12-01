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
  // Delete all wars except the legendary faction wars (999999999999999 and 999999999999998)
  await database.execute(
    'DELETE FROM "warAllies" WHERE "warId" NOT IN (999999999999999, 999999999999998)'
  );
  await database.execute(
    'DELETE FROM wars WHERE "warId" NOT IN (999999999999999, 999999999999998)'
  );
  logger.warn(
    '[war] Cleared wars and warAllies tables (preserved legendary faction wars)'
  );

  // Ensure legendary wars exist (recreate if they were deleted)
  await ensureLegendaryWars();
}

/**
 * Ensure legendary faction wars exist in the database
 * Creates them if they don't exist
 */
export async function ensureLegendaryWars(): Promise<void> {
  const legendaryWars = [
    {
      warId: 999999999999999,
      aggressor: { corporation_id: 500001 }, // Caldari State
      defender: { corporation_id: 500004 }, // Gallente Federation
      declared: '2003-05-06T00:00:00Z',
      started: '2003-05-06T00:00:00Z',
      mutual: true,
      open_for_allies: false,
    },
    {
      warId: 999999999999998,
      aggressor: { corporation_id: 500003 }, // Amarr Empire
      defender: { corporation_id: 500002 }, // Minmatar Republic
      declared: '2003-05-06T00:00:00Z',
      started: '2003-05-06T00:00:00Z',
      mutual: true,
      open_for_allies: false,
    },
  ];

  for (const war of legendaryWars) {
    const exists = await database.findOne<{ warId: number }>(
      'SELECT "warId" FROM wars WHERE "warId" = :warId',
      { warId: war.warId }
    );

    if (!exists) {
      await upsertWar(war.warId, war);
      logger.info(`[war] Created legendary faction war ${war.warId}`);
    }
  }
}

export async function getWar(warId: number): Promise<WarRecord | null> {
  return database.findOne<WarRecord>(
    'SELECT * FROM wars WHERE "warId" = :warId',
    { warId }
  );
}

export interface ActiveWar {
  warId: number;
  aggressorName: string;
  aggressorId: number;
  aggressorType: 'alliance' | 'corporation';
  defenderName: string;
  defenderId: number;
  defenderType: 'alliance' | 'corporation';
  started: string | null;
  mutual: boolean;
}

/**
 * Get active wars for a character (via corp/alliance)
 */
export async function getActiveWarsForCharacter(
  characterId: number
): Promise<ActiveWar[]> {
  return database.find<ActiveWar>(
    `SELECT DISTINCT
      w."warId",
      COALESCE(agg_alliance.name, agg_corp.name) as "aggressorName",
      COALESCE(w."aggressorAllianceId", w."aggressorCorporationId") as "aggressorId",
      CASE WHEN w."aggressorAllianceId" IS NOT NULL THEN 'alliance' ELSE 'corporation' END as "aggressorType",
      COALESCE(def_alliance.name, def_corp.name) as "defenderName",
      COALESCE(w."defenderAllianceId", w."defenderCorporationId") as "defenderId",
      CASE WHEN w."defenderAllianceId" IS NOT NULL THEN 'alliance' ELSE 'corporation' END as "defenderType",
      w.started,
      COALESCE(w.mutual, false) as mutual
    FROM wars w
    INNER JOIN characters c ON c."characterId" = :characterId
    LEFT JOIN alliances agg_alliance ON w."aggressorAllianceId" = agg_alliance."allianceId"
    LEFT JOIN corporations agg_corp ON w."aggressorCorporationId" = agg_corp."corporationId"
    LEFT JOIN alliances def_alliance ON w."defenderAllianceId" = def_alliance."allianceId"
    LEFT JOIN corporations def_corp ON w."defenderCorporationId" = def_corp."corporationId"
    WHERE w.finished IS NULL
      AND w.started IS NOT NULL
      AND (
        w."aggressorCorporationId" = c."corporationId"
        OR w."defenderCorporationId" = c."corporationId"
        OR w."aggressorAllianceId" = c."allianceId"
        OR w."defenderAllianceId" = c."allianceId"
      )
    ORDER BY w.started DESC
    LIMIT 10`,
    { characterId }
  );
}

/**
 * Get active wars for a corporation
 */
export async function getActiveWarsForCorporation(
  corporationId: number
): Promise<ActiveWar[]> {
  return database.find<ActiveWar>(
    `SELECT
      w."warId",
      COALESCE(agg_alliance.name, agg_corp.name) as "aggressorName",
      COALESCE(w."aggressorAllianceId", w."aggressorCorporationId") as "aggressorId",
      CASE WHEN w."aggressorAllianceId" IS NOT NULL THEN 'alliance' ELSE 'corporation' END as "aggressorType",
      COALESCE(def_alliance.name, def_corp.name) as "defenderName",
      COALESCE(w."defenderAllianceId", w."defenderCorporationId") as "defenderId",
      CASE WHEN w."defenderAllianceId" IS NOT NULL THEN 'alliance' ELSE 'corporation' END as "defenderType",
      w.started,
      COALESCE(w.mutual, false) as mutual
    FROM wars w
    LEFT JOIN alliances agg_alliance ON w."aggressorAllianceId" = agg_alliance."allianceId"
    LEFT JOIN corporations agg_corp ON w."aggressorCorporationId" = agg_corp."corporationId"
    LEFT JOIN alliances def_alliance ON w."defenderAllianceId" = def_alliance."allianceId"
    LEFT JOIN corporations def_corp ON w."defenderCorporationId" = def_corp."corporationId"
    WHERE w.finished IS NULL
      AND w.started IS NOT NULL
      AND (
        w."aggressorCorporationId" = :corporationId
        OR w."defenderCorporationId" = :corporationId
      )
    ORDER BY w.started DESC
    LIMIT 10`,
    { corporationId }
  );
}

/**
 * Get active wars for an alliance
 */
export async function getActiveWarsForAlliance(
  allianceId: number
): Promise<ActiveWar[]> {
  return database.find<ActiveWar>(
    `SELECT
      w."warId",
      COALESCE(agg_alliance.name, agg_corp.name) as "aggressorName",
      COALESCE(w."aggressorAllianceId", w."aggressorCorporationId") as "aggressorId",
      CASE WHEN w."aggressorAllianceId" IS NOT NULL THEN 'alliance' ELSE 'corporation' END as "aggressorType",
      COALESCE(def_alliance.name, def_corp.name) as "defenderName",
      COALESCE(w."defenderAllianceId", w."defenderCorporationId") as "defenderId",
      CASE WHEN w."defenderAllianceId" IS NOT NULL THEN 'alliance' ELSE 'corporation' END as "defenderType",
      w.started,
      COALESCE(w.mutual, false) as mutual
    FROM wars w
    LEFT JOIN alliances agg_alliance ON w."aggressorAllianceId" = agg_alliance."allianceId"
    LEFT JOIN corporations agg_corp ON w."aggressorCorporationId" = agg_corp."corporationId"
    LEFT JOIN alliances def_alliance ON w."defenderAllianceId" = def_alliance."allianceId"
    LEFT JOIN corporations def_corp ON w."defenderCorporationId" = def_corp."corporationId"
    WHERE w.finished IS NULL
      AND w.started IS NOT NULL
      AND (
        w."aggressorAllianceId" = :allianceId
        OR w."defenderAllianceId" = :allianceId
      )
    ORDER BY w.started DESC
    LIMIT 10`,
    { allianceId }
  );
}

/**
 * Get the legendary faction war for a faction
 */
export async function getLegendaryWarForFaction(factionId: number): Promise<{
  warId: number;
  opponentFactionId: number;
  opponentFactionName: string;
} | null> {
  // Hardcoded legendary wars: Caldari vs Gallente, Amarr vs Minmatar
  const legendaryWars: Record<number, { warId: number; opponent: number }> = {
    500001: { warId: 999999999999999, opponent: 500004 }, // Caldari vs Gallente
    500004: { warId: 999999999999999, opponent: 500001 }, // Gallente vs Caldari
    500003: { warId: 999999999999998, opponent: 500002 }, // Amarr vs Minmatar
    500002: { warId: 999999999999998, opponent: 500003 }, // Minmatar vs Amarr
  };

  const war = legendaryWars[factionId];
  if (!war) return null;

  const opponentFaction = await database.findOne<{ name: string }>(
    'SELECT name FROM factions WHERE "factionId" = :factionId',
    { factionId: war.opponent }
  );

  if (!opponentFaction) return null;

  return {
    warId: war.warId,
    opponentFactionId: war.opponent,
    opponentFactionName: opponentFaction.name,
  };
}

/**
 * Get wars that need updating
 * - Active wars (finished IS NULL)
 * - Recently finished wars (finished within last N days)
 * - Not updated in last hour (respects ESI cache)
 */
export async function getWarsToUpdate(
  recentlyFinishedDays = 3,
  minUpdateIntervalMinutes = 60
): Promise<number[]> {
  const sql = database.sql;

  const cutoffFinished = new Date();
  cutoffFinished.setDate(cutoffFinished.getDate() - recentlyFinishedDays);

  const cutoffUpdated = new Date();
  cutoffUpdated.setMinutes(
    cutoffUpdated.getMinutes() - minUpdateIntervalMinutes
  );

  const rows = await database.find<{ warId: number }>(
    sql`
      SELECT "warId"
      FROM wars
      WHERE (
        -- Active wars
        finished IS NULL
        OR
        -- Recently finished wars
        finished > ${cutoffFinished}
      )
      AND (
        -- Not updated recently (or never updated)
        "lastUpdated" IS NULL
        OR "lastUpdated" < ${cutoffUpdated}
      )
      ORDER BY
        -- Prioritize active wars
        CASE WHEN finished IS NULL THEN 0 ELSE 1 END,
        -- Then by last update time (oldest first)
        "lastUpdated" ASC NULLS FIRST
    `
  );

  return rows.map((row) => row.warId);
}

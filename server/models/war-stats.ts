/**
 * War Statistics Model
 *
 * Provides access to pre-aggregated war statistics from materialized views.
 * These views are refreshed periodically to avoid expensive on-demand aggregations
 * for long-running wars (e.g., 22-year faction wars).
 */

import { database } from '../helpers/database';

/**
 * Overall war statistics
 */
export interface WarStats {
  warId: number;
  killCount: number;
  totalValue: number;
  firstKill: string | null;
  lastKill: string | null;
  aggressorShipsKilled: number;
  aggressorIskDestroyed: number;
  defenderShipsKilled: number;
  defenderIskDestroyed: number;
}

/**
 * War participant statistics
 */
export interface WarParticipant {
  id: number;
  warId: number;
  side: 'aggressor' | 'defender';
  corporationId: number | null;
  allianceId: number | null;
  kills: number;
  value: number;
}

/**
 * Ship class statistics per war
 */
export interface WarShipClass {
  id: number;
  warId: number;
  side: 'aggressor' | 'defender';
  groupId: number;
  count: number;
}

/**
 * Get overall statistics for a war from materialized view
 * For faction wars (999999999999999, 999999999999998), uses faction-specific columns
 */
export async function getWarStats(warId: number): Promise<WarStats | null> {
  const isLegendaryWar = [999999999999999, 999999999999998].includes(warId);

  if (isLegendaryWar) {
    // For faction wars, use the faction-specific columns
    const [row] = await database.query<any>(
      `SELECT
        "warId",
        "killCount",
        "totalValue",
        "firstKill",
        "lastKill",
        "factionAggressorShipsKilled" as "aggressorShipsKilled",
        "factionAggressorIskDestroyed" as "aggressorIskDestroyed",
        "factionDefenderShipsKilled" as "defenderShipsKilled",
        "factionDefenderIskDestroyed" as "defenderIskDestroyed"
      FROM war_stats
      WHERE "warId" = ${warId}`
    );
    return row || null;
  } else {
    // For regular wars, use the standard columns
    const [row] = await database.query<WarStats>(
      `SELECT
        "warId",
        "killCount",
        "totalValue",
        "firstKill",
        "lastKill",
        "aggressorShipsKilled",
        "aggressorIskDestroyed",
        "defenderShipsKilled",
        "defenderIskDestroyed"
      FROM war_stats
      WHERE "warId" = ${warId}`
    );
    return row || null;
  }
}

/**
 * Get top aggressor participants (who killed defenders)
 */
export async function getTopAggressorParticipants(
  warId: number,
  limit = 10
): Promise<WarParticipant[]> {
  return await database.query<WarParticipant>(
    `SELECT
      wp."warId",
      wp.side,
      wp."corporationId",
      wp."allianceId",
      wp.kills,
      wp.value
    FROM war_participants wp
    WHERE wp."warId" = ${warId}
      AND wp.side = 'aggressor'
    ORDER BY wp.kills DESC
    LIMIT ${limit}`
  );
}

/**
 * Get top defender participants (who killed aggressors)
 */
export async function getTopDefenderParticipants(
  warId: number,
  limit = 10
): Promise<WarParticipant[]> {
  return await database.query<WarParticipant>(
    `SELECT
      wp."warId",
      wp.side,
      wp."corporationId",
      wp."allianceId",
      wp.kills,
      wp.value
    FROM war_participants wp
    WHERE wp."warId" = ${warId}
      AND wp.side = 'defender'
    ORDER BY wp.kills DESC
    LIMIT ${limit}`
  );
}

/**
 * Get ship class statistics for aggressor (ships they destroyed)
 */
export async function getAggressorShipClassStats(
  warId: number
): Promise<WarShipClass[]> {
  return await database.query<WarShipClass>(
    `SELECT
      wsc."warId",
      wsc.side,
      wsc."groupId",
      wsc."count"
    FROM war_ship_classes wsc
    WHERE wsc."warId" = ${warId}
      AND wsc.side = 'aggressor'
    ORDER BY wsc."count" DESC`
  );
}

/**
 * Get ship class statistics for defender (ships they destroyed)
 */
export async function getDefenderShipClassStats(
  warId: number
): Promise<WarShipClass[]> {
  return await database.query<WarShipClass>(
    `SELECT
      wsc."warId",
      wsc.side,
      wsc."groupId",
      wsc."count"
    FROM war_ship_classes wsc
    WHERE wsc."warId" = ${warId}
      AND wsc.side = 'defender'
    ORDER BY wsc."count" DESC`
  );
}

/**
 * Check if war stats exist for a given war
 * Useful for determining if we should fall back to live queries
 */
export async function hasWarStats(warId: number): Promise<boolean> {
  const [result] = await database.query<{ exists: boolean }>(
    `SELECT EXISTS(
      SELECT 1 FROM war_stats WHERE "warId" = ${warId}
    ) as exists`
  );
  return result?.exists || false;
}

/**
 * Get most valuable killmail IDs for a war from materialized view
 * Returns up to 10 killmail IDs, caller should fetch full killmail details
 */
export async function getMostValuableKillmailIds(
  warId: number,
  limit = 10
): Promise<number[]> {
  const rows = await database.query<{ killmailId: number }>(
    `SELECT "killmailId"
     FROM war_most_valuable_kills
     WHERE "warId" = ${warId}
     ORDER BY "totalValue" DESC
     LIMIT ${limit}`
  );
  return rows.map((r) => r.killmailId);
}

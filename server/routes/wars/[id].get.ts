import type { H3Event } from 'h3';
import { getQuery, getRouterParam, createError } from 'h3';
import { render, normalizeKillRow } from '../../helpers/templates';
import { database } from '../../helpers/database';
import { handleError } from '../../utils/error';
import { track } from '../../utils/performance-decorators';
import { timeAgo } from '../../helpers/time';
import {
  getFilteredKillsWithNames,
  estimateFilteredKills,
  type KilllistFilters,
} from '../../models/killlist';
import {
  generateWarStructuredData,
  generateWarDescription,
  generateWarKeywords,
  generateBreadcrumbStructuredData,
} from '../../helpers/seo';
import {
  getWarStats,
  getTopAggressorParticipants,
  getTopDefenderParticipants,
  getAggressorShipClassStats,
  getDefenderShipClassStats,
  hasWarStats,
  getMostValuableKillmailIds,
} from '../../models/war-stats';

const PER_PAGE = 25;

export default defineEventHandler(async (event: H3Event) => {
  try {
    const warId = Number.parseInt(getRouterParam(event, 'id') || '0', 10);
    if (!warId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid war id' });
    }

    const query = getQuery(event);
    const page = Math.max(1, Number.parseInt(String(query.page || '1'), 10));
    const perPage = Math.min(
      100,
      Math.max(5, Number.parseInt(String(query.limit || PER_PAGE), 10))
    );

    const LEGENDARY_WAR_IDS = [999999999999999, 999999999999998];
    const isLegendaryWar = LEGENDARY_WAR_IDS.includes(warId);

    const war = await track('war:details', 'database', async () => {
      if (isLegendaryWar) {
        // For legendary faction wars, join with factions table
        const [row] = await database.query<any>(
          `SELECT w.*,
                  af.name  as "aggressorAllianceName",
                  df.name  as "defenderAllianceName"
           FROM wars w
           LEFT JOIN factions af ON af."factionId" = w."aggressorAllianceId"
           LEFT JOIN factions df ON df."factionId" = w."defenderAllianceId"
           WHERE w."warId" = ${warId}
           LIMIT 1`
        );
        return row ? { ...row, isLegendaryWar: true } : null;
      } else {
        // For regular wars, join with alliances and corporations
        const [row] = await database.query<any>(
          `SELECT w.*,
                  aa.name  as "aggressorAllianceName",
                  ac.name  as "aggressorCorporationName",
                  da.name  as "defenderAllianceName",
                  dc.name  as "defenderCorporationName"
           FROM wars w
           LEFT JOIN alliances aa ON aa."allianceId" = w."aggressorAllianceId"
           LEFT JOIN corporations ac ON ac."corporationId" = w."aggressorCorporationId"
           LEFT JOIN alliances da ON da."allianceId" = w."defenderAllianceId"
           LEFT JOIN corporations dc ON dc."corporationId" = w."defenderCorporationId"
           WHERE w."warId" = ${warId}
           LIMIT 1`
        );
        return row || null;
      }
    });

    if (!war) {
      throw createError({ statusCode: 404, statusMessage: 'War not found' });
    }

    const [
      allies,
      killStats,
      topAggressorParticipantsRaw,
      topDefenderParticipantsRaw,
      aggressorShipClassStatsRaw,
      defenderShipClassStatsRaw,
    ] = await track('war:stats', 'database', async () => {
      const allies = await database.query<any>(
        `SELECT wa.*, c.name as "corporationName", a.name as "allianceName"
           FROM "warAllies" wa
           LEFT JOIN corporations c ON c."corporationId" = wa."corporationId"
           LEFT JOIN alliances a ON a."allianceId" = wa."allianceId"
           WHERE wa."warId" = ${warId}`
      );

      // Check if we have materialized view data for this war
      const hasMaterializedStats = await hasWarStats(warId);

      let stats;
      if (hasMaterializedStats) {
        // Use fast materialized view lookup
        stats = await getWarStats(warId);
      } else {
        // Fall back to live aggregation for wars not yet in materialized view
        if (isLegendaryWar) {
          // For legendary faction wars, match by victimFactionId
          [stats] = await database.query<{
            killCount: number;
            totalValue: number;
            firstKill: string | null;
            lastKill: string | null;
            aggressorShipsKilled: number;
            defenderShipsKilled: number;
            aggressorIskDestroyed: number;
            defenderIskDestroyed: number;
          }>(
            `SELECT COUNT(DISTINCT k."killmailId")::int as "killCount",
                      COALESCE(SUM(k."totalValue"), 0)::float as "totalValue",
                      MIN(k."killmailTime") as "firstKill",
                      MAX(k."killmailTime") as "lastKill",
                      COUNT(DISTINCT k."killmailId") FILTER (WHERE
                        k."victimFactionId" = w."defenderAllianceId"
                      )::int AS "aggressorShipsKilled",
                      COUNT(DISTINCT k."killmailId") FILTER (WHERE
                        k."victimFactionId" = w."aggressorAllianceId"
                      )::int AS "defenderShipsKilled",
                      COALESCE(SUM(k."totalValue") FILTER (WHERE
                        k."victimFactionId" = w."defenderAllianceId"
                      ), 0)::float AS "aggressorIskDestroyed",
                      COALESCE(SUM(k."totalValue") FILTER (WHERE
                        k."victimFactionId" = w."aggressorAllianceId"
                      ), 0)::float AS "defenderIskDestroyed"
               FROM killmails k
               JOIN wars w ON w."warId" = ${warId}
               WHERE k."victimFactionId" IN (w."aggressorAllianceId", w."defenderAllianceId")
                 AND k."warId" IS NULL`
          );
        } else {
          // For regular wars, match by corporation/alliance IDs
          [stats] = await database.query<{
            killCount: number;
            totalValue: number;
            firstKill: string | null;
            lastKill: string | null;
            aggressorShipsKilled: number;
            defenderShipsKilled: number;
            aggressorIskDestroyed: number;
            defenderIskDestroyed: number;
          }>(
            `SELECT COUNT(DISTINCT k."killmailId")::int as "killCount",
                      COALESCE(SUM(k."totalValue"), 0)::float as "totalValue",
                      MIN(k."killmailTime") as "firstKill",
                      MAX(k."killmailTime") as "lastKill",
                      COUNT(DISTINCT k."killmailId") FILTER (WHERE
                        k."victimCorporationId" = w."defenderCorporationId" OR
                        k."victimAllianceId" = w."defenderAllianceId"
                      )::int AS "aggressorShipsKilled",
                      COUNT(DISTINCT k."killmailId") FILTER (WHERE
                        k."victimCorporationId" = w."aggressorCorporationId" OR
                        k."victimAllianceId" = w."aggressorAllianceId"
                      )::int AS "defenderShipsKilled",
                      COALESCE(SUM(k."totalValue") FILTER (WHERE
                        k."victimCorporationId" = w."defenderCorporationId" OR
                        k."victimAllianceId" = w."defenderAllianceId"
                      ), 0)::float AS "aggressorIskDestroyed",
                      COALESCE(SUM(k."totalValue") FILTER (WHERE
                        k."victimCorporationId" = w."aggressorCorporationId" OR
                        k."victimAllianceId" = w."aggressorAllianceId"
                      ), 0)::float AS "defenderIskDestroyed"
               FROM killmails k
               JOIN wars w ON w."warId" = k."warId"
               WHERE k."warId" = ${warId}`
          );
        }
      }

      // Get top participants from materialized view if available
      const topAggressorParticipants = hasMaterializedStats
        ? await getTopAggressorParticipants(warId, 10)
        : isLegendaryWar
          ? await database.query<any>(
              `SELECT
                  k."topAttackerCorporationId" as "corporationId",
                  k."topAttackerAllianceId" as "allianceId",
                  count(*)::int as kills,
                  COALESCE(sum(k."totalValue"),0)::float as value
                 FROM killmails k
                 WHERE k."victimFactionId" = ${war.defenderAllianceId}
                   AND k."warId" IS NULL
                   AND (k."topAttackerAllianceId" IS NOT NULL OR k."topAttackerCorporationId" IS NOT NULL)
                 GROUP BY k."topAttackerAllianceId", k."topAttackerCorporationId"
                 ORDER BY kills DESC
                 LIMIT 10`
            )
          : await database.query<any>(
              `SELECT
                  k."topAttackerCorporationId" as "corporationId",
                  k."topAttackerAllianceId" as "allianceId",
                  count(*)::int as kills,
                  COALESCE(sum(k."totalValue"),0)::float as value
                 FROM killmails k
                 JOIN wars w ON w."warId" = k."warId"
                 WHERE k."warId" = ${warId}
                   AND (k."victimCorporationId" = w."defenderCorporationId" OR k."victimAllianceId" = w."defenderAllianceId")
                   AND (k."topAttackerAllianceId" IS NOT NULL OR k."topAttackerCorporationId" IS NOT NULL)
                 GROUP BY k."topAttackerAllianceId", k."topAttackerCorporationId"
                 ORDER BY kills DESC
                 LIMIT 10`
            );

      const topDefenderParticipants = hasMaterializedStats
        ? await getTopDefenderParticipants(warId, 10)
        : isLegendaryWar
          ? await database.query<any>(
              `SELECT
                  k."topAttackerCorporationId" as "corporationId",
                  k."topAttackerAllianceId" as "allianceId",
                  count(*)::int as kills,
                  COALESCE(sum(k."totalValue"),0)::float as value
                 FROM killmails k
                 WHERE k."victimFactionId" = ${war.aggressorAllianceId}
                   AND k."warId" IS NULL
                   AND (k."topAttackerAllianceId" IS NOT NULL OR k."topAttackerCorporationId" IS NOT NULL)
                 GROUP BY k."topAttackerAllianceId", k."topAttackerCorporationId"
                 ORDER BY kills DESC
                 LIMIT 10`
            )
          : await database.query<any>(
              `SELECT
                  k."topAttackerCorporationId" as "corporationId",
                  k."topAttackerAllianceId" as "allianceId",
                  count(*)::int as kills,
                  COALESCE(sum(k."totalValue"),0)::float as value
                 FROM killmails k
                 JOIN wars w ON w."warId" = k."warId"
                 WHERE k."warId" = ${warId}
                   AND (k."victimCorporationId" = w."aggressorCorporationId" OR k."victimAllianceId" = w."aggressorAllianceId")
                   AND (k."topAttackerAllianceId" IS NOT NULL OR k."topAttackerCorporationId" IS NOT NULL)
                 GROUP BY k."topAttackerAllianceId", k."topAttackerCorporationId"
                 ORDER BY kills DESC
                 LIMIT 10`
            );

      // Get ship class stats from materialized view if available
      const aggressorShipClassStats = hasMaterializedStats
        ? await getAggressorShipClassStats(warId)
        : isLegendaryWar
          ? await database.query<any>(
              `SELECT
                  g."groupId",
                  COUNT(DISTINCT k."killmailId")::int as "count"
                 FROM killmails k
                 JOIN types t ON t."typeId" = k."victimShipTypeId"
                 JOIN groups g ON g."groupId" = t."groupId"
                 WHERE k."victimFactionId" = ${war.defenderAllianceId}
                   AND k."warId" IS NULL
                 GROUP BY g."groupId"
                 ORDER BY "count" DESC`
            )
          : await database.query<any>(
              `SELECT
                  g."groupId",
                  COUNT(DISTINCT k."killmailId")::int as "count"
                 FROM killmails k
                 JOIN wars w ON w."warId" = k."warId"
                 JOIN types t ON t."typeId" = k."victimShipTypeId"
                 JOIN groups g ON g."groupId" = t."groupId"
                 WHERE k."warId" = ${warId}
                   AND (k."victimCorporationId" = w."defenderCorporationId" OR k."victimAllianceId" = w."defenderAllianceId")
                 GROUP BY g."groupId"
                 ORDER BY "count" DESC`
            );

      const defenderShipClassStats = hasMaterializedStats
        ? await getDefenderShipClassStats(warId)
        : isLegendaryWar
          ? await database.query<any>(
              `SELECT
                  g."groupId",
                  COUNT(DISTINCT k."killmailId")::int as "count"
                 FROM killmails k
                 JOIN types t ON t."typeId" = k."victimShipTypeId"
                 JOIN groups g ON g."groupId" = t."groupId"
                 WHERE k."victimFactionId" = ${war.aggressorAllianceId}
                   AND k."warId" IS NULL
                 GROUP BY g."groupId"
                 ORDER BY "count" DESC`
            )
          : await database.query<any>(
              `SELECT
                  g."groupId",
                  COUNT(DISTINCT k."killmailId")::int as "count"
                 FROM killmails k
                 JOIN wars w ON w."warId" = k."warId"
                 JOIN types t ON t."typeId" = k."victimShipTypeId"
                 JOIN groups g ON g."groupId" = t."groupId"
                 WHERE k."warId" = ${warId}
                   AND (k."victimCorporationId" = w."aggressorCorporationId" OR k."victimAllianceId" = w."aggressorAllianceId")
                 GROUP BY g."groupId"
                 ORDER BY "count" DESC`
            );

      return [
        allies,
        stats,
        topAggressorParticipants,
        topDefenderParticipants,
        aggressorShipClassStats,
        defenderShipClassStats,
      ];
    });

    // Enrich participants with names from database
    const topAggressorParticipants = await Promise.all(
      topAggressorParticipantsRaw.map(async (p: any) => {
        const names: any = {};
        if (p.corporationId) {
          const [corp] = await database.query<any>(
            `SELECT name as "corporationName" FROM corporations WHERE "corporationId" = ${p.corporationId} LIMIT 1`
          );
          names.corporationName = corp?.corporationName;
        }
        if (p.allianceId) {
          const [ally] = await database.query<any>(
            `SELECT name as "allianceName" FROM alliances WHERE "allianceId" = ${p.allianceId} LIMIT 1`
          );
          names.allianceName = ally?.allianceName;
        }
        return { ...p, ...names };
      })
    );

    const topDefenderParticipants = await Promise.all(
      topDefenderParticipantsRaw.map(async (p: any) => {
        const names: any = {};
        if (p.corporationId) {
          const [corp] = await database.query<any>(
            `SELECT name as "corporationName" FROM corporations WHERE "corporationId" = ${p.corporationId} LIMIT 1`
          );
          names.corporationName = corp?.corporationName;
        }
        if (p.allianceId) {
          const [ally] = await database.query<any>(
            `SELECT name as "allianceName" FROM alliances WHERE "allianceId" = ${p.allianceId} LIMIT 1`
          );
          names.allianceName = ally?.allianceName;
        }
        return { ...p, ...names };
      })
    );

    // Enrich ship class stats with group names
    const aggressorShipClassStats = await Promise.all(
      aggressorShipClassStatsRaw.map(async (s: any) => {
        const [group] = await database.query<any>(
          `SELECT name as "groupName" FROM groups WHERE "groupId" = ${s.groupId} LIMIT 1`
        );
        return { ...s, groupName: group?.groupName };
      })
    );

    const defenderShipClassStats = await Promise.all(
      defenderShipClassStatsRaw.map(async (s: any) => {
        const [group] = await database.query<any>(
          `SELECT name as "groupName" FROM groups WHERE "groupId" = ${s.groupId} LIMIT 1`
        );
        return { ...s, groupName: group?.groupName };
      })
    );

    // Parse filter parameters from existing query object
    const minTotalValue = query.minTotalValue
      ? Number(query.minTotalValue)
      : undefined;
    const securityStatus = query.securityStatus
      ? String(query.securityStatus)
      : undefined;
    const shipClass = query.shipClass ? String(query.shipClass) : undefined;
    const techLevel = query.techLevel ? String(query.techLevel) : undefined;
    const isSolo = query.solo === '1';
    const isNpc = query.npc === '1';
    const isAwox = query.awox === '1';
    const noCapsules = query.noCapsules === '1';

    // Convert UI filters to model filters
    const filters: KilllistFilters = isLegendaryWar
      ? {
          // For legendary wars, filter by faction IDs instead of warId
          victimFactionIds: [
            Number(war.aggressorAllianceId),
            Number(war.defenderAllianceId),
          ],
          minTotalValue,
          isSolo,
          isNpc,
          isAwox,
          noCapsules,
        }
      : {
          warId,
          minTotalValue,
          isSolo,
          isNpc,
          isAwox,
          noCapsules,
        };

    // Convert securityStatus to spaceType
    if (securityStatus) {
      filters.spaceType = securityStatus;
    }

    // Convert shipClass to shipGroupIds
    if (shipClass) {
      const SHIP_CLASS_GROUPS: Record<string, number[]> = {
        frigate: [324, 893, 25, 831, 237], // T1, T2, Faction frigates
        destroyer: [420, 541], // T1, T2 destroyers
        cruiser: [906, 26, 833, 358, 894, 832, 963], // Various cruisers
        battlecruiser: [419, 540], // T1, T2 battlecruisers
        battleship: [27, 898, 900], // T1, T2, T3 battleships
        carrier: [547], // Carriers
        dreadnought: [485], // Dreadnoughts
        supercarrier: [659], // Supercarriers
        titan: [30], // Titans
        freighter: [513, 902], // Freighters and Jump Freighters
        industrial: [28, 380, 513, 902, 941, 883, 463, 543], // Industrial Ships, Haulers, Transports, Mining Barges, Exhumers
        structure: [1657, 1406, 1404, 1408, 2017, 2016], // Citadels
      };
      if (SHIP_CLASS_GROUPS[shipClass]) {
        filters.shipGroupIds = SHIP_CLASS_GROUPS[shipClass];
      }
    }

    // Convert techLevel to metaGroupIds
    if (techLevel) {
      const TECH_LEVEL_META_GROUPS: Record<string, number[]> = {
        t1: [1], // Tech I
        t2: [2], // Tech II
        t3: [14], // Tech III
        faction: [3, 4, 5, 6], // Faction
      };
      if (TECH_LEVEL_META_GROUPS[techLevel]) {
        filters.metaGroupIds = TECH_LEVEL_META_GROUPS[techLevel];
      }
    }
    const [killmailsData, totalKillmails] = await track(
      'war:killlist',
      'database',
      async () => {
        return await Promise.all([
          getFilteredKillsWithNames(filters, page, perPage),
          estimateFilteredKills(filters),
        ]);
      }
    );

    const killmails = killmailsData.map((km: any) => {
      const normalized = normalizeKillRow(km);
      const killmailDate =
        km.killmailTime ?? km.killmail_time ?? normalized.killmailTime;
      return {
        ...normalized,
        totalValue: km.totalValue ?? km.total_value ?? 0,
        killmailTimeRelative: timeAgo(killmailDate),
      };
    });

    const totalPages = Math.max(1, Math.ceil(totalKillmails / perPage));

    // Get recent kills split by side
    const [aggressorKillsData, defenderKillsData] = await track(
      'war:split_kills',
      'database',
      async () => {
        // Aggressor kills (killed defenders)
        const aggressorKills = isLegendaryWar
          ? await database.query<any>(
              `SELECT k.*,
                      ss.name as "solarSystemName",
                      r.name as "regionName",
                      victim_char.name as "victimCharacterName",
                      victim_corp.name as "victimCorporationName",
                      victim_ally.name as "victimAllianceName",
                      victim_ship.name as "victimShipName"
               FROM killmails k
               LEFT JOIN solarsystems ss ON ss."solarSystemId" = k."solarSystemId"
               LEFT JOIN regions r ON r."regionId" = k."regionId"
               LEFT JOIN characters victim_char ON victim_char."characterId" = k."victimCharacterId"
               LEFT JOIN corporations victim_corp ON victim_corp."corporationId" = k."victimCorporationId"
               LEFT JOIN alliances victim_ally ON victim_ally."allianceId" = k."victimAllianceId"
               LEFT JOIN types victim_ship ON victim_ship."typeId" = k."victimShipTypeId"
               WHERE k."victimFactionId" = ${war.defenderAllianceId}
                 AND k."warId" IS NULL
               ORDER BY k."killmailTime" DESC
               LIMIT 3`
            )
          : await database.query<any>(
              `SELECT k.*,
                      ss.name as "solarSystemName",
                      r.name as "regionName",
                      victim_char.name as "victimCharacterName",
                      victim_corp.name as "victimCorporationName",
                      victim_ally.name as "victimAllianceName",
                      victim_ship.name as "victimShipName"
               FROM killmails k
               JOIN wars w ON w."warId" = k."warId"
               LEFT JOIN solarsystems ss ON ss."solarSystemId" = k."solarSystemId"
               LEFT JOIN regions r ON r."regionId" = k."regionId"
               LEFT JOIN characters victim_char ON victim_char."characterId" = k."victimCharacterId"
               LEFT JOIN corporations victim_corp ON victim_corp."corporationId" = k."victimCorporationId"
               LEFT JOIN alliances victim_ally ON victim_ally."allianceId" = k."victimAllianceId"
               LEFT JOIN types victim_ship ON victim_ship."typeId" = k."victimShipTypeId"
               WHERE k."warId" = ${warId}
                 AND (k."victimCorporationId" = w."defenderCorporationId"
                      OR k."victimAllianceId" = w."defenderAllianceId")
               ORDER BY k."killmailTime" DESC
               LIMIT 3`
            );

        // Defender kills (killed aggressors)
        const defenderKills = isLegendaryWar
          ? await database.query<any>(
              `SELECT k.*,
                      ss.name as "solarSystemName",
                      r.name as "regionName",
                      victim_char.name as "victimCharacterName",
                      victim_corp.name as "victimCorporationName",
                      victim_ally.name as "victimAllianceName",
                      victim_ship.name as "victimShipName"
               FROM killmails k
               LEFT JOIN solarsystems ss ON ss."solarSystemId" = k."solarSystemId"
               LEFT JOIN regions r ON r."regionId" = k."regionId"
               LEFT JOIN characters victim_char ON victim_char."characterId" = k."victimCharacterId"
               LEFT JOIN corporations victim_corp ON victim_corp."corporationId" = k."victimCorporationId"
               LEFT JOIN alliances victim_ally ON victim_ally."allianceId" = k."victimAllianceId"
               LEFT JOIN types victim_ship ON victim_ship."typeId" = k."victimShipTypeId"
               WHERE k."victimFactionId" = ${war.aggressorAllianceId}
                 AND k."warId" IS NULL
               ORDER BY k."killmailTime" DESC
               LIMIT 3`
            )
          : await database.query<any>(
              `SELECT k.*,
                      ss.name as "solarSystemName",
                      r.name as "regionName",
                      victim_char.name as "victimCharacterName",
                      victim_corp.name as "victimCorporationName",
                      victim_ally.name as "victimAllianceName",
                      victim_ship.name as "victimShipName"
               FROM killmails k
               JOIN wars w ON w."warId" = k."warId"
               LEFT JOIN solarsystems ss ON ss."solarSystemId" = k."solarSystemId"
               LEFT JOIN regions r ON r."regionId" = k."regionId"
               LEFT JOIN characters victim_char ON victim_char."characterId" = k."victimCharacterId"
               LEFT JOIN corporations victim_corp ON victim_corp."corporationId" = k."victimCorporationId"
               LEFT JOIN alliances victim_ally ON victim_ally."allianceId" = k."victimAllianceId"
               LEFT JOIN types victim_ship ON victim_ship."typeId" = k."victimShipTypeId"
               WHERE k."warId" = ${warId}
                 AND (k."victimCorporationId" = w."aggressorCorporationId"
                      OR k."victimAllianceId" = w."aggressorAllianceId")
               ORDER BY k."killmailTime" DESC
               LIMIT 3`
            );

        return [aggressorKills, defenderKills];
      }
    );

    const aggressorKills = aggressorKillsData.map((km: any) => ({
      killmailId: km.killmailId,
      killmailTime: km.killmailTime,
      killmailTimeRelative: timeAgo(km.killmailTime),
      totalValue: km.totalValue || 0,
      victim: {
        character: {
          id: km.victimCharacterId,
          name: km.victimCharacterName || 'Unknown',
        },
        corporation: {
          id: km.victimCorporationId,
          name: km.victimCorporationName,
        },
        alliance: {
          id: km.victimAllianceId,
          name: km.victimAllianceName,
        },
        ship: {
          typeId: km.victimShipTypeId,
          name: km.victimShipName || 'Unknown Ship',
        },
      },
      solarSystem: {
        id: km.solarSystemId,
        name: km.solarSystemName,
      },
    }));

    const defenderKills = defenderKillsData.map((km: any) => ({
      killmailId: km.killmailId,
      killmailTime: km.killmailTime,
      killmailTimeRelative: timeAgo(km.killmailTime),
      totalValue: km.totalValue || 0,
      victim: {
        character: {
          id: km.victimCharacterId,
          name: km.victimCharacterName || 'Unknown',
        },
        corporation: {
          id: km.victimCorporationId,
          name: km.victimCorporationName,
        },
        alliance: {
          id: km.victimAllianceId,
          name: km.victimAllianceName,
        },
        ship: {
          typeId: km.victimShipTypeId,
          name: km.victimShipName || 'Unknown Ship',
        },
      },
      solarSystem: {
        id: km.solarSystemId,
        name: km.solarSystemName,
      },
    }));

    // Get most valuable kills from all war killmails
    const mostValuableData = await track(
      'war:most_valuable',
      'database',
      async () => {
        // Check if we have materialized view data
        const hasMaterializedStats = await hasWarStats(warId);

        if (hasMaterializedStats) {
          // Use materialized view to get killmail IDs, then fetch full details
          const killmailIds = await getMostValuableKillmailIds(warId, 6);

          if (killmailIds.length === 0) {
            return [];
          }

          // Fetch full killmail details for the top valuable kills
          return await database.query<any>(
            `SELECT k.*,
                    ss.name as "solarSystemName",
                    r.name as "regionName",
                    victim_char.name as "victimCharacterName",
                    victim_corp.name as "victimCorporationName",
                    victim_ally.name as "victimAllianceName",
                    victim_ship.name as "victimShipName",
                    attacker_char.name as "attackerCharacterName",
                    attacker_corp.name as "attackerCorporationName",
                    attacker_ally.name as "attackerAllianceName",
                    attacker_ship.name as "attackerShipName"
             FROM killmails k
             LEFT JOIN solarsystems ss ON ss."solarSystemId" = k."solarSystemId"
             LEFT JOIN regions r ON r."regionId" = k."regionId"
             LEFT JOIN characters victim_char ON victim_char."characterId" = k."victimCharacterId"
             LEFT JOIN corporations victim_corp ON victim_corp."corporationId" = k."victimCorporationId"
             LEFT JOIN alliances victim_ally ON victim_ally."allianceId" = k."victimAllianceId"
             LEFT JOIN types victim_ship ON victim_ship."typeId" = k."victimShipTypeId"
             LEFT JOIN characters attacker_char ON attacker_char."characterId" = k."topAttackerCharacterId"
             LEFT JOIN corporations attacker_corp ON attacker_corp."corporationId" = k."topAttackerCorporationId"
             LEFT JOIN alliances attacker_ally ON attacker_ally."allianceId" = k."topAttackerAllianceId"
             LEFT JOIN types attacker_ship ON attacker_ship."typeId" = k."topAttackerShipTypeId"
             WHERE k."killmailId" = ANY(ARRAY[${killmailIds.join(',')}])
             ORDER BY k."totalValue" DESC`
          );
        } else {
          // Fall back to live query for wars not in materialized view
          if (isLegendaryWar) {
            return await database.query<any>(
              `SELECT k.*,
                      ss.name as "solarSystemName",
                      r.name as "regionName",
                      victim_char.name as "victimCharacterName",
                      victim_corp.name as "victimCorporationName",
                      victim_ally.name as "victimAllianceName",
                      victim_ship.name as "victimShipName",
                      attacker_char.name as "attackerCharacterName",
                      attacker_corp.name as "attackerCorporationName",
                      attacker_ally.name as "attackerAllianceName",
                      attacker_ship.name as "attackerShipName"
               FROM killmails k
               LEFT JOIN solarsystems ss ON ss."solarSystemId" = k."solarSystemId"
               LEFT JOIN regions r ON r."regionId" = k."regionId"
               LEFT JOIN characters victim_char ON victim_char."characterId" = k."victimCharacterId"
               LEFT JOIN corporations victim_corp ON victim_corp."corporationId" = k."victimCorporationId"
               LEFT JOIN alliances victim_ally ON victim_ally."allianceId" = k."victimAllianceId"
               LEFT JOIN types victim_ship ON victim_ship."typeId" = k."victimShipTypeId"
               LEFT JOIN characters attacker_char ON attacker_char."characterId" = k."topAttackerCharacterId"
               LEFT JOIN corporations attacker_corp ON attacker_corp."corporationId" = k."topAttackerCorporationId"
               LEFT JOIN alliances attacker_ally ON attacker_ally."allianceId" = k."topAttackerAllianceId"
               LEFT JOIN types attacker_ship ON attacker_ship."typeId" = k."topAttackerShipTypeId"
               WHERE k."victimFactionId" IN (${war.aggressorAllianceId}, ${war.defenderAllianceId})
                 AND k."warId" IS NULL
               ORDER BY k."totalValue" DESC
               LIMIT 6`
            );
          } else {
            return await database.query<any>(
              `SELECT k.*,
                      ss.name as "solarSystemName",
                      r.name as "regionName",
                      victim_char.name as "victimCharacterName",
                      victim_corp.name as "victimCorporationName",
                      victim_ally.name as "victimAllianceName",
                      victim_ship.name as "victimShipName",
                      attacker_char.name as "attackerCharacterName",
                      attacker_corp.name as "attackerCorporationName",
                      attacker_ally.name as "attackerAllianceName",
                      attacker_ship.name as "attackerShipName"
               FROM killmails k
               LEFT JOIN solarsystems ss ON ss."solarSystemId" = k."solarSystemId"
               LEFT JOIN regions r ON r."regionId" = k."regionId"
               LEFT JOIN characters victim_char ON victim_char."characterId" = k."victimCharacterId"
               LEFT JOIN corporations victim_corp ON victim_corp."corporationId" = k."victimCorporationId"
               LEFT JOIN alliances victim_ally ON victim_ally."allianceId" = k."victimAllianceId"
               LEFT JOIN types victim_ship ON victim_ship."typeId" = k."victimShipTypeId"
               LEFT JOIN characters attacker_char ON attacker_char."characterId" = k."topAttackerCharacterId"
               LEFT JOIN corporations attacker_corp ON attacker_corp."corporationId" = k."topAttackerCorporationId"
               LEFT JOIN alliances attacker_ally ON attacker_ally."allianceId" = k."topAttackerAllianceId"
               LEFT JOIN types attacker_ship ON attacker_ship."typeId" = k."topAttackerShipTypeId"
               WHERE k."warId" = ${warId}
               ORDER BY k."totalValue" DESC
               LIMIT 6`
            );
          }
        }
      }
    );

    const mostValuable = mostValuableData.map((km: any) => ({
      killmailId: km.killmailId,
      killmailTime: km.killmailTime,
      killmailTimeRelative: timeAgo(km.killmailTime),
      totalValue: km.totalValue || 0,
      victim: {
        character: {
          id: km.victimCharacterId,
          name: km.victimCharacterName || 'Unknown',
        },
        corporation: {
          id: km.victimCorporationId,
          name: km.victimCorporationName,
        },
        alliance: {
          id: km.victimAllianceId,
          name: km.victimAllianceName,
        },
        ship: {
          typeId: km.victimShipTypeId,
          name: km.victimShipName || 'Unknown Ship',
        },
      },
      attackers: [
        {
          character: {
            id: km.topAttackerCharacterId,
            name: km.attackerCharacterName || 'Unknown',
          },
          corporation: {
            id: km.topAttackerCorporationId,
            name: km.attackerCorporationName,
          },
          alliance: {
            id: km.topAttackerAllianceId,
            name: km.attackerAllianceName,
          },
          ship: {
            typeId: km.topAttackerShipTypeId,
            name: km.attackerShipName,
          },
        },
      ],
      solarSystem: {
        id: km.solarSystemId,
        name: km.solarSystemName,
      },
    }));

    // SEO metadata
    const aggressorName =
      war.aggressorAllianceName || war.aggressorCorporationName || 'Unknown';
    const defenderName =
      war.defenderAllianceName || war.defenderCorporationName || 'Unknown';

    const warTitle = `${aggressorName} vs ${defenderName}`;

    const description = generateWarDescription({
      warId,
      aggressorName,
      defenderName,
      totalKills: killStats.killCount,
      totalValue: killStats.totalValue,
      aggressorKills: killStats.aggressorShipsKilled,
      defenderKills: killStats.defenderShipsKilled,
      declared: war.declared || war.started,
    });

    const keywords = generateWarKeywords({
      aggressorName,
      defenderName,
      aggressorAllyNames: allies
        .filter((a) => a.side === 'aggressor')
        .map((a) => a.name),
      defenderAllyNames: allies
        .filter((a) => a.side === 'defender')
        .map((a) => a.name),
    });

    const structuredData = generateWarStructuredData({
      warId,
      aggressorName,
      defenderName,
      declared: war.declared || war.started,
      totalKills: killStats.killCount,
      totalValue: killStats.totalValue,
      aggressorKills: killStats.aggressorShipsKilled,
      defenderKills: killStats.defenderShipsKilled,
    });

    const breadcrumbs = [
      { name: 'Home', url: '/' },
      { name: 'Wars', url: '/wars' },
      { name: warTitle, url: `/wars/${warId}` },
    ];

    const breadcrumbData = generateBreadcrumbStructuredData(breadcrumbs);

    // Build filter query string for pagination
    const filterParams = new URLSearchParams();
    if (minTotalValue) filterParams.set('minTotalValue', String(minTotalValue));
    if (securityStatus) filterParams.set('securityStatus', securityStatus);
    if (shipClass) filterParams.set('shipClass', shipClass);
    if (techLevel) filterParams.set('techLevel', techLevel);
    if (isSolo) filterParams.set('solo', '1');
    if (isNpc) filterParams.set('npc', '1');
    if (isAwox) filterParams.set('awox', '1');
    if (noCapsules) filterParams.set('noCapsules', '1');
    if (perPage !== PER_PAGE) filterParams.set('limit', String(perPage));
    const filterQueryString = filterParams.toString();

    const pageContext = {
      title: `${warTitle} - War #${warId}`,
      description,
      keywords,
      url: `/wars/${warId}`,
      ogTitle: warTitle,
      ogDescription: description,
      structuredData: `${structuredData}${breadcrumbData}`,
    };

    const data = {
      pageHeader: {
        title: warTitle,
        breadcrumbs: [
          { label: 'Home', url: '/' },
          { label: 'Wars', url: '/wars' },
          { label: `War #${warId}`, url: `/wars/${warId}` },
        ],
        meta: [
          ...(war.mutual ? [{ type: 'pill', text: 'Mutual' }] : []),
          ...(war.openForAllies
            ? [{ type: 'pill', text: 'Open for Allies' }]
            : []),
          {
            type: 'text',
            text: `Started ${war.declared ? timeAgo(war.declared) : war.started ? timeAgo(war.started) : 'Unknown'}`,
          },
        ],
      },
      war: {
        ...war,
        declared: war.declared ? timeAgo(war.declared) : null,
        started: war.started ? timeAgo(war.started) : null,
        finished: war.finished ? timeAgo(war.finished) : null,
      },
      stats: {
        ...killStats,
        firstKill: killStats.firstKill ? timeAgo(killStats.firstKill) : null,
        lastKill: killStats.lastKill ? timeAgo(killStats.lastKill) : null,
      },
      allies,
      topAggressorParticipants,
      topDefenderParticipants,
      aggressorShipClassStats,
      defenderShipClassStats,
      aggressorKills,
      defenderKills,
      mostValuable,
      killmails,
      filterDefaults: {
        minTotalValue,
        securityStatus,
        shipClass,
        techLevel,
        isSolo,
        isNpc,
        isAwox,
        noCapsules,
      },
      filterQueryString,
      pagination: {
        currentPage: page,
        page,
        perPage,
        limit: perPage,
        totalPages,
        total: totalKillmails,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null,
        hasPrev: page > 1,
        hasNext: page < totalPages,
        showFirst: page > 3,
        showLast: page < totalPages - 2,
        pages: generatePageNumbers(page, totalPages),
      },
    };

    return await render('pages/war-detail.hbs', pageContext, data, event);
  } catch (error: any) {
    return handleError(event, error);
  }
});

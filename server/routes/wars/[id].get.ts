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

const PER_PAGE = 25;

// Group IDs mapping for logical ship class grouping
const SHIP_CLASS_GROUPS: Record<number, { category: string; order: number }> = {
  // Frigates
  25: { category: 'Frigate', order: 1 }, // Frigate
  237: { category: 'Frigate', order: 1 }, // Assault Frigate
  324: { category: 'Frigate', order: 1 }, // Interceptor
  831: { category: 'Frigate', order: 1 }, // Covert Ops
  893: { category: 'Frigate', order: 1 }, // Stealth Bomber
  // Destroyers
  420: { category: 'Destroyer', order: 2 }, // Destroyer
  541: { category: 'Destroyer', order: 2 }, // Interdictory Destroyer
  // Cruisers
  906: { category: 'Cruiser', order: 3 }, // Heavy Assault Cruiser
  26: { category: 'Cruiser', order: 3 }, // Cruiser
  833: { category: 'Cruiser', order: 3 }, // Logistics
  358: { category: 'Cruiser', order: 3 }, // Heavy Cruiser
  894: { category: 'Cruiser', order: 3 }, // Electronic Attack Ship
  832: { category: 'Cruiser', order: 3 }, // Recon Ship
  963: { category: 'Cruiser', order: 3 }, // Strategic Cruiser
  // Battle Cruisers
  419: { category: 'Battle Cruiser', order: 4 }, // Battlecruiser
  540: { category: 'Battle Cruiser', order: 4 }, // Command Ship
  // Battleships
  27: { category: 'Battleship', order: 5 }, // Battleship
  898: { category: 'Battleship', order: 5 }, // Black Ops
  900: { category: 'Battleship', order: 5 }, // Marauder
  // Capital Ships
  547: { category: 'Carrier', order: 6 }, // Carrier
  659: { category: 'Super Carrier', order: 7 }, // Supercarrier
  485: { category: 'Dreadnought', order: 8 }, // Dreadnought
  30: { category: 'Titan', order: 9 }, // Titan
  // Industrial & Structures
  513: { category: 'Freighter', order: 10 }, // Freighter
  902: { category: 'Freighter', order: 10 }, // Jump Freighter
  // Structures
  1657: { category: 'Structure', order: 11 }, // Astrahus
  1406: { category: 'Structure', order: 11 }, // Fortizar
  1404: { category: 'Structure', order: 11 }, // Keepstar
  1408: { category: 'Structure', order: 11 }, // Structure
  2017: { category: 'Structure', order: 11 }, // Structure
  2016: { category: 'Structure', order: 11 }, // Structure
};

interface ShipClassCategory {
  category: string;
  total: number;
  order: number;
}

function groupShipClassStats(
  stats: Array<{ groupId: number; groupName: string; count: number }>
): { top: ShipClassCategory[]; rest: ShipClassCategory[] } {
  const grouped = new Map<string, ShipClassCategory>();

  for (const stat of stats) {
    const classInfo = SHIP_CLASS_GROUPS[stat.groupId];
    const category = classInfo?.category || stat.groupName;
    const order = classInfo?.order || 999;

    const key = category;
    if (!grouped.has(key)) {
      grouped.set(key, { category, total: 0, order });
    }

    const entry = grouped.get(key)!;
    entry.total += stat.count;
  }

  // Sort by total count descending
  const sorted = Array.from(grouped.values()).sort((a, b) => b.total - a.total);
  return {
    top: sorted.slice(0, 10),
    rest: sorted.slice(10),
  };
}

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

    const war = await track('war:details', 'database', async () => {
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
    });

    if (!war) {
      throw createError({ statusCode: 404, statusMessage: 'War not found' });
    }

    const [
      allies,
      killStats,
      topAggressorParticipants,
      topDefenderParticipants,
      aggressorShipClassStats,
      defenderShipClassStats,
    ] = await track('war:stats', 'database', async () => {
      const allies = await database.query<any>(
        `SELECT wa.*, c.name as "corporationName", a.name as "allianceName"
           FROM "warAllies" wa
           LEFT JOIN corporations c ON c."corporationId" = wa."corporationId"
           LEFT JOIN alliances a ON a."allianceId" = wa."allianceId"
           WHERE wa."warId" = ${warId}`
      );

      const [stats] = await database.query<{
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

      // Get top aggressor participants (killed defenders)
      const topAggressorParticipants = await database.query<any>(
        `SELECT
            k."topAttackerCorporationId" as "corporationId",
            c.name as "corporationName",
            k."topAttackerAllianceId" as "allianceId",
            a.name as "allianceName",
            count(*)::int as kills,
            COALESCE(sum(k."totalValue"),0)::float as value
           FROM killmails k
           JOIN wars w ON w."warId" = k."warId"
           LEFT JOIN alliances a ON a."allianceId" = k."topAttackerAllianceId"
           LEFT JOIN corporations c ON c."corporationId" = k."topAttackerCorporationId"
           WHERE k."warId" = ${warId}
             AND (k."victimCorporationId" = w."defenderCorporationId" OR k."victimAllianceId" = w."defenderAllianceId")
             AND (k."topAttackerAllianceId" IS NOT NULL OR k."topAttackerCorporationId" IS NOT NULL)
           GROUP BY k."topAttackerAllianceId", k."topAttackerCorporationId", a.name, c.name
           ORDER BY kills DESC
           LIMIT 10`
      );

      // Get top defender participants (killed aggressors)
      const topDefenderParticipants = await database.query<any>(
        `SELECT
            k."topAttackerCorporationId" as "corporationId",
            c.name as "corporationName",
            k."topAttackerAllianceId" as "allianceId",
            a.name as "allianceName",
            count(*)::int as kills,
            COALESCE(sum(k."totalValue"),0)::float as value
           FROM killmails k
           JOIN wars w ON w."warId" = k."warId"
           LEFT JOIN alliances a ON a."allianceId" = k."topAttackerAllianceId"
           LEFT JOIN corporations c ON c."corporationId" = k."topAttackerCorporationId"
           WHERE k."warId" = ${warId}
             AND (k."victimCorporationId" = w."aggressorCorporationId" OR k."victimAllianceId" = w."aggressorAllianceId")
             AND (k."topAttackerAllianceId" IS NOT NULL OR k."topAttackerCorporationId" IS NOT NULL)
           GROUP BY k."topAttackerAllianceId", k."topAttackerCorporationId", a.name, c.name
           ORDER BY kills DESC
           LIMIT 10`
      );

      // Get ship class stats for aggressor (victims they killed)
      const aggressorShipClassStats = await database.query<any>(
        `SELECT
            g."groupId",
            g."name" as "groupName",
            COUNT(DISTINCT k."killmailId")::int as "count"
           FROM killmails k
           JOIN wars w ON w."warId" = k."warId"
           JOIN types t ON t."typeId" = k."victimShipTypeId"
           JOIN groups g ON g."groupId" = t."groupId"
           WHERE k."warId" = ${warId}
             AND (k."victimCorporationId" = w."defenderCorporationId" OR k."victimAllianceId" = w."defenderAllianceId")
           GROUP BY g."groupId", g."name"
           ORDER BY "count" DESC`
      );

      // Get ship class stats for defender (victims they killed)
      const defenderShipClassStats = await database.query<any>(
        `SELECT
            g."groupId",
            g."name" as "groupName",
            COUNT(DISTINCT k."killmailId")::int as "count"
           FROM killmails k
           JOIN wars w ON w."warId" = k."warId"
           JOIN types t ON t."typeId" = k."victimShipTypeId"
           JOIN groups g ON g."groupId" = t."groupId"
           WHERE k."warId" = ${warId}
             AND (k."victimCorporationId" = w."aggressorCorporationId" OR k."victimAllianceId" = w."aggressorAllianceId")
           GROUP BY g."groupId", g."name"
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
    const filters: KilllistFilters = {
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
        const aggressorKills = await database.query<any>(
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
        const defenderKills = await database.query<any>(
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
      { name: `War #${warId}`, url: `/wars/${warId}` },
    ];

    const breadcrumbData = generateBreadcrumbStructuredData(breadcrumbs);

    // Group ship class stats into logical categories
    const aggressorShipClassCategories = groupShipClassStats(
      aggressorShipClassStats
    );
    const defenderShipClassCategories = groupShipClassStats(
      defenderShipClassStats
    );

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
      title: `War #${warId}: ${aggressorName} vs ${defenderName}`,
      description,
      keywords,
      url: `/wars/${warId}`,
      ogTitle: `War #${warId}: ${aggressorName} vs ${defenderName}`,
      ogDescription: description,
      structuredData: `${structuredData}${breadcrumbData}`,
    };

    const data = {
      pageHeader: {
        title: `War #${warId}`,
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
      },
      stats: {
        ...killStats,
        firstKill: killStats.firstKill ? timeAgo(killStats.firstKill) : null,
        lastKill: killStats.lastKill ? timeAgo(killStats.lastKill) : null,
      },
      allies,
      topAggressorParticipants,
      topDefenderParticipants,
      aggressorShipClassStats: aggressorShipClassCategories,
      defenderShipClassStats: defenderShipClassCategories,
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

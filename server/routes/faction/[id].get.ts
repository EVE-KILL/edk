import type { H3Event } from 'h3';
import { getRouterParam, createError, getQuery } from 'h3';
import { render, normalizeKillRow } from '../../helpers/templates';
import { database } from '../../helpers/database';
import { handleError } from '../../utils/error';
import { track } from '../../utils/performance-decorators';
import { generateBreadcrumbStructuredData } from '../../helpers/seo';
import {
  getFilteredKillsWithNames,
  getMostValuableKillsFiltered,
  estimateFilteredKills,
  type KilllistFilters,
} from '../../models/killlist';
import {
  getTopSystemsFiltered,
  getTopRegionsFiltered,
  getTopCharactersFiltered,
  getTopCorporationsFiltered,
  getTopAlliancesFiltered,
  getTopShipsFiltered,
} from '../../models/topBoxes';
import { generatePageNumbers } from '../../helpers/pagination';
import { getLegendaryWarForFaction } from '../../models/wars';

const TOP_BOX_LOOKBACK_DAYS = 7;
const MOST_VALUABLE_LOOKBACK_DAYS = 7;

export default defineEventHandler(async (event: H3Event) => {
  try {
    const factionId = Number.parseInt(getRouterParam(event, 'id') || '0', 10);
    if (!factionId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid faction id',
      });
    }

    // Get pagination parameters
    const query = getQuery(event);
    const page = Math.max(1, Number.parseInt(String(query.page || '1'), 10));
    const perPage = 50;

    // Fetch faction data with home system, corporation, and militia corp info
    const faction = await track('faction:details', 'database', async () => {
      return await database.findOne<{
        factionId: number;
        name: string;
        description: string | null;
        shortDescription: string | null;
        solarSystemId: number | null;
        solarSystemName: string | null;
        regionId: number | null;
        regionName: string | null;
        corporationId: number | null;
        corporationName: string | null;
        militiaCorporationId: number | null;
        militiaCorporationName: string | null;
      }>(
        `SELECT
          f."factionId",
          f.name,
          f.description,
          f."shortDescription",
          f."solarSystemId",
          s.name as "solarSystemName",
          s."regionId" as "regionId",
          r.name as "regionName",
          f."corporationId",
          corp.name as "corporationName",
          f."militiaCorporationId",
          militia.name as "militiaCorporationName"
         FROM factions f
         LEFT JOIN solarSystems s ON f."solarSystemId" = s."solarSystemId"
         LEFT JOIN regions r ON s."regionId" = r."regionId"
         LEFT JOIN corporations corp ON f."corporationId" = corp."corporationId"
         LEFT JOIN npcCorporations militia ON f."militiaCorporationId" = militia."corporationId"
         WHERE f."factionId" = :factionId`,
        { factionId }
      );
    });

    if (!faction) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Faction not found',
      });
    }

    // Get legendary war for this faction
    const legendaryWar = await getLegendaryWarForFaction(factionId);
    const activeWars = legendaryWar
      ? [
          {
            warId: legendaryWar.warId,
            aggressorName: faction.name,
            aggressorId: factionId,
            aggressorType: 'faction' as const,
            defenderName: legendaryWar.opponentFactionName,
            defenderId: legendaryWar.opponentFactionId,
            defenderType: 'faction' as const,
            started: null,
            mutual: false,
          },
        ]
      : [];

    // Build filters for this faction (victims in this faction)
    const filters: KilllistFilters = {
      victimFactionIds: [factionId],
    };

    // Get total killmails count
    const totalKillmails = await track(
      'faction:estimate_kills',
      'database',
      async () => {
        return await estimateFilteredKills(filters);
      }
    );

    const totalPages = Math.ceil(totalKillmails / perPage);

    // Fetch recent killmails
    const recentKillmails = await track(
      'faction:recent_kills',
      'database',
      async () => {
        const kills = await getFilteredKillsWithNames(filters, page, perPage);
        return kills.map((k) => {
          const normalized = normalizeKillRow(k);
          const killmailTimeRaw: unknown =
            k.killmailTime ?? normalized.killmailTime;
          const killmailTimeValue =
            killmailTimeRaw instanceof Date
              ? killmailTimeRaw.toISOString()
              : String(killmailTimeRaw);
          return {
            ...normalized,
            totalValue: k.totalValue ?? normalized.totalValue,
            killmailTime: killmailTimeValue,
          };
        });
      }
    );

    // Get Top Boxes data
    const [
      topSystems,
      topRegions,
      topCharacters,
      topCorporations,
      topAlliances,
      topShips,
    ] = await track('faction:top_boxes', 'application', async () => {
      return await Promise.all([
        getTopSystemsFiltered(filters, 10, TOP_BOX_LOOKBACK_DAYS),
        getTopRegionsFiltered(filters, 10, TOP_BOX_LOOKBACK_DAYS),
        getTopCharactersFiltered(filters, 10, TOP_BOX_LOOKBACK_DAYS),
        getTopCorporationsFiltered(filters, 10, TOP_BOX_LOOKBACK_DAYS),
        getTopAlliancesFiltered(filters, 10, TOP_BOX_LOOKBACK_DAYS),
        getTopShipsFiltered(filters, 10, TOP_BOX_LOOKBACK_DAYS),
      ]);
    });

    // Get Most Valuable Kills
    const mostValuableKillsData = await track(
      'faction:most_valuable',
      'application',
      async () => {
        return await getMostValuableKillsFiltered(
          filters,
          MOST_VALUABLE_LOOKBACK_DAYS
        );
      }
    );
    mostValuableKillsData.sort((a, b) => b.totalValue - a.totalValue);
    const topValuableKills = mostValuableKillsData.slice(0, 6);

    const mostValuableKills = await track(
      'faction:normalize_valuable',
      'application',
      async () => {
        return topValuableKills.map((k) => {
          const normalized = normalizeKillRow(k);
          const killmailTimeRaw: unknown =
            k.killmailTime ?? normalized.killmailTime;
          const killmailTimeValue =
            killmailTimeRaw instanceof Date
              ? killmailTimeRaw.toISOString()
              : String(killmailTimeRaw);
          return {
            ...normalized,
            totalValue: k.totalValue ?? normalized.totalValue,
            killmailTime: killmailTimeValue,
          };
        });
      }
    );

    // Format top boxes data
    const top10Stats = await track(
      'faction:format_top_boxes',
      'application',
      async () => {
        return {
          characters: topCharacters.map((c) => ({
            name: c.name,
            kills: c.kills,
            imageType: 'character',
            imageId: c.id,
            link: `/character/${c.id}`,
          })),
          corporations: topCorporations.map((c) => ({
            name: c.name,
            kills: c.kills,
            imageType: 'corporation',
            imageId: c.id,
            link: `/corporation/${c.id}`,
          })),
          alliances: topAlliances.map((a) => ({
            name: a.name,
            kills: a.kills,
            imageType: 'alliance',
            imageId: a.id,
            link: `/alliance/${a.id}`,
          })),
          systems: topSystems.map((s) => ({
            name: s.name,
            kills: s.kills,
            imageType: 'system',
            imageId: s.id,
            link: `/system/${s.id}`,
          })),
          regions: topRegions.map((r) => ({
            name: r.name,
            kills: r.kills,
            imageType: 'region',
            imageId: r.id,
            link: `/region/${r.id}`,
          })),
          ships: topShips.map((s) => ({
            name: s.name,
            kills: s.kills,
            imageType: 'ship',
            imageId: s.id,
            link: `/item/${s.id}`,
          })),
        };
      }
    );

    // Pagination
    const pagination = {
      currentPage: page,
      totalPages,
      limit: perPage,
      pages: generatePageNumbers(page, totalPages),
      hasPrev: page > 1,
      hasNext: page < totalPages,
      prevPage: page - 1,
      nextPage: page + 1,
      showFirst: page > 3 && totalPages > 5,
      showLast: page < totalPages - 2 && totalPages > 5,
    };

    const baseUrl = `/faction/${factionId}`;

    const description = faction.description
      ? `${faction.name} - ${faction.description.substring(0, 160)}...`
      : `${faction.name} - EVE Online Faction Warfare Killmails`;

    const breadcrumbs = [
      { label: 'Home', url: '/' },
      { label: 'Factions', url: '/factions' },
      { label: faction.name, url: baseUrl },
    ];

    const structuredData = generateBreadcrumbStructuredData(breadcrumbs);

    const pageHeader = {
      title: faction.name,
      breadcrumbs,
    };

    // Build faction properties for page header pills
    const factionProperties: Array<{ label: string; value: string | number }> =
      [];

    if (faction.solarSystemName) {
      factionProperties.push({
        label: 'Home System',
        value: faction.solarSystemName,
      });
    }

    if (faction.corporationName) {
      factionProperties.push({
        label: 'Corporation',
        value: faction.corporationName,
      });
    }

    // Format faction logo URL
    const imageUrl = `https://images.evetech.net/corporations/${factionId}/logo?size=256`;

    return await render(
      'pages/faction',
      {
        title: `${faction.name} - Faction`,
        description,
        url: baseUrl,
        keywords: `eve online, ${faction.name}, faction, faction warfare`,
        ogTitle: faction.name,
        ogDescription: description,
        structuredData,
      },
      {
        pageHeader,
        factionProperties,
        factionId,
        name: faction.name,
        imageUrl,
        kills: totalKillmails,
        faction: {
          description: faction.description,
          homeSystem: faction.solarSystemId
            ? {
                solarSystemId: faction.solarSystemId,
                name: faction.solarSystemName,
                regionName: faction.regionName,
                regionId: faction.regionId,
              }
            : null,
          corporation: faction.corporationId
            ? {
                corporationId: faction.corporationId,
                name: faction.corporationName,
              }
            : null,
          militiaCorporation: faction.militiaCorporationId
            ? {
                militiaCorporationId: faction.militiaCorporationId,
                name: faction.militiaCorporationName,
              }
            : null,
          sizeFactor: null, // Would need to fetch from factions table if needed
          stationCount: null, // Would need to count from npcStations if needed
        },
        baseUrl,
        recentKillmails,
        pagination,
        top10Stats,
        mostValuableKills,
        wsFilter: {
          type: 'faction',
          topic: String(factionId),
          mode: 'kills',
        },
        topTimeRangeLabel: `Last ${TOP_BOX_LOOKBACK_DAYS} Days`,
        mostValuableTimeRange: `Last ${MOST_VALUABLE_LOOKBACK_DAYS} Days`,
      },
      event
    );
  } catch (error: any) {
    return handleError(event, error);
  }
});

import { z } from 'zod';
import { validate } from '~/server/utils/validation';
import type { H3Event } from 'h3';
import { timeAgo } from '../../../helpers/time';
import { render, normalizeKillRow } from '../../../helpers/templates';
import { getCorporationWithAlliance } from '../../../models/corporations';
import {
  getEntityKillmails,
  countEntityKillmails,
} from '../../../models/killlist';
import { getEntityStats } from '../../../models/entityStats';
import { getMostValuableKillsByCorporation } from '../../../models/mostValuableKills';
import { getTopByKills } from '../../../models/topBoxes';

export default defineEventHandler(async (event: H3Event) => {
  const { params, query } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
    query: z.object({
      page: z.coerce.number().int().positive().optional().default(1),
    }),
  });

  const { id: corporationId } = params;
  const { page } = query;

  // Fetch corporation basic info using model
  const corporationData = await getCorporationWithAlliance(corporationId);

  if (!corporationData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Corporation not found',
    });
  }

  // Fetch all entity data in parallel
  const [stats, topSystems, topRegions, topCorps, topAlliances, mostValuable] =
    await Promise.all([
      getEntityStats(corporationId, 'corporation', 'all'),
      getTopByKills('week', 'system', 10),
      getTopByKills('week', 'region', 10),
      getTopByKills('week', 'corporation', 10),
      getTopByKills('week', 'alliance', 10),
      getMostValuableKillsByCorporation(corporationId, 'all', 6),
    ]);

  // Get pagination parameters
  const perPage = 30;

  // Fetch paginated killmails using model function
  const [killmails, totalKillmails] = await Promise.all([
    getEntityKillmails(corporationId, 'corporation', 'all', page, perPage),
    countEntityKillmails(corporationId, 'corporation', 'all'),
  ]);

  const totalPages = Math.ceil(totalKillmails / perPage);

  // Format killmail data for template
  const recentKillmails = killmails.map((km) => {
    const normalized = normalizeKillRow(km);
    return {
      ...normalized,
      isLoss: km.victimCorporationId === corporationId,
      killmailTimeRelative: timeAgo(
        new Date(km.killmailTime ?? normalized.killmailTime)
      ),
    };
  });

  // Entity header data
  const entityData = {
    entityId: corporationId,
    entityType: 'corporation',
    name: corporationData.name,
    type: 'corporation',
    stats,
    baseUrl: `/corporation/${corporationId}`,
    entityBaseUrl: `/corporation/${corporationId}`,
    currentTab: 'dashboard',
    parent: corporationData.allianceId
      ? {
          id: corporationData.allianceId,
          name: corporationData.allianceName,
          ticker: corporationData.allianceTicker,
        }
      : null,
    grandparent: null,
  };

  // Top boxes - for corporations we show systems, regions, corporations, alliances
  const top10 = {
    characters: [],
    systems: (topSystems as any[]).map((s: any) => ({
      ...s,
      imageType: 'system',
      imageId: s.id,
      link: `/system/${s.id}`,
    })),
    regions: (topRegions as any[]).map((r: any) => ({
      ...r,
      imageType: 'region',
      imageId: r.id,
      link: `/region/${r.id}`,
    })),
    corporations: (topCorps as any[]).map((c: any) => ({
      ...c,
      imageType: 'corporation',
      imageId: c.id,
      link: `/corporation/${c.id}`,
    })),
    alliances: (topAlliances as any[]).map((a: any) => ({
      ...a,
      imageType: 'alliance',
      imageId: a.id,
      link: `/alliance/${a.id}`,
    })),
  };

  // Pagination
  const pagination = {
    currentPage: page,
    totalPages,
    pages: generatePageNumbers(page, totalPages),
    hasPrev: page > 1,
    hasNext: page < totalPages,
    prevPage: page - 1,
    nextPage: page + 1,
    showFirst: page > 3 && totalPages > 5,
    showLast: page < totalPages - 2 && totalPages > 5,
  };

  // Transform most valuable kills to template format
  const transformedMostValuable = mostValuable.map((kill) => {
    const normalized = normalizeKillRow(kill);
    return {
      ...normalized,
      totalValue: kill.totalValue ?? normalized.totalValue,
      killmailTime: normalized.killmailTime,
    };
  });

  // Render the template
  return render(
    'pages/corporation-detail',
    {
      title: `${corporationData.name} - Corporation`,
      description: `Corporation statistics for ${corporationData.name}`,
      keywords: 'eve online, corporation, killmail, pvp',
    },
    {
      ...entityData,
      top10Stats: top10,
      mostValuableKills: transformedMostValuable,
      recentKillmails,
      pagination,
    }
  );
});

// Helper function to generate page numbers
function generatePageNumbers(
  currentPage: number,
  totalPages: number
): number[] {
  const pages: number[] = [];
  const maxVisible = 5;

  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return pages;
}

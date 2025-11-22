import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { H3Event } from 'h3';
import { timeAgo } from '../../../helpers/time';
import { render, normalizeKillRow } from '../../../helpers/templates';
import { getEntityStats } from '../../../models/entityStats';
import { getCorporationWithAlliance } from '../../../models/corporations';
import {
  getEntityKillmails,
  countEntityKillmails,
} from '../../../models/killlist';

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

  // Fetch corporation basic info with alliance using model
  const corporationData = await getCorporationWithAlliance(corporationId);

  if (!corporationData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Corporation not found',
    });
  }

  // Get corporation stats
  const stats = await getEntityStats(corporationId, 'corporation', 'all');

  // Get pagination parameters
  const perPage = 30;

  // Fetch killmails where corporation was attacker (kills) using model
  const [killmailsData, totalKillmails] = await Promise.all([
    getEntityKillmails(corporationId, 'corporation', 'kills', page, perPage),
    countEntityKillmails(corporationId, 'corporation', 'kills'),
  ]);

  // Calculate pagination
  const totalPages = Math.ceil(totalKillmails / perPage);
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

  // Transform killmail data to match component expectations
  const killmails = killmailsData.map((km) => {
    const normalized = normalizeKillRow(km);
    return {
      ...normalized,
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
    baseUrl: `/corporation/${corporationId}/kills`,
    entityBaseUrl: `/corporation/${corporationId}`,
    currentTab: 'kills',
    parent: corporationData.allianceId
      ? {
          id: corporationData.allianceId,
          name: corporationData.allianceName,
          ticker: corporationData.allianceTicker,
        }
      : null,
    grandparent: null,
  };

  // Render the template
  return render(
    'pages/corporation-kills',
    {
      title: `${corporationData.name} - Kills`,
      description: `Kills by ${corporationData.name}`,
      keywords: 'eve online, corporation, killmail, kills, pvp',
    },
    {
      ...entityData,
      killmails,
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

  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return pages;
}

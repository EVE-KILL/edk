import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { H3Event } from 'h3';
import { timeAgo } from '../../../helpers/time';
import { render, normalizeKillRow } from '../../../helpers/templates';
import { getEntityStats } from '../../../models/entityStats';
import { getAlliance } from '../../../models/alliances';
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

  const { id: allianceId } = params;
  const { page } = query;

  // Fetch alliance basic info using model
  const allianceData = await getAlliance(allianceId);

  if (!allianceData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Alliance not found',
    });
  }

  // Get alliance stats
  const stats = await getEntityStats(allianceId, 'alliance');

  // Get pagination parameters
  const perPage = 30;

  // Fetch killmails and count in parallel using model functions
  const [killmailsData, totalKillmails] = await Promise.all([
    getEntityKillmails(allianceId, 'alliance', 'losses', page, perPage),
    countEntityKillmails(allianceId, 'alliance', 'losses'),
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
      isLoss: km.victimAllianceId === allianceId,
      killmailTimeRelative: timeAgo(
        new Date(km.killmailTime ?? normalized.killmailTime)
      ),
    };
  });

  // Entity header data
  const entityData = {
    entityId: allianceId,
    entityType: 'alliance',
    name: allianceData.name,
    type: 'alliance',
    stats,
    baseUrl: `/alliance/${allianceId}/losses`,
    entityBaseUrl: `/alliance/${allianceId}`,
    currentTab: 'losses',
    parent: null,
    grandparent: null,
  };

  // Render the template
  return render(
    'pages/alliance-losses',
    {
      title: `${allianceData.name} - Losses`,
      description: `Losses by ${allianceData.name}`,
      keywords: 'eve online, alliance, killmail, losses, pvp',
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

  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return pages;
}

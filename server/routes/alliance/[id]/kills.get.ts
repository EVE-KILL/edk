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
  const allianceId = Number.parseInt(getRouterParam(event, 'id') || '0');

  if (!allianceId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid alliance ID',
    });
  }

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
  const query = getQuery(event);
  const page = Math.max(1, Number.parseInt(query.page as string) || 1);
  const perPage = 30;

  // Fetch killmails where alliance was attacker (kills) using model
  const [killmailsData, totalKillmails] = await Promise.all([
    getEntityKillmails(allianceId, 'alliance', 'kills', page, perPage),
    countEntityKillmails(allianceId, 'alliance', 'kills'),
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
    entityId: allianceId,
    entityType: 'alliance',
    name: allianceData.name,
    type: 'alliance',
    stats,
    baseUrl: `/alliance/${allianceId}/kills`,
    entityBaseUrl: `/alliance/${allianceId}`,
    currentTab: 'kills',
    parent: null,
    grandparent: null,
  };

  // Render the template
  return render(
    'pages/alliance-kills',
    {
      title: `${allianceData.name} - Kills`,
      description: `Kills by ${allianceData.name}`,
      keywords: 'eve online, alliance, killmail, kills, pvp',
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

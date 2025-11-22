import type { H3Event } from 'h3';
import { timeAgo } from '../../../helpers/time';
import { render, normalizeKillRow } from '../../../helpers/templates';
import { getEntityStats } from '../../../models/entityStats';
import { getAlliance } from '../../../models/alliances';
import {
  getEntityKillmails,
  countEntityKillmails,
} from '../../../models/killlist';

import { handleError } from '../../../utils/error';

export default defineEventHandler(async (event: H3Event) => {
  try {
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
        wsFilter: {
          type: 'alliance',
          id: allianceId,
          mode: 'losses',
        },
      }
    );
  } catch (error) {
    return handleError(event, error);
  }
});

import { generatePageNumbers } from '../../../helpers/pagination';

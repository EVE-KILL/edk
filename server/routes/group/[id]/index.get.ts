/**
 * Group entity page - dashboard
 */
import type { H3Event } from 'h3';
import { render } from '../../../helpers/templates';
import { getGroup } from '../../../models/groups';
import { getCategory } from '../../../models/categories';

import { handleError } from '../../../utils/error';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const groupId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!groupId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid group ID',
      });
    }

    // Fetch group basic info
    const group = await getGroup(groupId);

    if (!group) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Group not found',
      });
    }

    // Fetch category info
    const category = await getCategory(group.categoryId);

    // Get total kills for this group (just for stats display)
    const totalKillmails = await estimateFilteredKills({ groupId });

    // Simple stats from killmail count - only show kills
    const stats = {
      kills: totalKillmails,
      losses: 0,
      iskDestroyed: 0,
      iskLost: 0,
      efficiency: 0,
      iskEfficiency: 0,
      killLossRatio: 0,
    };

    const data = {
      entityId: groupId,
      entityType: 'group',
      name: group.name,
      type: 'group',
      stats,
      group,
      category,
      baseUrl: `/group/${groupId}`,
      currentTab: 'dashboard',
    };

    const pageContext = {
      title: `${group.name} | Group`,
      description: `Killboard statistics for group ${group.name}`,
      keywords: `eve online, killboard, ${group.name}, group, ${category?.name || ''}, pvp`,
    };

    return render('pages/group.hbs', pageContext, data, event);
  } catch (error) {
    return handleError(event, error);
  }
});

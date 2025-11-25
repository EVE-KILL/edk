/**
 * Item/Type entity page - dashboard
 */
import type { H3Event } from 'h3';
import { render } from '../../../helpers/templates';
import { TypeQueries } from '../../../models/types';
import { getGroup } from '../../../models/groups';
import { getCategory } from '../../../models/categories';

import { handleError } from '../../../utils/error';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const typeId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!typeId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid item ID',
      });
    }

    // Fetch item basic info
    const item = await TypeQueries.getType(typeId);

    if (!item) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Item not found',
      });
    }

    // Fetch group and category info
    const group = await getGroup(item.groupId);
    const category = group ? await getCategory(group.categoryId) : null;

    // Get total kills for this item (just for stats display)
    const totalKillmails = await estimateFilteredKills({ typeId });

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
      entityId: typeId,
      entityType: 'item',
      name: item.name,
      type: 'item',
      stats,
      item,
      group,
      category,
      baseUrl: `/item/${typeId}`,
      currentTab: 'dashboard',
    };

    const pageContext = {
      title: `${item.name} | Item`,
      description: `Killboard statistics for ${item.name}`,
      keywords: `eve online, killboard, ${item.name}, ${group?.name || ''}, ${category?.name || ''}, pvp`,
    };

    return render('pages/item.hbs', pageContext, data, event);
  } catch (error) {
    return handleError(event, error);
  }
});

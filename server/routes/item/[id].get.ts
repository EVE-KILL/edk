import type { H3Event } from 'h3';
import { TypeQueries } from '../../models/types';
import { getGroup } from '../../models/groups';
import { getCategory } from '../../models/categories';
import { render } from '../../helpers/templates';

import { handleError } from '../../utils/error';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const id = Number(event.context.params?.id);
    if (!id || isNaN(id)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid Item ID' });
    }

    // Fetch item info
    const item = await TypeQueries.getType(id);
    if (!item) {
      throw createError({ statusCode: 404, statusMessage: 'Item not found' });
    }

    // Fetch group and category info
    const group = await getGroup(item.groupId);
    const category = group ? await getCategory(group.categoryId) : null;

    // Enhance item object
    const enhancedItem = {
      ...item,
      groupName: group?.name || 'Unknown',
      categoryName: category?.name || 'Unknown',
    };

    // Page context
    const pageContext = {
      title: `${item.name} | Item`,
      description: `Information and statistics for ${item.name}`,
      keywords: `eve online, item, ${item.name}, ${enhancedItem.groupName}`,
    };

    // TODO: Implement stats for items (losses if ship, etc)
    // For now passing empty stats or minimal
    const stats = {
      kills: 0,
      losses: 0,
      iskDestroyed: 0,
      iskLost: 0,
      efficiency: 0,
      iskEfficiency: 0,
      killLossRatio: 0,
    };

    const data = {
      item: enhancedItem,
      stats,
      top10Stats: null, // TODO: Implement top 10 for items
      baseUrl: `/item/${id}`,
    };

    return render('pages/item-detail.hbs', pageContext, data, event);
  } catch (error) {
    return handleError(event, error);
  }
});

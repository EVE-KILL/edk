import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { H3Event } from 'h3';
import { TypeQueries } from '../../models/types';
import { getGroup } from '../../models/groups';
import { getCategory } from '../../models/categories';
import { render } from '../../helpers/templates';

export default defineEventHandler(async (event: H3Event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  });

  const { id } = params;

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
});

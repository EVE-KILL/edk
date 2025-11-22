import type { H3Event } from 'h3';
import { TypeQueries } from '../../models/types';
import { getGroup } from '../../models/groups';
import { getCategory } from '../../models/categories';
import { render } from '../../helpers/templates';
import { getItemStats } from '../../models/items';
import { getTopByKills } from '../../models/topBoxes';
import { database } from '../../helpers/database';

export default defineEventHandler(async (event: H3Event) => {
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

  // Fetch stats and top 10 in parallel
  const where = database.sql`"victimShipTypeId" = ${id} OR "topAttackerShipTypeId" = ${id}`;
  const [stats, topCharacters, topCorporations, topAlliances] =
    await Promise.all([
      getItemStats(id),
      getTopByKills('week', 'character', 10, where),
      getTopByKills('week', 'corporation', 10, where),
      getTopByKills('week', 'alliance', 10, where),
    ]);

  const top10Stats = {
    characters: topCharacters.map((c) => ({
      ...c,
      imageType: 'character',
      imageId: c.id,
      link: `/character/${c.id}`,
    })),
    corporations: topCorporations.map((c) => ({
      ...c,
      imageType: 'corporation',
      imageId: c.id,
      link: `/corporation/${c.id}`,
    })),
    alliances: topAlliances.map((a) => ({
      ...a,
      imageType: 'alliance',
      imageId: a.id,
      link: `/alliance/${a.id}`,
    })),
  };

  const data = {
    item: enhancedItem,
    stats,
    top10Stats,
    baseUrl: `/item/${id}`,
  };

  return render('pages/item-detail.hbs', pageContext, data, event);
});

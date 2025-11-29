/**
 * Group entity page - dashboard
 */
import type { H3Event } from 'h3';
import { render } from '../../../helpers/templates';
import { getGroup } from '../../../models/groups';
import { getCategory } from '../../../models/categories';
import { TypeQueries } from '../../../models/types';
import { database } from '../../../helpers/database';
import { handleError } from '../../../utils/error';
import { track } from '../../../utils/performance-decorators';
import { generateBreadcrumbStructuredData } from '../../../helpers/seo';

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
    const group = await track('group:details', 'database', async () => {
      return await getGroup(groupId);
    });

    if (!group) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Group not found',
      });
    }

    // Fetch category info
    const category = await track('group:category', 'database', async () => {
      return await getCategory(group.categoryId);
    });

    // Fetch group statistics from cache or view
    const groupStats = await track('group:stats', 'database', async () => {
      // Try cache first (fast)
      const cached = await database.findOne<{
        killsAll: number;
        lossesAll: number;
        iskDestroyedAll: number;
        iskLostAll: number;
      }>(
        `SELECT "killsAll", "lossesAll", "iskDestroyedAll", "iskLostAll"
         FROM entity_stats_cache
         WHERE "entityId" = :groupId AND "entityType" = 'group'`,
        { groupId }
      );

      if (cached) {
        const kills = Number(cached.killsAll);
        const losses = Number(cached.lossesAll);
        const iskDestroyed = Number(cached.iskDestroyedAll);
        const iskLost = Number(cached.iskLostAll);

        return {
          kills,
          losses,
          iskDestroyed,
          iskLost,
          killLossRatio: losses > 0 ? kills / losses : kills,
          efficiency:
            iskDestroyed + iskLost > 0
              ? (iskDestroyed / (iskDestroyed + iskLost)) * 100
              : 0,
          iskEfficiency:
            iskDestroyed + iskLost > 0
              ? (iskDestroyed / (iskDestroyed + iskLost)) * 100
              : 0,
        };
      }

      // Fallback to view (slower but always accurate)
      const viewStats = await database.findOne<{
        kills: number;
        losses: number;
        iskDestroyed: number;
        iskLost: number;
        efficiency: number;
      }>(
        `SELECT kills, losses, "iskDestroyed", "iskLost", efficiency
         FROM group_stats
         WHERE "groupId" = :groupId`,
        { groupId }
      );

      if (viewStats) {
        return {
          kills: viewStats.kills,
          losses: viewStats.losses,
          iskDestroyed: viewStats.iskDestroyed,
          iskLost: viewStats.iskLost,
          killLossRatio:
            viewStats.losses > 0
              ? viewStats.kills / viewStats.losses
              : viewStats.kills,
          efficiency: viewStats.efficiency,
          iskEfficiency:
            viewStats.iskDestroyed + viewStats.iskLost > 0
              ? (viewStats.iskDestroyed /
                  (viewStats.iskDestroyed + viewStats.iskLost)) *
                100
              : 0,
        };
      }

      return {
        kills: 0,
        losses: 0,
        iskDestroyed: 0,
        iskLost: 0,
        killLossRatio: 0,
        efficiency: 0,
        iskEfficiency: 0,
      };
    });

    // Count total types in this group
    const totalTypes = await track(
      'group:count_types',
      'database',
      async () => {
        const result = await database.findOne<{ count: number }>(
          'SELECT COUNT(*) as count FROM types WHERE "groupId" = :groupId',
          { groupId }
        );
        return Number(result?.count || 0);
      }
    );

    // Get all types from this group (for display)
    const sampleTypes = await track(
      'group:sample_types',
      'database',
      async () => {
        return await TypeQueries.getTypesByGroup(groupId);
      }
    );

    const baseUrl = `/group/${groupId}`;

    const description = category
      ? `${group.name} - ${category.name} group statistics in EVE Online`
      : `${group.name} - Ship group statistics in EVE Online`;

    const breadcrumbs = [
      { label: 'Home', url: '/' },
      { label: 'Groups', url: '/groups' },
      ...(category
        ? [{ label: category.name, url: `/category/${category.categoryId}` }]
        : []),
      { label: group.name, url: baseUrl },
    ];

    const structuredData = generateBreadcrumbStructuredData(breadcrumbs);

    const pageHeader = {
      title: group.name,
      breadcrumbs,
    };

    // Build group properties for page header pills
    const groupProperties: Array<{ label: string; value: string | number }> =
      [];

    if (category) {
      groupProperties.push({
        label: 'Category',
        value: category.name,
      });
    }

    groupProperties.push({
      label: 'Total Types',
      value: totalTypes,
    });

    return await render(
      'pages/group',
      {
        title: `${group.name} - Ship Group`,
        description,
        url: baseUrl,
        keywords: `eve online, ${group.name}, ship group, ${category?.name || 'ships'}, pvp, killboard`,
        ogTitle: group.name,
        ogDescription: description,
        structuredData,
      },
      {
        pageHeader,
        groupProperties,
        groupId,
        name: group.name,
        groupStats,
        group,
        category,
        totalTypes,
        sampleTypes,
        baseUrl,
      },
      event
    );
  } catch (error) {
    return handleError(event, error);
  }
});

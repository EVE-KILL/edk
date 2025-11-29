/**
 * Groups listing page - Browse all ship groups
 */
import type { H3Event } from 'h3';
import { render } from '../../helpers/templates';
import { database } from '../../helpers/database';
import { handleError } from '../../utils/error';
import { track } from '../../utils/performance-decorators';
import { generateBreadcrumbStructuredData } from '../../helpers/seo';

interface GroupWithCategory {
  groupId: number;
  groupName: string;
  categoryId: number;
  categoryName: string;
  iconId: number | null;
  published: boolean;
  typeCount: number;
}

export default defineEventHandler(async (event: H3Event) => {
  try {
    // Fetch all groups with their categories and type counts
    const groups = await track('groups:list_all', 'database', async () => {
      return await database.find<GroupWithCategory>(
        `SELECT
          g."groupId",
          g.name as "groupName",
          g."categoryId",
          c.name as "categoryName",
          g."iconId",
          g.published,
          COUNT(t."typeId") as "typeCount"
         FROM groups g
         LEFT JOIN categories c ON g."categoryId" = c."categoryId"
         LEFT JOIN types t ON g."groupId" = t."groupId"
         WHERE g.published = true
         GROUP BY g."groupId", g.name, g."categoryId", c.name, g."iconId", g.published
         ORDER BY c.name, g.name`
      );
    });

    // Group by category for organized display
    const groupedByCategory = groups.reduce(
      (acc, group) => {
        if (!acc[group.categoryId]) {
          acc[group.categoryId] = {
            categoryId: group.categoryId,
            categoryName: group.categoryName,
            groups: [],
          };
        }
        acc[group.categoryId].groups.push(group);
        return acc;
      },
      {} as Record<
        number,
        {
          categoryId: number;
          categoryName: string;
          groups: GroupWithCategory[];
        }
      >
    );

    const categories = Object.values(groupedByCategory);

    const breadcrumbs = [
      { name: 'Home', url: '/' },
      { name: 'Groups', url: '/groups' },
    ];

    const structuredData = generateBreadcrumbStructuredData(breadcrumbs);

    const pageHeader = {
      title: 'Groups',
      breadcrumbs: breadcrumbs.map((b) => ({ label: b.name, url: b.url })),
      meta: [
        { type: 'text', text: `${groups.length} groups across all categories` },
      ],
    };

    return await render(
      'pages/groups',
      {
        title: 'Groups - EVE Online',
        description: 'Browse all groups in EVE Online, organized by category',
        url: '/groups',
        keywords: 'eve online, ships, ship groups, ship types, ship categories',

        structuredData,
      },
      {
        pageHeader,
        categories,
        totalGroups: groups.length,
      },
      event
    );
  } catch (error) {
    return handleError(event, error);
  }
});

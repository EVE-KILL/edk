/**
 * Category page - Show category details and groups
 */
import type { H3Event } from 'h3';
import { render } from '../../../helpers/templates';
import { getCategory } from '../../../models/categories';
import { database } from '../../../helpers/database';
import { handleError } from '../../../utils/error';
import { track } from '../../../utils/performance-decorators';
import { generateBreadcrumbStructuredData } from '../../../helpers/seo';

interface GroupInCategory {
  groupId: number;
  name: string;
  iconId: number | null;
  published: boolean;
  typeCount: number;
}

export default defineEventHandler(async (event: H3Event) => {
  try {
    const categoryId = Number.parseInt(getRouterParam(event, 'id') || '0');

    if (!categoryId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid category ID',
      });
    }

    // Fetch category info
    const category = await track('category:details', 'database', async () => {
      return await getCategory(categoryId);
    });

    if (!category) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Category not found',
      });
    }

    // Fetch groups in this category with type counts
    const groups = await track('category:groups', 'database', async () => {
      return await database.find<GroupInCategory>(
        `SELECT
          g."groupId",
          g.name,
          g."iconId",
          g.published,
          COUNT(t."typeId") as "typeCount"
         FROM groups g
         LEFT JOIN types t ON g."groupId" = t."groupId"
         WHERE g."categoryId" = :categoryId
         GROUP BY g."groupId", g.name, g."iconId", g.published
         ORDER BY g.name`,
        { categoryId }
      );
    });

    // Count total types in this category
    const totalTypes = await track(
      'category:total_types',
      'database',
      async () => {
        const result = await database.findOne<{ count: number }>(
          `SELECT COUNT(t."typeId") as count
         FROM types t
         JOIN groups g ON t."groupId" = g."groupId"
         WHERE g."categoryId" = :categoryId`,
          { categoryId }
        );
        return Number(result?.count || 0);
      }
    );

    const baseUrl = `/category/${categoryId}`;

    const breadcrumbs = [
      { name: 'Home', url: '/' },
      { name: 'Groups', url: '/groups' },
      { name: category.name, url: baseUrl },
    ];

    const structuredData = generateBreadcrumbStructuredData(breadcrumbs);

    const pageHeader = {
      title: category.name,
      breadcrumbs: breadcrumbs.map((b) => ({ label: b.name, url: b.url })),
      meta: [
        {
          type: 'text',
          text: `${groups.length} ship groups • ${totalTypes.toLocaleString()} total types`,
        },
      ],
    };

    const categoryProperties: Array<{ label: string; value: string | number }> =
      [];

    return await render(
      'pages/category',
      {
        title: `${category.name} - Ship Category`,
        description: `Browse ${category.name} ship groups in EVE Online`,
        url: baseUrl,
        keywords: `eve online, ${category.name}, ships, ship groups`,

        structuredData,
      },
      {
        pageHeader,
        categoryProperties,
        categoryId,
        category,
        groups,
        totalTypes,
        baseUrl,
      },
      event
    );
  } catch (error) {
    return handleError(event, error);
  }
});

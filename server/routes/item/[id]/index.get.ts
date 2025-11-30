/**
 * Item/Type entity page - dashboard
 */
import type { H3Event } from 'h3';
import { render } from '../../../helpers/templates';
import { TypeQueries } from '../../../models/types';
import { getGroup } from '../../../models/groups';
import { getCategory } from '../../../models/categories';
import { track } from '../../../utils/performance-decorators';
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
    const item = await track('item:get_type', 'database', async () => {
      return await TypeQueries.getType(typeId);
    });

    if (!itemDetails) {
      return renderErrorPage(
        event,
        404,
        'Item Not Found',
        `Item type #${typeId} not found in the database.`
      );
    }

    // Fetch group and category info
    const [group, category] = await track(
      'item:get_group_category',
      'database',
      async () => {
        const g = await getGroup(item.groupId);
        const c = g ? await getCategory(g.categoryId) : null;
        return [g, c];
      }
    );

    // Fetch stats from cache or view
    const itemStats = await track('item:get_stats', 'database', async () => {
      // Try cache first (fastest)
      const cached = await database.findOne<{
        killsAll: number;
        lossesAll: number;
        iskDestroyedAll: string;
        iskLostAll: string;
        soloKillsAll: number;
        soloLossesAll: number;
        npcKillsAll: number;
        npcLossesAll: number;
      }>(
        `
        SELECT
          "killsAll", "lossesAll", "iskDestroyedAll", "iskLostAll",
          "soloKillsAll", "soloLossesAll", "npcKillsAll", "npcLossesAll"
        FROM entity_stats_cache
        WHERE "entityId" = :typeId AND "entityType" = 'type'
        LIMIT 1
      `,
        { typeId }
      );

      if (cached) {
        const kills = Number(cached.killsAll || 0);
        const losses = Number(cached.lossesAll || 0);
        const iskDestroyed = Number(cached.iskDestroyedAll || 0);
        const iskLost = Number(cached.iskLostAll || 0);

        const killLossRatio = losses > 0 ? kills / losses : kills;
        const totalISK = iskDestroyed + iskLost;
        const iskEfficiency =
          totalISK > 0 ? (iskDestroyed / totalISK) * 100 : 0;
        const efficiency =
          kills + losses > 0 ? (kills / (kills + losses)) * 100 : 0;

        return {
          kills,
          losses,
          iskDestroyed,
          iskLost,
          killLossRatio,
          iskEfficiency,
          efficiency,
          soloKills: cached.soloKillsAll || 0,
          soloLosses: cached.soloLossesAll || 0,
          npcKills: cached.npcKillsAll || 0,
          npcLosses: cached.npcLossesAll || 0,
        };
      }

      // Fallback to view
      const stats = await database.findOne<{
        kills: number;
        losses: number;
        iskDestroyed: string;
        iskLost: string;
        soloKills: number;
        soloLosses: number;
        npcKills: number;
        npcLosses: number;
      }>(
        `
        SELECT
          kills, losses, "iskDestroyed", "iskLost",
          "soloKills", "soloLosses", "npcKills", "npcLosses"
        FROM type_stats
        WHERE "typeId" = :typeId
        LIMIT 1
      `,
        { typeId }
      );

      if (!stats) {
        return {
          kills: 0,
          losses: 0,
          iskDestroyed: 0n,
          iskLost: 0n,
          killLossRatio: 0,
          iskEfficiency: 0,
          efficiency: 0,
          soloKills: 0,
          soloLosses: 0,
          npcKills: 0,
          npcLosses: 0,
        };
      }

      const kills = Number(stats.kills || 0);
      const losses = Number(stats.losses || 0);
      const iskDestroyed = Number(stats.iskDestroyed || 0);
      const iskLost = Number(stats.iskLost || 0);

      const killLossRatio = losses > 0 ? kills / losses : kills;
      const totalISK = iskDestroyed + iskLost;
      const iskEfficiency = totalISK > 0 ? (iskDestroyed / totalISK) * 100 : 0;
      const efficiency =
        kills + losses > 0 ? (kills / (kills + losses)) * 100 : 0;

      return {
        kills,
        losses,
        iskDestroyed,
        iskLost,
        killLossRatio,
        iskEfficiency,
        efficiency,
        soloKills: stats.soloKills || 0,
        soloLosses: stats.soloLosses || 0,
        npcKills: stats.npcKills || 0,
        npcLosses: stats.npcLosses || 0,
      };
    });

    // Fetch dogma attributes (ship stats like HP, speed, slots, etc.)
    const dogmaAttributes = await track(
      'item:get_dogma',
      'database',
      async () => {
        const attrs = await database.query<{
          attributeId: number;
          value: number;
          name: string;
          displayName: string;
          unitId: number;
        }>(
          `
        SELECT
          td."attributeId",
          td.value,
          da.name,
          da."displayName",
          da."unitId"
        FROM typedogma td
        LEFT JOIN dogmaattributes da ON td."attributeId" = da."attributeId"
        WHERE td."typeId" = :typeId
        AND da."published" = true
        AND da."displayName" IS NOT NULL
        ORDER BY da."displayName"
      `,
          { typeId }
        );

        // Categorize attributes into logical groups
        const { categorizeDogmaAttributes } =
          await import('../../../helpers/dogma-categories');
        return categorizeDogmaAttributes(attrs);
      }
    );

    // Build breadcrumbs
    const breadcrumbs = [
      { label: 'Home', url: '/' },
      { label: 'Groups', url: '/groups' },
    ];
    if (category) {
      breadcrumbs.push({
        label: category.name,
        url: `/category/${category.categoryId}`,
      });
    }
    if (group) {
      breadcrumbs.push({
        label: group.name,
        url: `/group/${group.groupId}`,
      });
    }
    breadcrumbs.push({ label: item.name, url: null });

    // Meta array for page header
    const meta = [];
    if (group) meta.push(group.name);
    if (category) meta.push(category.name);

    // Check if this is a ship (category 6)
    const isShip = category?.categoryId === 6;

    // Fetch top 10 fittings for ships only
    let topFittings = null;
    if (isShip) {
      topFittings = await track(
        'item:get_top_fittings',
        'database',
        async () => {
          // Get killmails from the last month for this ship
          const killmails = await database.query<{
            killmailId: number;
            killmailHash: string;
            killmailTime: string;
          }>(
            `
          SELECT
            k."killmailId",
            k.hash as "killmailHash",
            k."killmailTime"
          FROM killmails k
          WHERE k."victimShipTypeId" = :typeId
          AND k."killmailTime" >= NOW() - INTERVAL '90 days'
          ORDER BY k."killmailTime" DESC
        `,
            { typeId }
          );

          if (killmails.length === 0) return [];

          // Get items for all these killmails (flags 11-34 are slot items)
          const killmailIds = killmails.map((k) => k.killmailId);
          const items = await database.query<{
            killmailId: number;
            itemTypeId: number;
            flag: number;
          }>(
            `
          SELECT
            i."killmailId",
            i."itemTypeId",
            i.flag
          FROM items i
          WHERE i."killmailId" = ANY(:killmailIds)
          AND i.flag >= 11 AND i.flag <= 34
          ORDER BY i."killmailId", i.flag
        `,
            { killmailIds }
          );

          // Get all unique item type IDs to fetch prices
          const allItemTypeIds = [
            ...new Set(items.map((i) => i.itemTypeId)),
            typeId,
          ];

          // Fetch prices for all items
          const priceData = await database.query<{
            typeId: number;
            averagePrice: number;
          }>(
            `
          SELECT DISTINCT ON ("typeId")
            "typeId",
            "averagePrice"
          FROM prices
          WHERE "typeId" = ANY(:typeIds)
          AND "regionId" = 10000002
          ORDER BY "typeId", "priceDate" DESC
        `,
            { typeIds: allItemTypeIds }
          );

          const priceByType = new Map<number, number>();
          for (const p of priceData) {
            priceByType.set(p.typeId, p.averagePrice);
          }

          // Group items by killmail
          const itemsByKillmail = new Map<number, typeof items>();
          for (const item of items) {
            if (!itemsByKillmail.has(item.killmailId)) {
              itemsByKillmail.set(item.killmailId, []);
            }
            itemsByKillmail.get(item.killmailId)!.push(item);
          }

          // Count fitting frequencies
          const fittingCounts = new Map<
            string,
            { count: number; example: any }
          >();

          for (const km of killmails) {
            const kmItems = itemsByKillmail.get(km.killmailId) || [];

            // Skip killmails with no items
            if (kmItems.length === 0) continue;

            // Create a fitting signature (sorted list of module type IDs)
            const signature = kmItems
              .map((i) => i.itemTypeId)
              .sort()
              .join(',');

            if (!fittingCounts.has(signature)) {
              // Calculate ISK value
              let totalCost = priceByType.get(typeId) || 0; // Ship hull
              for (const item of kmItems) {
                totalCost += priceByType.get(item.itemTypeId) || 0;
              }

              fittingCounts.set(signature, {
                count: 1,
                example: {
                  killmailId: km.killmailId,
                  killmailHash: km.killmailHash,
                  killmailTime: km.killmailTime,
                  items: kmItems,
                  moduleCount: kmItems.length,
                  totalCost: Math.round(totalCost),
                },
              });
            } else {
              fittingCounts.get(signature)!.count++;
            }
          }

          // Sort by frequency and take top 12
          const sortedFittings = Array.from(fittingCounts.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 12)
            .map(([_, data]) => ({
              ...data.example,
              occurrences: data.count,
            }));

          return sortedFittings;
        }
      );
    }

    // Fetch 30-day price history (from Jita - region 10000002)
    const priceHistory = await track(
      'item:get_price_history',
      'database',
      async () => {
        const prices = await database.query<{
          priceDate: string;
          averagePrice: number;
          highestPrice: number;
          lowestPrice: number;
          volume: number;
        }>(
          `
        SELECT
          "priceDate",
          "averagePrice",
          "highestPrice",
          "lowestPrice",
          volume
        FROM prices
        WHERE "typeId" = :typeId
        AND "regionId" = 10000002
        AND "priceDate" >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY "priceDate" DESC
        LIMIT 30
      `,
          { typeId }
        );
        return prices;
      }
    );

    const data = {
      entityId: typeId,
      entityType: 'item',
      name: item.name,
      type: 'item',
      stats: itemStats, // Keep for backwards compatibility
      itemStats, // New prop for item-stats component
      item,
      group,
      category,
      dogmaAttributes,
      isShip,
      topFittings,
      priceHistory,
      baseUrl: `/item/${typeId}`,
      currentTab: 'dashboard',
      breadcrumbs,
    };

    const pageContext = {
      title: `${item.name} | Item`,
      meta,
      description: `Killboard statistics for ${item.name}`,
      keywords: `eve online, killboard, ${item.name}, ${group?.name || ''}, ${category?.name || ''}, pvp`,
    };

    return render('pages/item.hbs', pageContext, data, event);
  } catch (error) {
    return handleError(event, error);
  }
});

import type { H3Event } from 'h3';
import { getQuery } from 'h3';
import { render } from '../../helpers/templates';
import { database } from '../../helpers/database';
import { handleError } from '../../utils/error';
import { track } from '../../utils/performance-decorators';
import { timeAgo } from '../../helpers/time';
import {
  generateWarsListDescription,
  generateBreadcrumbStructuredData,
} from '../../helpers/seo';
import { env } from '../../helpers/env';

const PAGE_SIZE = 25;
const factionAllianceIds = [500001, 500002, 500003, 500004]; // Caldari, Minmatar, Amarr, Gallente
const LEGENDARY_WAR_IDS = [999999999999999, 999999999999998]; // Caldari vs Gallente, Amarr vs Minmatar

export default defineCachedEventHandler(
  async (event: H3Event) => {
    try {
      const query = getQuery(event);
      const page = Math.max(1, Number.parseInt(String(query.page || '1'), 10));
      const perPage = Math.min(
        100,
        Math.max(5, Number.parseInt(String(query.limit || PAGE_SIZE), 10))
      );
      const offset = (page - 1) * perPage;

      // Parse filters
      const status = query.status as string | undefined;
      const warType = query.warType as string | undefined;
      const hasAllies = query.hasAllies as string | undefined;
      const minKills = query.minKills
        ? Number.parseInt(String(query.minKills), 10)
        : undefined;
      const minValue = query.minValue
        ? Number.parseFloat(String(query.minValue))
        : undefined;
      const factionWars =
        query.factionWars === '1' || query.factionWars === 'true';

      // Build WHERE clauses
      const whereConditions: string[] = [];

      if (status === 'active') {
        whereConditions.push('(w.finished IS NULL OR w.finished > NOW())');
      } else if (status === 'finished') {
        whereConditions.push('w.finished IS NOT NULL AND w.finished <= NOW()');
      }

      if (warType === 'mutual') {
        whereConditions.push('w.mutual = true');
      } else if (warType === 'declared') {
        whereConditions.push('w.mutual = false');
      }

      if (hasAllies === 'yes') {
        whereConditions.push('w."openForAllies" = true');
      } else if (hasAllies === 'no') {
        whereConditions.push(
          '(w."openForAllies" = false OR w."openForAllies" IS NULL)'
        );
      }

      if (factionWars) {
        whereConditions.push(`(
        w."aggressorAllianceId" IN (500001, 500002, 500003, 500004) OR
        w."defenderAllianceId" IN (500001, 500002, 500003, 500004)
      )`);
      }

      const whereClause =
        whereConditions.length > 0
          ? 'WHERE ' + whereConditions.join(' AND ')
          : '';

      // Build additional WHERE clauses for stats filtering
      const statsFilterConditions: string[] = [];
      if (minKills) {
        statsFilterConditions.push(`stats."killCount" >= ${minKills}`);
      }
      if (minValue) {
        statsFilterConditions.push(`stats."totalValue" >= ${minValue}`);
      }

      // Combine WHERE clauses properly
      const allConditions = [...whereConditions, ...statsFilterConditions];
      const combinedWhereClause =
        allConditions.length > 0 ? 'WHERE ' + allConditions.join(' AND ') : '';

      // Use materialized view for war stats
      const needsStatsFilter = minKills || minValue;

      const [allWars, totalCount] = await track(
        'wars:list',
        'database',
        async () => {
          if (needsStatsFilter) {
            // When filtering by stats, use the materialized view
            const wars = await database.query<any>(
              `SELECT w.*,
                    aa.name AS "aggressorAllianceName",
                    ac.name AS "aggressorCorporationName",
                    da.name AS "defenderAllianceName",
                    dc.name AS "defenderCorporationName",
                    COALESCE(stats."killCount", 0)::int AS "killCount",
                    COALESCE(stats."totalValue", 0)::float AS "totalValue",
                    stats."lastKill",
                    COALESCE(stats."aggressorShipsKilled", 0)::int AS "aggressorShipsKilled",
                    COALESCE(stats."defenderShipsKilled", 0)::int AS "defenderShipsKilled",
                    COALESCE(stats."aggressorIskDestroyed", 0)::float AS "aggressorIskDestroyed",
                    COALESCE(stats."defenderIskDestroyed", 0)::float AS "defenderIskDestroyed"
             FROM wars w
             LEFT JOIN alliances aa ON aa."allianceId" = w."aggressorAllianceId"
             LEFT JOIN corporations ac ON ac."corporationId" = w."aggressorCorporationId"
             LEFT JOIN alliances da ON da."allianceId" = w."defenderAllianceId"
             LEFT JOIN corporations dc ON dc."corporationId" = w."defenderCorporationId"
             LEFT JOIN war_stats stats ON stats."warId" = w."warId"
             ${combinedWhereClause}
             ORDER BY COALESCE(w.declared, w.started) DESC NULLS LAST
             LIMIT ${perPage} OFFSET ${offset}`
            );

            // Get total count with the same filters
            const [{ count }] = await database.query<{ count: number }>(
              `SELECT COUNT(*)::int AS count
             FROM wars w
             LEFT JOIN war_stats stats ON stats."warId" = w."warId"
             ${combinedWhereClause}`
            );

            return [wars, Number(count || 0)];
          } else {
            // When not filtering by stats, use simple query with pagination
            const wars = await database.query<any>(
              `SELECT w.*,
                    aa.name AS "aggressorAllianceName",
                    ac.name AS "aggressorCorporationName",
                    da.name AS "defenderAllianceName",
                    dc.name AS "defenderCorporationName"
             FROM wars w
             LEFT JOIN alliances aa ON aa."allianceId" = w."aggressorAllianceId"
             LEFT JOIN corporations ac ON ac."corporationId" = w."aggressorCorporationId"
             LEFT JOIN alliances da ON da."allianceId" = w."defenderAllianceId"
             LEFT JOIN corporations dc ON dc."corporationId" = w."defenderCorporationId"
             ${whereClause}
             ORDER BY COALESCE(w.declared, w.started) DESC NULLS LAST
             LIMIT ${perPage} OFFSET ${offset}`
            );

            const [{ count }] = await database.query<{ count: number }>(
              `SELECT COUNT(*)::int AS count FROM wars w ${whereClause}`
            );

            return [wars, Number(count || 0)];
          }
        }
      );

      // Fetch stats for wars if not already included
      let paginatedWars: any[];

      if (needsStatsFilter) {
        // Stats already included in query, just format times
        paginatedWars = allWars.map((w: any) => ({
          ...w,
          lastKill: w.lastKill ? timeAgo(w.lastKill) : null,
          declared: w.declared
            ? timeAgo(w.declared)
            : w.started
              ? timeAgo(w.started)
              : null,
        }));
      } else {
        // Fetch stats from materialized view for just the current page
        const warIds = allWars.map((w: any) => Number(w.warId));
        const statsMap =
          warIds.length === 0
            ? new Map<number, any>()
            : await track('wars:stats_from_mv', 'database', async () => {
                const rows = await database.query<any>(
                  `SELECT "warId",
                        "killCount",
                        "totalValue",
                        "lastKill",
                        "aggressorShipsKilled",
                        "defenderShipsKilled",
                        "aggressorIskDestroyed",
                        "defenderIskDestroyed"
                 FROM war_stats
                 WHERE "warId" = ANY(:warIds)`,
                  { warIds }
                );
                return new Map(rows.map((r) => [r.warId, r]));
              });

        paginatedWars = allWars.map((w: any) => {
          const stats = statsMap.get(Number(w.warId));
          return {
            ...w,
            killCount: stats?.killCount ?? 0,
            totalValue: stats?.totalValue ?? 0,
            lastKill: stats?.lastKill ? timeAgo(stats.lastKill) : null,
            declared: w.declared
              ? timeAgo(w.declared)
              : w.started
                ? timeAgo(w.started)
                : null,
            aggressorShipsKilled: stats?.aggressorShipsKilled ?? 0,
            defenderShipsKilled: stats?.defenderShipsKilled ?? 0,
            aggressorIskDestroyed: stats?.aggressorIskDestroyed ?? 0,
            defenderIskDestroyed: stats?.defenderIskDestroyed ?? 0,
          };
        });
      }

      const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

      // Fetch legendary faction wars separately for hero display
      // These use pre-aggregated stats from the materialized view
      const legendaryWars = await track(
        'wars:legendary',
        'database',
        async () => {
          const wars = await database.query<any>(
            `SELECT w.*,
                  af.name AS "aggressorAllianceName",
                  df.name AS "defenderAllianceName",
                  COALESCE(stats."killCount", 0)::int AS "killCount",
                  COALESCE(stats."totalValue", 0)::float AS "totalValue",
                  stats."lastKill",
                  COALESCE(stats."factionAggressorShipsKilled", 0)::int AS "aggressorShipsKilled",
                  COALESCE(stats."factionDefenderShipsKilled", 0)::int AS "defenderShipsKilled",
                  COALESCE(stats."factionAggressorIskDestroyed", 0)::float AS "aggressorIskDestroyed",
                  COALESCE(stats."factionDefenderIskDestroyed", 0)::float AS "defenderIskDestroyed"
           FROM wars w
           LEFT JOIN factions af ON af."factionId" = w."aggressorAllianceId"
           LEFT JOIN factions df ON df."factionId" = w."defenderAllianceId"
           LEFT JOIN war_stats stats ON stats."warId" = w."warId"
           WHERE w."warId" = ANY(:warIds)
           ORDER BY w."warId" DESC`,
            { warIds: LEGENDARY_WAR_IDS }
          );

          return wars.map((w: any) => ({
            ...w,
            lastKill: w.lastKill ? timeAgo(w.lastKill) : null,
            declared: w.declared ? timeAgo(w.declared) : null,
            // Calculate years of conflict
            yearsOfConflict: w.started
              ? Math.floor(
                  (Date.now() - new Date(w.started).getTime()) /
                    (1000 * 60 * 60 * 24 * 365)
                )
              : 0,
          }));
        }
      );

      // Filter out legendary wars from the main list and find other faction wars to highlight
      const filteredWars = paginatedWars.filter((w: any) => {
        return !LEGENDARY_WAR_IDS.includes(Number(w.warId));
      });

      const highlightWars = filteredWars.filter((w: any) => {
        const a = Number(w.aggressorAllianceId);
        const d = Number(w.defenderAllianceId);
        return factionAllianceIds.includes(a) || factionAllianceIds.includes(d);
      });

      // SEO metadata
      const activeWars = await database.sql<{ count: number }[]>`
      SELECT COUNT(*)::int as count
      FROM wars
      WHERE finished IS NULL OR finished > NOW()
    `.then((rows) => rows[0]?.count ?? 0);

      const description = generateWarsListDescription({
        totalWars: totalCount,
        activeWars,
      });

      const breadcrumbs = [
        { name: 'Home', url: '/' },
        { name: 'Wars', url: '/wars' },
      ];

      const structuredData = generateBreadcrumbStructuredData(breadcrumbs);

      const pageContext = {
        title: `EVE Online Wars - ${totalCount.toLocaleString()} Wars Tracked`,
        description,
        url: '/wars',
        keywords:
          'eve online, wars, warfare, war declarations, corporation wars, alliance wars, killboard, pvp, combat statistics',
        ogTitle: `EVE Online Wars - ${activeWars.toLocaleString()} Active Wars`,
        ogDescription: description,
        structuredData,
      };

      const data = {
        pageHeader: {
          breadcrumbs: [
            { label: 'Home', url: '/' },
            { label: 'Wars', url: '/wars' },
          ],
          meta: [
            { type: 'pill', text: `${activeWars.toLocaleString()} Active` },
            { type: 'text', text: `Page ${page} of ${totalPages}` },
          ],
        },
        pagination: {
          page,
          perPage,
          totalPages,
          total: totalCount,
          prevPage: page > 1 ? page - 1 : null,
          nextPage: page < totalPages ? page + 1 : null,
        },
        legendaryWars,
        highlightWars,
        wars: filteredWars,
        filterDefaults: {
          status,
          warType,
          hasAllies,
          minKills,
          minValue,
          factionWars,
        },
      };

      return await render('pages/wars.hbs', pageContext, data, event);
    } catch (error: any) {
      return handleError(event, error);
    }
  },
  {
    maxAge: 300,
    staleMaxAge: -1,
    base: 'redis',
    shouldBypassCache: () => env.NODE_ENV !== 'production',
  }
);

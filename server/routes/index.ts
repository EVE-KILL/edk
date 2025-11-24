import type { H3Event } from 'h3';
import {
  getFilteredKillsWithNames,
  countFilteredKills,
} from '../models/killlist';
import { getTopByKills } from '../models/topBoxes';
import { getMostValuableKillsByPeriod } from '../models/mostValuableKills';
import { normalizeKillRow } from '../helpers/templates';
import { handleError } from '../utils/error';
import { track } from '../utils/performance-decorators';
import { timeAgo } from '../helpers/time';

export default defineEventHandler(async (event: H3Event) => {
  try {
    // Page context
    const pageContext = {
      title: 'Home',
      description:
        'Welcome to EVE-KILL - Real-time killmail tracking and analytics',
      keywords: 'eve online, killmail, pvp, tracking',
    };

    // Get pagination parameters
    const query = getQuery(event);
    const page = Math.max(1, Number.parseInt(query.page as string) || 1);
    const perPage = 30;

    // Fetch recent killmails with names, count, and top 10 stats in parallel
    const [
      killmailsData,
      totalKillmails,
      topCharacters,
      topCorporations,
      topAlliances,
      topSystems,
      topRegions,
    ] = await track('frontpage:parallel_queries', 'application', async () => {
      return await Promise.all([
        getFilteredKillsWithNames({}, page, perPage),
        countFilteredKills({}),
        getTopByKills('week', 'character', 10),
        getTopByKills('week', 'corporation', 10),
        getTopByKills('week', 'alliance', 10),
        getTopByKills('week', 'system', 10),
        getTopByKills('week', 'region', 10),
      ]);
    });

    // Transform top10 stats to add imageType and link properties
    const { totalPages, top10 } = await track('frontpage:transform_top10', 'application', async () => {
      const totalPages = Math.ceil(totalKillmails / perPage);

      const top10 = {
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
        systems: topSystems.map((s) => ({
          ...s,
          imageType: 'system',
          imageId: s.id,
          link: `/system/${s.id}`,
        })),
        regions: topRegions.map((r) => ({
          ...r,
          imageType: 'region',
          imageId: r.id,
          link: `/region/${r.id}`,
        })),
      };

      return { totalPages, top10 };
    });

    // Fetch most valuable kills (7-day, top 6)
    const mostValuableKillsData = await track('frontpage:fetch_most_valuable', 'application', async () => {
      return await getMostValuableKillsByPeriod('week', 6);
    });

    // Normalize killmail data to a consistent template-friendly shape
    const killmails = await track('frontpage:normalize_killmails', 'application', async () => {
      return killmailsData.map((km: any) => {
        const normalized = normalizeKillRow(km);
        const killmailDate =
          km.killmailTime ?? km.killmail_time ?? normalized.killmailTime;
        return {
          ...normalized,
          killmailTimeRelative: timeAgo(killmailDate),
        };
      });
    });

    // Transform most valuable kills
    const mostValuableKills = await track('frontpage:transform_most_valuable', 'application', async () => {
      return mostValuableKillsData.map((mvk) => {
        const normalized = normalizeKillRow(mvk);
        return {
          ...normalized,
          totalValue: mvk.totalValue ?? normalized.totalValue,
          killmailTime: mvk.killmailTime ?? normalized.killmailTime,
        };
      });
    });

    // Data for the home page
    const data = await track('frontpage:build_data', 'application', async () => {
      return {
        // Real Most Valuable Kills from database (last 7 days)
        mostValuableKills,

        // Real top 10 stats from database (last 7 days)
        top10Stats: top10,
        
        // Top box titles for front page
        characterTitle: 'Top Characters',
        corporationTitle: 'Top Corporations',
        allianceTitle: 'Top Alliances',
        shipTitle: 'Top Ships',
        systemTitle: 'Top Systems',
        regionTitle: 'Top Regions',
        timeRange: 'Last 7 Days',

        // Real killmail data from database
        killmails,

        // Real pagination based on actual killmail count
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalKillmails: totalKillmails,
          perPage: perPage,
          pages: generatePageNumbers(page, totalPages),
          hasPrev: page > 1,
          hasNext: page < totalPages,
          prevPage: page - 1,
          nextPage: page + 1,
          showFirst: page > 3 && totalPages > 5,
          showLast: page < totalPages - 2 && totalPages > 5,
        },
        baseUrl: '/',
      };
    });

    // Render template using the new layout system
    const result = await render('pages/home.hbs', pageContext, data, event);

    return result;
  } catch (error) {
    return handleError(event, error);
  }
});

import { generatePageNumbers } from '../helpers/pagination';

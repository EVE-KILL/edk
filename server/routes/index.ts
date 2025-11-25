import type { H3Event } from 'h3';
import {
  getFilteredKillsWithNames,
  estimateFilteredKills,
} from '../models/killlist';
import { parseKilllistFilters } from '../helpers/killlist-filters';
import { getTopByKills } from '../models/topBoxes';
import { getMostValuableKillsByPeriod } from '../models/mostValuableKills';
import { normalizeKillRow } from '../helpers/templates';
import { handleError } from '../utils/error';
import { track } from '../utils/performance-decorators';
import { timeAgo } from '../helpers/time';
import {
  generateWebsiteStructuredData,
  generateOrganizationStructuredData,
} from '../helpers/seo';

export default defineEventHandler(async (event: H3Event) => {
  try {
    // Generate structured data for homepage
    const websiteStructuredData = generateWebsiteStructuredData();
    const organizationStructuredData = generateOrganizationStructuredData();

    // Combine both structured data schemas
    const combinedStructuredData = `[${websiteStructuredData},${organizationStructuredData}]`;

    // Page context
    const pageContext = {
      title: 'Home',
      description:
        'Real-time EVE Online killmail tracking and analytics. View the latest killmails, ship losses, and combat statistics from New Eden.',
      keywords:
        'eve online, killmail, killboard, pvp, zkillboard, ship losses, combat tracker, eve kill, zkill alternative',
      url: '/',
      type: 'website',
      structuredData: combinedStructuredData,
    };

    // Get pagination parameters
    const query = getQuery(event);
    const page = Math.max(1, Number.parseInt(query.page as string) || 1);
    const {
      filters: userFilters,
      filterQueryString,
      securityStatus,
      techLevel,
      shipClass,
    } = parseKilllistFilters(query);
    const perPage = Math.min(
      100,
      Math.max(5, Number.parseInt(query.limit as string) || 25)
    );

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
        getFilteredKillsWithNames(userFilters, page, perPage),
        estimateFilteredKills(userFilters),
        getTopByKills('week', 'character', 10),
        getTopByKills('week', 'corporation', 10),
        getTopByKills('week', 'alliance', 10),
        getTopByKills('week', 'system', 10),
        getTopByKills('week', 'region', 10),
      ]);
    });

    // Transform top10 stats to add imageType and link properties
    const { totalPages, top10 } = await track(
      'frontpage:transform_top10',
      'application',
      async () => {
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
      }
    );

    // Fetch most valuable kills (7-day, top 6) - all three variants
    const [
      mostValuableKillsData,
      mostValuableShipsData,
      mostValuableStructuresData,
    ] = await track(
      'frontpage:fetch_most_valuable',
      'application',
      async () => {
        return await Promise.all([
          getMostValuableKillsByPeriod('week', 6),
          getMostValuableKillsByPeriod('week', 6, { excludeStructures: true }),
          getMostValuableKillsByPeriod('week', 6, { structuresOnly: true }),
        ]);
      }
    );

    // Normalize killmail data to a consistent template-friendly shape
    const killmails = await track(
      'frontpage:normalize_killmails',
      'application',
      async () => {
        return killmailsData.map((km: any) => {
          const normalized = normalizeKillRow(km);
          const killmailDate =
            km.killmailTime ?? km.killmail_time ?? normalized.killmailTime;
          return {
            ...normalized,
            killmailTimeRelative: timeAgo(killmailDate),
          };
        });
      }
    );

    // Transform most valuable kills (all three variants)
    const [mostValuableKills, mostValuableShips, mostValuableStructures] =
      await track(
        'frontpage:transform_most_valuable',
        'application',
        async () => {
          const transformData = (data: any[]) =>
            data.map((mvk) => {
              const normalized = normalizeKillRow(mvk);
              return {
                ...normalized,
                totalValue: mvk.totalValue ?? normalized.totalValue,
                killmailTime: mvk.killmailTime ?? normalized.killmailTime,
              };
            });

          return [
            transformData(mostValuableKillsData),
            transformData(mostValuableShipsData),
            transformData(mostValuableStructuresData),
          ];
        }
      );

    // Data for the home page
    const data = await track(
      'frontpage:build_data',
      'application',
      async () => {
        return {
          // Real Most Valuable Kills from database (last 7 days) - all three variants
          mostValuableKills,
          mostValuableShips,
          mostValuableStructures,

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
            limit: perPage,
            pages: generatePageNumbers(page, totalPages),
            hasPrev: page > 1,
            hasNext: page < totalPages,
            prevPage: page - 1,
            nextPage: page + 1,
            showFirst: page > 3 && totalPages > 5,
            showLast: page < totalPages - 2 && totalPages > 5,
          },
          baseUrl: '/',
          filterQueryString,
          filterDefaults: {
            ...userFilters,
            securityStatus,
            shipClass,
            techLevel,
            noCapsules: userFilters.noCapsules || false,
          },
        };
      }
    );

    // Render template using the new layout system
    const result = await render('pages/home.hbs', pageContext, data, event);

    return result;
  } catch (error) {
    return handleError(event, error);
  }
});

import { generatePageNumbers } from '../helpers/pagination';

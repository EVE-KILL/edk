import type { H3Event } from 'h3';
import { getSolarSystem, getSystemStats } from '../../models/solarSystems';
import { getRegion } from '../../models/regions';
import {
  getFilteredKillsWithNames,
  countFilteredKills,
} from '../../models/killlist';
import { getTopByKills } from '../../models/topBoxes';
import { normalizeKillRow, render } from '../../helpers/templates';

import { handleError } from '../../utils/error';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const id = Number(event.context.params?.id);
    if (!id || isNaN(id)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid System ID',
      });
    }

    // Fetch system info
    const system = await getSolarSystem(id);
    if (!system) {
      throw createError({ statusCode: 404, statusMessage: 'System not found' });
    }

    // Fetch region info
    const region = await getRegion(system.regionId);

    // Page context
    const pageContext = {
      title: `${system.name} | System`,
      description: `Killboard statistics and activity for solar system ${system.name}`,
      keywords: `eve online, killboard, ${system.name}, system, pvp`,
    };

    // Get pagination parameters
    const query = getQuery(event);
    const page = Math.max(1, Number.parseInt(query.page as string) || 1);
    const perPage = 50;

    // Fetch stats and killmails in parallel
    const [
      stats,
      killmailsData,
      totalKillmails,
      topCharacters,
      topCorporations,
      topAlliances,
    ] = await Promise.all([
      getSystemStats(id),
      getFilteredKillsWithNames({ solarSystemId: id }, page, perPage),
      countFilteredKills({ solarSystemId: id }),
      getTopByKills('week', 'character', 10), // TODO: these are global top 10, not system specific. System specific top 10 needs implementation.
      getTopByKills('week', 'corporation', 10),
      getTopByKills('week', 'alliance', 10),
    ]);

    const totalPages = Math.ceil(totalKillmails / perPage);

    // Normalize killmail data
    const killmails = killmailsData.map(normalizeKillRow);

    // Prepare top 10 stats (using global for now as placeholder, but ideally should be filtered by system)
    // The original template showed "Top 10 Sidebar".
    // The `components/top-10-stats` component expects `stats` object with characters, corporations, alliances etc.

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
      system,
      region,
      stats,
      killmails,
      top10Stats,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalKillmails: totalKillmails,
        perPage: perPage,
        hasPrev: page > 1,
        hasNext: page < totalPages,
        prevPage: page - 1,
        nextPage: page + 1,
      },
      baseUrl: `/system/${id}`,
    };

    return render('pages/system-detail.hbs', pageContext, data, event);
  } catch (error) {
    return handleError(event, error);
  }
});

import type { H3Event } from 'h3';
import { render, normalizeKillRow } from '../helpers/templates';
import {
  getFollowedEntitiesActivity,
  countFollowedEntitiesActivity,
} from '../models/killlist';
import { handleError } from '../utils/error';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const pageContext = {
      title: 'Entities Dashboard | EVE-KILL',
      description: 'Dashboard for followed entities',
      keywords: 'eve online, dashboard, tracking',
    };

    const charIds =
      process.env.FOLLOWED_CHARACTER_IDS?.split(',')
        .map(Number)
        .filter((n) => !isNaN(n) && n > 0) || [];
    const corpIds =
      process.env.FOLLOWED_CORPORATION_IDS?.split(',')
        .map(Number)
        .filter((n) => !isNaN(n) && n > 0) || [];
    const allyIds =
      process.env.FOLLOWED_ALLIANCE_IDS?.split(',')
        .map(Number)
        .filter((n) => !isNaN(n) && n > 0) || [];

    const hasEntities =
      charIds.length > 0 || corpIds.length > 0 || allyIds.length > 0;

    // Get pagination parameters
    const query = getQuery(event);
    const page = Math.max(1, Number.parseInt(query.page as string) || 1);
    const perPage = 30;

    let recentKillmails: any[] = [];

    if (hasEntities) {
      const [killmailsData] = await Promise.all([
        getFollowedEntitiesActivity(charIds, corpIds, allyIds, page, perPage),
        countFollowedEntitiesActivity(charIds, corpIds, allyIds),
      ]);
      recentKillmails = killmailsData.map(normalizeKillRow);
    }

    const data = {
      hasEntities,
      recentKillmails,
      // ... other stats left empty for now
      shipGroupStats: null,
      mostValuableKills: null,
      top10Stats: null,
      entityBaseUrl: '/entities',
      currentTab: 'dashboard',
    };

    return render('pages/entities.hbs', pageContext, data, event);
  } catch (error) {
    return handleError(event, error);
  }
});

import type { H3Event } from 'h3';
import { render } from '../helpers/templates';
import { handleError } from '../utils/error';
import { getFollowedEntities } from '../helpers/env';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const pageContext = {
      title: 'Statistics | EVE-KILL',
      description: 'View statistics for tracked entities',
      keywords: 'eve online, statistics, tracking',
    };

    const {
      characters: charIds,
      corporations: corpIds,
      alliances: allyIds,
    } = getFollowedEntities();

    const hasEntities =
      charIds.length > 0 || corpIds.length > 0 || allyIds.length > 0;

    const followedEntities = {
      hasEntities,
      characters: charIds,
      corporations: corpIds,
      alliances: allyIds,
    };

    const data = {
      followedEntities,
    };

    return render('pages/statistics.hbs', pageContext, data, event);
  } catch (error) {
    return handleError(event, error);
  }
});

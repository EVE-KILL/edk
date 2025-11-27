import type { H3Event } from 'h3';
import { render } from '../../helpers/templates';
import { handleError } from '../../utils/error';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const pageContext = {
      title: 'Advanced Search',
      description: 'Advanced search for EVE-KILL.',
    };

    const data = {
      pageHeader: {
        title: 'Advanced Search',
        breadcrumbs: [
          { label: 'Home', url: '/' },
          { label: 'Advanced Search', url: '/filter' },
        ],
      },
    };

    return render('pages/filter.hbs', pageContext, data, event);
  } catch (error) {
    return handleError(event, error);
  }
});

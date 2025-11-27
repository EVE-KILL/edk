import type { H3Event } from 'h3';
import { getDocsIndex } from '../../helpers/docs';
import { render } from '../../helpers/templates';
import { handleError } from '../../utils/error';
import { track } from '../../utils/performance-decorators';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const docsIndex = await track('docs:load_index', 'application', () =>
      getDocsIndex()
    );

    const pageContext = {
      title: 'Documentation',
      description: 'Documentation for EVE-KILL.',
      activeNav: 'docs',
    };

    const data = {
      navSections: docsIndex.sections,
      pageHeader: {
        title: 'Documentation',
        breadcrumbs: [
          { label: 'Home', url: '/' },
          { label: 'Documentation', url: '/docs' },
        ],
      },
    };

    return render('pages/docs-index.hbs', pageContext, data, event);
  } catch (error) {
    return handleError(event, error);
  }
});

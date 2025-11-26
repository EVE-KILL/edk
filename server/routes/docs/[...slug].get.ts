import type { H3Event } from 'h3';
import { createError, getRouterParams } from 'h3';
import { getDocsIndex, getDocPage } from '../../helpers/docs';
import { render } from '../../helpers/templates';
import { handleError } from '../../utils/error';
import { track } from '../../utils/performance-decorators';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const params = getRouterParams(event);
    const slugParam = params?.slug;
    const slug =
      Array.isArray(slugParam) && slugParam.length > 0
        ? slugParam.join('/')
        : typeof slugParam === 'string' && slugParam.length > 0
          ? slugParam
          : undefined;

    if (!slug) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Document not found',
      });
    }

    const docsIndex = await track('docs:load_index', 'application', () =>
      getDocsIndex()
    );

    const docPage = await track('docs:load_doc', 'application', () =>
      getDocPage(slug, docsIndex)
    );

    const breadcrumbs = slug.split('/').map((part, index, parts) => ({
      label: part.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      url: `/docs/${parts.slice(0, index + 1).join('/')}`,
    }));

    const pageContext = {
      title: `${docPage.title} - Documentation`,
      description: `Documentation for ${docPage.title}`,
      activeNav: 'docs',
    };

    const data = {
      navSections: docsIndex.sections,
      currentDoc: {
        ...docPage,
        breadcrumbs,
      },
      pageHeader: {
        breadcrumbs,
        meta: [
          { type: 'pill', text: docPage.section },
          {
            type: 'text',
            text: `Updated ${new Date(docPage.updatedAt).toLocaleDateString()}`,
          },
        ],
      },
    };

    return render('pages/docs.hbs', pageContext, data, event);
  } catch (error) {
    return handleError(event, error);
  }
});

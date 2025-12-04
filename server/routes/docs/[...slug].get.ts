import type { H3Event } from 'h3';
import { getRouterParams } from 'h3';
import { getDocsIndex, getDocPage } from '../../helpers/docs';
import { render } from '../../helpers/templates';
import { handleError } from '../../utils/error';
import { track } from '../../utils/performance-decorators';
import { env } from '../../helpers/env';

export default defineCachedEventHandler(
  async (event: H3Event) => {
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
        return sendRedirect(event, '/docs', 302);
      }

      // Strip .md extension if present in URL
      const cleanSlug = slug.endsWith('.md') ? slug.slice(0, -3) : slug;

      // If the slug had .md extension, redirect to clean URL
      if (slug !== cleanSlug) {
        return sendRedirect(event, `/docs/${cleanSlug}`, 301);
      }

      const docsIndex = await track('docs:load_index', 'application', () =>
        getDocsIndex()
      );

      const docPage = await track('docs:load_doc', 'application', () =>
        getDocPage(cleanSlug, docsIndex)
      );

      // If the requested slug doesn't match the actual doc slug (e.g., directory path),
      // redirect to the actual document URL
      if (docPage.slug !== cleanSlug) {
        return sendRedirect(event, `/docs/${docPage.slug}`, 302);
      }

      const breadcrumbs = cleanSlug.split('/').map((part, index, parts) => ({
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
  },
  {
    maxAge: 3600,
    staleMaxAge: 7200,
    base: 'redis',
    shouldBypassCache: () => env.NODE_ENV !== 'production',
  }
);

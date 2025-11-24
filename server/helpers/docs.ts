import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { createError } from 'h3';
import MarkdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import hljs from 'highlight.js';
import sanitizeHtml from 'sanitize-html';

interface DocFileMeta {
  slug: string;
  sectionKey: string;
  sectionTitle: string;
  title: string;
  updatedAt: string;
  relativePath: string;
}

export interface DocHeading {
  id: string;
  text: string;
  level: number;
}

export interface DocNavItem {
  slug: string;
  title: string;
  section: string;
  updatedAt: string;
}

export interface DocSection {
  key: string;
  title: string;
  items: DocNavItem[];
}

export interface DocsIndex {
  sections: DocSection[];
  flat: DocNavItem[];
  defaultSlug?: string;
}

export interface DocPage {
  slug: string;
  title: string;
  contentHtml: string;
  headings: DocHeading[];
  updatedAt: string;
  section: string;
  relativePath: string;
}

const DOCS_DIR = resolve(process.cwd(), 'docs');

function formatTitleFromSlug(segment: string) {
  return segment
    .replace(/\.md$/, '')
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function extractTitle(content: string, fallback: string) {
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch?.[1]) {
    return headingMatch[1].trim();
  }
  return fallback;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

async function walkDocsDirectory(dir: string): Promise<DocFileMeta[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: DocFileMeta[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkDocsDirectory(fullPath);
      files.push(...nested);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      const relativePath = fullPath.replace(`${DOCS_DIR}${sep}`, '');
      const slug = relativePath.replace(/\.md$/, '').split(sep).join('/');
      const segments = slug.split('/');
      const sectionKey = segments.length > 1 ? segments[0] : 'general';
      const sectionTitle =
        sectionKey === 'general' ? 'General' : formatTitleFromSlug(sectionKey);

      const content = await readFile(fullPath, 'utf-8');
      const title = extractTitle(content, formatTitleFromSlug(entry.name));
      const fileStats = await stat(fullPath);

      files.push({
        slug,
        sectionKey,
        sectionTitle,
        title,
        updatedAt: fileStats.mtime.toISOString(),
        relativePath,
      });
    }
  }

  return files;
}

function buildSections(files: DocFileMeta[]): DocsIndex {
  const sectionsMap = new Map<string, DocSection>();

  for (const file of files) {
    if (!sectionsMap.has(file.sectionKey)) {
      sectionsMap.set(file.sectionKey, {
        key: file.sectionKey,
        title: file.sectionTitle,
        items: [],
      });
    }

    const section = sectionsMap.get(file.sectionKey);
    if (!section) continue;

    section.items.push({
      slug: file.slug,
      title: file.title,
      section: file.sectionTitle,
      updatedAt: file.updatedAt,
    });
  }

  const sections = Array.from(sectionsMap.values())
    .map((section) => ({
      ...section,
      items: section.items.sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const flat = sections.flatMap((section) => section.items);

  return {
    sections,
    flat,
    defaultSlug: flat[0]?.slug,
  };
}

function sanitizeMarkdownHtml(html: string): string {
  const allowedTags = sanitizeHtml.defaults.allowedTags.concat([
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'img',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'pre',
    'code',
    'blockquote',
    'hr',
    'span',
  ]);

  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel', 'class', 'aria-hidden'],
      img: ['src', 'alt', 'title', 'width', 'height', 'class'],
      code: ['class'],
      span: ['class'],
      th: ['colspan', 'rowspan', 'class'],
      td: ['colspan', 'rowspan', 'class'],
      '*': ['id', 'class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform(
        'a',
        { rel: 'noopener noreferrer' },
        true
      ),
    },
  });
}

function createMarkdownRenderer(headings: DocHeading[]) {
  return new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true,
    highlight(code, language) {
      if (language && hljs.getLanguage(language)) {
        try {
          const highlighted = hljs.highlight(code, {
            language,
            ignoreIllegals: true,
          }).value;
          return `<pre class="hljs"><code class="hljs language-${language}">${highlighted}</code></pre>`;
        } catch {
          // fall through to escaped block
        }
      }
      const escaped = MarkdownIt().utils.escapeHtml(code);
      return `<pre class="hljs"><code class="hljs">${escaped}</code></pre>`;
    },
  }).use(markdownItAnchor, {
    slugify,
    permalink: markdownItAnchor.permalink.linkInsideHeader({
      symbol: '#',
      placement: 'before',
      class: 'docs-anchor',
    }),
    callback: (token, info) => {
      const level = Number(token.tag?.replace('h', '')) || 1;
      headings.push({
        id: info.slug,
        text: token.content,
        level,
      });
    },
  });
}

export async function getDocsIndex(): Promise<DocsIndex> {
  let files: DocFileMeta[];
  try {
    files = await walkDocsDirectory(DOCS_DIR);
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Documentation not found',
      });
    }
    throw error;
  }

  if (!files.length) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Documentation not found',
    });
  }

  return buildSections(files);
}

export async function getDocPage(
  slug?: string,
  index?: DocsIndex
): Promise<DocPage> {
  const docsIndex = index || (await getDocsIndex());
  const targetSlug = slug || docsIndex.defaultSlug;

  if (!targetSlug) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Documentation not found',
    });
  }

  const matchingNav = docsIndex.flat.find((item) => item.slug === targetSlug);
  if (!matchingNav) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Document not found',
    });
  }

  const fullPath = resolve(DOCS_DIR, `${targetSlug}.md`);
  if (!fullPath.startsWith(DOCS_DIR)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid documentation path',
    });
  }

  let content: string;
  try {
    content = await readFile(fullPath, 'utf-8');
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Document not found',
      });
    }
    throw error;
  }
  const headings: DocHeading[] = [];
  const renderer = createMarkdownRenderer(headings);
  const renderedHtml = renderer.render(content);
  const safeHtml = sanitizeMarkdownHtml(renderedHtml);

  return {
    slug: targetSlug,
    title: matchingNav.title,
    contentHtml: safeHtml,
    headings,
    updatedAt: matchingNav.updatedAt,
    section: matchingNav.section,
    relativePath: matchingNav.slug,
  };
}

/**
 * Page Header Helpers
 *
 * Utility functions for generating consistent page headers across the site
 */

export interface Breadcrumb {
  label: string;
  url: string;
}

export interface MetaItem {
  type: 'pill' | 'text' | 'button' | 'custom';
  text?: string;
  html?: string;
  class?: string;
  action?: string;
}

export interface PageHeaderData {
  eyebrow?: string;
  title: string;
  breadcrumbs?: Breadcrumb[];
  meta?: MetaItem[];
}

export interface PageHeaderLightData {
  title: string;
  breadcrumbs?: Breadcrumb[];
  info?: Array<{
    icon?: string;
    text: string;
  }>;
}

/**
 * Generate breadcrumbs for common page types
 */
export function generateBreadcrumbs(path: string[]): Breadcrumb[] {
  const breadcrumbs: Breadcrumb[] = [{ label: 'Home', url: '/' }];

  let currentPath = '';
  for (const segment of path) {
    currentPath += `/${segment.toLowerCase()}`;
    breadcrumbs.push({
      label: segment,
      url: currentPath,
    });
  }

  return breadcrumbs;
}

/**
 * Generate EVE Time info for lightweight headers
 */
export function getEveTimeInfo(): { icon: string; text: string } {
  const now = new Date();
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');

  return {
    icon: '🕐',
    text: `EVE Time: ${hours}:${minutes}`,
  };
}

/**
 * Create a standard docs-style page header
 */
export function createDocsHeader(
  eyebrow: string,
  title: string,
  breadcrumbs: Breadcrumb[],
  meta?: MetaItem[]
): PageHeaderData {
  return {
    eyebrow,
    title,
    breadcrumbs,
    meta,
  };
}

/**
 * Create a lightweight page header for entity/home pages
 */
export function createLightHeader(
  title: string,
  breadcrumbs: Breadcrumb[],
  info?: Array<{ icon?: string; text: string }>
): PageHeaderLightData {
  return {
    title,
    breadcrumbs,
    info,
  };
}

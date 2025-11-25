/**
 * SEO Helper - Generate structured data and meta tags for pages
 */

import { env } from './env';

/**
 * Generate JSON-LD structured data for a killmail
 */
export function generateKillmailStructuredData(params: {
  killmailId: number;
  victimName: string;
  shipName: string;
  totalValue: number;
  killmailTime: string;
  solarSystemName: string;
  regionName: string;
  attackerCount: number;
}): string {
  const {
    killmailId,
    victimName,
    shipName,
    totalValue,
    killmailTime,
    solarSystemName,
    regionName,
    attackerCount,
  } = params;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${victimName} lost ${shipName} in ${solarSystemName}`,
    description: `${victimName} lost a ${shipName} worth ${(totalValue / 1_000_000_000).toFixed(2)}B ISK in ${solarSystemName}, ${regionName}. Killmail involved ${attackerCount} ${attackerCount === 1 ? 'attacker' : 'attackers'}.`,
    datePublished: killmailTime,
    author: {
      '@type': 'Organization',
      name: env.SITE_TITLE,
      url: env.SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: env.SITE_TITLE,
      url: env.SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${env.SITE_URL}/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${env.SITE_URL}/killmail/${killmailId}`,
    },
    url: `${env.SITE_URL}/killmail/${killmailId}`,
    keywords: [
      'EVE Online',
      'killmail',
      shipName,
      victimName,
      solarSystemName,
      regionName,
      'PvP',
      'combat',
    ].join(', '),
  };

  return JSON.stringify(structuredData);
}

/**
 * Generate Open Graph image URL for a killmail
 */
export function generateKillmailOGImage(params: {
  victimShipTypeId: number;
}): string {
  const { victimShipTypeId } = params;
  return `${env.IMAGE_SERVER_URL}/types/${victimShipTypeId}/render?size=1024`;
}

/**
 * Generate meta description for a killmail
 */
export function generateKillmailDescription(params: {
  victimName: string;
  shipName: string;
  totalValue: number;
  solarSystemName: string;
  regionName: string;
  attackerCount: number;
  killmailTime: string;
}): string {
  const {
    victimName,
    shipName,
    totalValue,
    solarSystemName,
    regionName,
    attackerCount,
    killmailTime,
  } = params;

  const valueBillion = (totalValue / 1_000_000_000).toFixed(2);
  const date = new Date(killmailTime);
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `${victimName} lost a ${shipName} worth ${valueBillion}B ISK in ${solarSystemName}, ${regionName} on ${dateStr}. ${attackerCount} ${attackerCount === 1 ? 'attacker' : 'attackers'} involved. View full killmail details, ship fitting, and combat statistics.`;
}

/**
 * Generate meta keywords for a killmail
 */
export function generateKillmailKeywords(params: {
  victimName: string;
  shipName: string;
  solarSystemName: string;
  regionName: string;
  shipGroup?: string;
  attackerNames?: string[];
}): string {
  const {
    victimName,
    shipName,
    solarSystemName,
    regionName,
    shipGroup,
    attackerNames = [],
  } = params;

  const keywords = [
    'eve online',
    'killmail',
    'killboard',
    victimName,
    shipName,
    solarSystemName,
    regionName,
    'pvp',
    'combat',
    'ship loss',
  ];

  if (shipGroup) {
    keywords.push(shipGroup.toLowerCase());
  }

  attackerNames.slice(0, 3).forEach((name) => keywords.push(name));

  return keywords.join(', ');
}

/**
 * Generate breadcrumb structured data
 */
export function generateBreadcrumbStructuredData(
  breadcrumbs: Array<{ name: string; url: string }>
): string {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${env.SITE_URL}${crumb.url}`,
    })),
  };

  return JSON.stringify(structuredData);
}

/**
 * Generate organization structured data
 */
export function generateOrganizationStructuredData(): string {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: env.SITE_TITLE,
    url: env.SITE_URL,
    logo: `${env.SITE_URL}/logo.png`,
    description:
      'Real-time EVE Online killmail tracking and analytics platform. Track ship losses, view detailed combat statistics, and analyze killmails.',
    sameAs: env.TWITTER_HANDLE
      ? [`https://twitter.com/${env.TWITTER_HANDLE.replace('@', '')}`]
      : [],
  };

  return JSON.stringify(structuredData);
}

/**
 * Generate website structured data
 */
export function generateWebsiteStructuredData(): string {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: env.SITE_TITLE,
    url: env.SITE_URL,
    description:
      'Real-time EVE Online killmail tracking and analytics. View detailed killmail information, ship fittings, and combat statistics.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${env.SITE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return JSON.stringify(structuredData);
}

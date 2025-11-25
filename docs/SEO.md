# SEO Implementation Guide

This document describes the SEO features implemented in EVE-KILL EDK.

## Overview

The application now includes comprehensive SEO metadata to improve search engine visibility and social media sharing. All pages include:

- **Primary meta tags** (title, description, keywords)
- **Open Graph tags** for Facebook, LinkedIn, and other platforms
- **Twitter Card tags** for X (Twitter)
- **JSON-LD structured data** for search engines
- **Canonical URLs** to prevent duplicate content issues

## Meta Tags

### Layout Template (`templates/default/layouts/main.hbs`)

The main layout includes all necessary SEO meta tags in the `<head>` section:

```handlebars
<!-- Primary Meta Tags -->
<title>{{page.title}} - {{config.title}}</title>
<meta name="title" content="..." />
<meta name="description" content="..." />
<meta name="keywords" content="..." />
<meta name="author" content="..." />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="..." />

<!-- Open Graph / Facebook -->
<meta property="og:type" content="..." />
<meta property="og:url" content="..." />
<meta property="og:title" content="..." />
<meta property="og:description" content="..." />
<meta property="og:image" content="..." />
<meta property="og:site_name" content="..." />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="..." />
<meta name="twitter:description" content="..." />
<meta name="twitter:image" content="..." />
```

## SEO Helper Functions

The `server/helpers/seo.ts` module provides utility functions for generating SEO metadata:

### Killmail SEO Functions

#### `generateKillmailStructuredData(params)`

Generates JSON-LD structured data for killmail pages in the "Article" schema format.

**Parameters:**
```typescript
{
  killmailId: number;
  victimName: string;
  shipName: string;
  totalValue: number;
  killmailTime: string;
  solarSystemName: string;
  regionName: string;
  attackerCount: number;
}
```

**Returns:** JSON-LD string for `<script type="application/ld+json">`

#### `generateKillmailOGImage(params)`

Generates an Open Graph image URL for killmail pages using the ship render.

**Parameters:**
```typescript
{
  victimShipTypeId: number;
}
```

**Returns:** Image URL string (1024x1024 ship render)

#### `generateKillmailDescription(params)`

Generates a human-readable meta description for killmail pages.

**Parameters:** Same as `generateKillmailStructuredData`

**Returns:** String (150-160 characters optimal)

**Example output:**
```
Test Pilot lost a Raven worth 5.43B ISK in Jita, The Forge on Nov 26, 2025. 
5 attackers involved. View full killmail details, ship fitting, and combat statistics.
```

#### `generateKillmailKeywords(params)`

Generates comma-separated keywords for killmail pages.

**Parameters:**
```typescript
{
  victimName: string;
  shipName: string;
  solarSystemName: string;
  regionName: string;
  shipGroup?: string;
  attackerNames?: string[];
}
```

**Returns:** Comma-separated keyword string

### Global SEO Functions

#### `generateWebsiteStructuredData()`

Generates JSON-LD structured data for the website in the "WebSite" schema format. Includes search action schema for search engines.

**Returns:** JSON-LD string

#### `generateOrganizationStructuredData()`

Generates JSON-LD structured data for the organization in the "Organization" schema format.

**Returns:** JSON-LD string

#### `generateBreadcrumbStructuredData(breadcrumbs)`

Generates JSON-LD structured data for breadcrumb navigation.

**Parameters:**
```typescript
breadcrumbs: Array<{ name: string; url: string }>
```

**Returns:** JSON-LD string

## Environment Variables

Add these environment variables to configure SEO:

```bash
# Required for canonical URLs and Open Graph
SITE_URL=https://eve-kill.com

# Optional: Twitter handle for Twitter Card attribution
TWITTER_HANDLE=@evekillboard
```

## Page Context Interface

When calling the `render()` function, you can pass these SEO-related properties in the page context:

```typescript
interface PageContext {
  title: string;              // Page title (without site name)
  description: string;        // Meta description
  keywords?: string;          // Meta keywords (comma-separated)
  url?: string;               // Canonical URL path (e.g., '/killmail/123')
  image?: string;             // Open Graph image URL
  type?: string;              // Open Graph type (default: 'website')
  structuredData?: string;    // JSON-LD structured data
  skipSiteName?: boolean;     // Don't append site name to title
}
```

## Usage Examples

### Killmail Page

```typescript
import {
  generateKillmailStructuredData,
  generateKillmailOGImage,
  generateKillmailDescription,
  generateKillmailKeywords,
} from '../../helpers/seo';

// Generate SEO metadata
const ogImage = generateKillmailOGImage({ victimShipTypeId: 638 });
const description = generateKillmailDescription({
  victimName: 'Test Pilot',
  shipName: 'Raven',
  totalValue: 5_432_000_000,
  solarSystemName: 'Jita',
  regionName: 'The Forge',
  attackerCount: 5,
  killmailTime: '2025-11-25T23:00:00.000Z',
});
const keywords = generateKillmailKeywords({
  victimName: 'Test Pilot',
  shipName: 'Raven',
  solarSystemName: 'Jita',
  regionName: 'The Forge',
});
const structuredData = generateKillmailStructuredData({
  killmailId: 123456789,
  victimName: 'Test Pilot',
  shipName: 'Raven',
  totalValue: 5_432_000_000,
  killmailTime: '2025-11-25T23:00:00.000Z',
  solarSystemName: 'Jita',
  regionName: 'The Forge',
  attackerCount: 5,
});

// Pass to render
return render('pages/killmail', {
  title: 'Test Pilot (Raven) - 5.43B ISK',
  description,
  keywords,
  url: '/killmail/123456789',
  image: ogImage,
  type: 'article',
  structuredData,
}, templateData, event);
```

### Homepage

```typescript
import {
  generateWebsiteStructuredData,
  generateOrganizationStructuredData,
} from '../helpers/seo';

const websiteData = generateWebsiteStructuredData();
const orgData = generateOrganizationStructuredData();
const combined = `[${websiteData},${orgData}]`;

return render('pages/home', {
  title: 'Home',
  description: 'Real-time EVE Online killmail tracking and analytics.',
  keywords: 'eve online, killmail, killboard, pvp',
  url: '/',
  type: 'website',
  structuredData: combined,
}, data, event);
```

## Testing SEO Metadata

### Built-in Debug Panel (Development Mode)

The easiest way to test SEO is using the built-in debug panel:

1. Open any page in development mode
2. Click the 🐞 debug button (top-right corner)
3. Click the "SEO" tab
4. View comprehensive analysis including:
   - Page title (with length validation)
   - Meta description (with length validation)
   - Keywords
   - Canonical URL
   - Open Graph metadata
   - Twitter Card metadata
   - Structured Data (JSON-LD)
   - SEO Score (0-100%) with specific issues

**Features:**
- ✅ Automatic validation
- ✅ Color-coded warnings (green/orange/red)
- ✅ Length checks for title and description
- ✅ Missing meta tag detection
- ✅ Pretty-printed structured data
- ✅ Detailed scoring breakdown

### External Validation Tools

#### Validate Open Graph Tags
- **Facebook Sharing Debugger**: https://developers.facebook.com/tools/debug/
- **LinkedIn Post Inspector**: https://www.linkedin.com/post-inspector/

#### Validate Twitter Cards
- **Twitter Card Validator**: https://cards-dev.twitter.com/validator

#### Validate Structured Data
- **Google Rich Results Test**: https://search.google.com/test/rich-results
- **Schema.org Validator**: https://validator.schema.org/

### Manual Testing

Use curl to inspect meta tags:

```bash
curl -s http://localhost:3000/killmail/123456789 | grep -E '(og:|twitter:|application/ld)'
```

## Best Practices

1. **Page Titles**
   - Keep under 60 characters
   - Include primary keywords early
   - Make them click-worthy

2. **Meta Descriptions**
   - 150-160 characters optimal
   - Include call-to-action
   - Summarize page content

3. **Keywords**
   - 5-10 relevant keywords
   - Include variations
   - Avoid keyword stuffing

4. **Open Graph Images**
   - 1200x630px recommended (minimum)
   - We use 1024x1024 ship renders
   - Include visual context

5. **Structured Data**
   - Test with Google's validator
   - Keep data accurate and up-to-date
   - Include all required fields

## Future Enhancements

Potential improvements to consider:

- [ ] Add breadcrumb structured data to entity pages
- [ ] Generate sitemap.xml automatically
- [ ] Add robots.txt with proper directives
- [ ] Implement AMP pages for mobile
- [ ] Add hreflang tags for internationalization
- [ ] Create custom Open Graph images with text overlays
- [ ] Add video structured data for future video content
- [ ] Implement FAQ schema for documentation pages
- [ ] Add local business schema if applicable

## References

- [Open Graph Protocol](https://ogp.me/)
- [Twitter Card Documentation](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
- [Schema.org Documentation](https://schema.org/)
- [Google Search Central - Structured Data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)
- [Meta Tags Best Practices 2025](https://moz.com/learn/seo/meta-description)

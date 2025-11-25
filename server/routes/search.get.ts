/**
 * Search page route
 * Displays search interface and results
 */
import type { H3Event } from 'h3';
import { render } from '../helpers/templates';
import { handleError } from '../utils/error';
import { searchEntities } from '../models/search';

export default defineEventHandler(async (event: H3Event) => {
  try {
    const query = getQuery(event);
    const searchQuery = (query.q as string) || '';
    
    let results: any[] = [];
    let hasSearched = false;
    
    // Only search if query is provided and has minimum length
    if (searchQuery && searchQuery.trim().length >= 2) {
      hasSearched = true;
      const maxLimit = Math.min(parseInt((query.limit as string) || '10', 10), 20);
      results = await searchEntities(searchQuery.trim(), maxLimit);
    }
    
    // Group results by type for display
    const groupedResults: Record<string, any[]> = {};
    for (const result of results) {
      if (!groupedResults[result.type]) {
        groupedResults[result.type] = [];
      }
      groupedResults[result.type].push(result);
    }
    
    // Page context with SEO
    const pageContext = {
      title: searchQuery ? `Search: ${searchQuery}` : 'Search',
      description: searchQuery 
        ? `Search results for "${searchQuery}" - Find EVE Online characters, corporations, alliances, items, and systems.`
        : 'Search for EVE Online characters, corporations, alliances, items, solar systems, and more.',
      keywords: 'eve online, search, find, character, corporation, alliance, item, system, killboard',
      url: `/search${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`,
      type: 'website',
    };
    
    // Template data
    const data = {
      query: searchQuery,
      hasSearched,
      results: groupedResults,
      totalResults: results.length,
      categories: {
        character: 'Characters',
        corporation: 'Corporations',
        alliance: 'Alliances',
        solarSystem: 'Solar Systems',
        item: 'Items',
      },
    };
    
    return render('pages/search', pageContext, data, event);
  } catch (error) {
    return handleError(event, error);
  }
});

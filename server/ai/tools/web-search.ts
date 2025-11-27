/**
 * Web Search Tool
 * Uses Tavily Search API to search the web for current information
 */

import type { AITool, AIToolResult, AIToolContext } from '../types';

export const definition: AITool['definition'] = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Search the web for current EVE Online news, events, updates, patch notes, meta changes, and community discussions. Use ONLY when information is NOT available in killmail data (e.g., game updates, balance changes, real-world EVE news). Returns recent articles with citations.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Search query about EVE Online (e.g., "latest EVE Online update", "Fanfest 2024 announcements", "current meta ships").',
        },
        max_results: {
          type: 'number',
          description:
            'Maximum number of search results to return (1-5). Defaults to 3.',
          minimum: 1,
          maximum: 5,
        },
      },
      required: ['query'],
    },
  },
};

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  answer?: string;
  results: TavilySearchResult[];
}

export async function execute(
  args: any,
  _context: AIToolContext
): Promise<AIToolResult> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    return {
      error: 'Web search is not configured (missing TAVILY_API_KEY)',
      stats: {
        configured: false,
      },
    };
  }

  try {
    const maxResults = Math.min(Math.max(args.max_results || 3, 1), 5);

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: args.query,
        max_results: maxResults,
        search_depth: 'basic',
        include_answer: true,
        include_raw_content: false,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Tavily API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as TavilyResponse;

    // Build HTML for display - limit content length to keep it concise
    const resultsHtml = data.results
      .map((result, index) => {
        const truncatedContent =
          result.content.length > 150
            ? result.content.slice(0, 150) + '...'
            : result.content;
        const shortUrl =
          result.url.length > 60 ? result.url.slice(0, 60) + '...' : result.url;

        return `
      <div style="padding: 10px; border-bottom: 1px solid #2a2a2a;">
        <a href="${result.url}" target="_blank" rel="noopener noreferrer" style="color: #6eb5ff; font-weight: 600; margin-bottom: 4px; display: block; text-decoration: none;">
          ${index + 1}. ${result.title}
        </a>
        <div style="color: #999; font-size: 13px; margin-bottom: 4px; line-height: 1.4;">
          ${truncatedContent}
        </div>
        <div style="color: #666; font-size: 11px;">
          ${shortUrl}
        </div>
      </div>
    `;
      })
      .join('');

    const html = `
      <div style="margin: 12px 0;">
        <div style="color: #888; margin-bottom: 10px; font-size: 14px; font-weight: 600;">
          🔍 Web Search Results
        </div>
        ${data.answer ? `<div style="background: #1a3a1a; padding: 10px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid #4caf50; font-size: 14px;"><strong style="color: #4caf50;">Summary:</strong> <span style="color: #ccc;">${data.answer}</span></div>` : ''}
        <div style="background: #1a1a1a; border-radius: 6px; overflow: hidden; font-size: 13px;">
          ${resultsHtml}
        </div>
      </div>
    `;

    return {
      html,
      stats: {
        query: args.query,
        result_count: data.results.length,
        answer: data.answer || null,
        sources: data.results.map((r) => ({
          title: r.title,
          url: r.url,
          relevance: r.score,
        })),
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Web search failed',
      stats: {
        query: args.query,
        success: false,
      },
    };
  }
}

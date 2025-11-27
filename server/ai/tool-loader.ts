/**
 * AI Tool Loader - Dynamic tool discovery and execution
 *
 * This file is kept minimal to avoid circular dependencies.
 * Tools are only imported when they're actually executed.
 */

import type {
  AIToolDefinition,
  AIToolResult,
  AIToolContext,
  AITool,
} from './types';

// Import all tools explicitly (Nitro bundler needs explicit imports)
import * as showKilllist from './tools/show-killlist';
import * as showExpensiveKills from './tools/show-expensive-kills';
import * as showEntityInfo from './tools/show-entity-info';
import * as searchKillmails from './tools/search-killmails';
import * as lookupLocation from './tools/lookup-location';
import * as webSearch from './tools/web-search';
import * as findHuntingGrounds from './tools/find-hunting-grounds';
import * as lookupItem from './tools/lookup-item';
import * as showCharacterInfo from './tools/show-character-info';
import * as suggestFitting from './tools/suggest-fitting';
import * as priceFitting from './tools/price-fitting';
import * as showKillmailFit from './tools/show-killmail-fit';

/**
 * Tool registry - add new tools here
 */
const TOOLS: Record<string, AITool> = {
  'show-killlist': showKilllist as AITool,
  'show-expensive-kills': showExpensiveKills as AITool,
  'show-entity-info': showEntityInfo as AITool,
  'search-killmails': searchKillmails as AITool,
  'lookup-location': lookupLocation as AITool,
  'web-search': webSearch as AITool,
  'find-hunting-grounds': findHuntingGrounds as AITool,
  'lookup-item': lookupItem as AITool,
  'show-character-info': showCharacterInfo as AITool,
  'suggest-fitting': suggestFitting as AITool,
  'price-fitting': priceFitting as AITool,
  'show-killmail-fit': showKillmailFit as AITool,
};

/**
 * Get all tool definitions for OpenAI
 */
export function getAllToolDefinitions(): AIToolDefinition[] {
  return Object.values(TOOLS).map((tool) => tool.definition);
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  toolName: string,
  args: any,
  context: AIToolContext
): Promise<AIToolResult> {
  try {
    context.logger?.debug?.(`[tool-exec] Executing ${toolName}`, args);

    // Convert tool name from OpenAI format (show_killlist -> show-killlist)
    const normalizedName = toolName.replace(/_/g, '-');

    const tool = TOOLS[normalizedName];

    if (!tool || !tool.execute) {
      return {
        error: `Tool ${toolName} not found or missing execute function`,
      };
    }

    // Execute the tool with context
    return await tool.execute(args, context);
  } catch (error: any) {
    context.logger?.error?.(`[tool-exec] Failed ${toolName}:`, error.message);
    return { error: error.message || 'Tool execution failed' };
  }
}

/**
 * Lookup Location Tool
 * Find solar system or region IDs by name
 */

import type { AITool, AIToolResult, AIToolContext } from '../types';

export const definition: AITool['definition'] = {
  type: 'function',
  function: {
    name: 'lookup_location',
    description:
      'Look up EVE Online location IDs by name. Use before search_killmails when user specifies location names like "Jita", "The Forge", etc. Returns system/region IDs with security status.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description:
            'Name of the solar system or region to look up (e.g., "Jita", "Delve", "The Forge").',
        },
        type: {
          type: 'string',
          enum: ['system', 'region'],
          description:
            'Location type: "system" for solar systems (default) or "region" for regions.',
        },
      },
      required: ['name'],
    },
  },
};

export async function execute(
  args: any,
  context: AIToolContext
): Promise<AIToolResult> {
  const { database } = context;
  const sql = database.sql;

  const searchName = args.name.toLowerCase();
  const searchType = args.type || 'system'; // Default to system

  let results = [];

  if (searchType === 'system') {
    results = await sql`
      SELECT 
        "solarSystemId" as id,
        "name",
        "securityStatus" as security,
        "regionId"
      FROM solarsystems
      WHERE LOWER("name") LIKE ${`%${searchName}%`}
      LIMIT 5
    `;
  } else {
    results = await sql`
      SELECT 
        "regionId" as id,
        "name"
      FROM regions
      WHERE LOWER("name") LIKE ${`%${searchName}%`}
      LIMIT 5
    `;
  }

  if (results.length === 0) {
    return {
      error: `No ${searchType} found matching "${args.name}"`,
      stats: {
        found: false,
        searchType,
        searchName: args.name,
      },
    };
  }

  // Return as plain data for AI to use
  const match = results[0];

  return {
    stats: {
      found: true,
      searchType,
      searchName: args.name,
      id: match.id,
      name: match.name,
      security: match.security || null,
      regionId: match.regionId || null,
      alternates: results.slice(1).map((r) => ({ id: r.id, name: r.name })),
    },
  };
}

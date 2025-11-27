/**
 * Search Killmails Tool
 * Advanced killmail search with multiple filters
 */

import type { AITool, AIToolResult, AIToolContext } from '../types';

export const definition: AITool['definition'] = {
  type: 'function',
  function: {
    name: 'search_killmails',
    description:
      'Advanced killmail search with multiple filters (entity, location, ship type, value range, timeframe). Use for complex queries like "Jita kills over 10B", "character X losses in nullsec", "corporation Y Titan kills", etc. Combine multiple filters for precise results.',
    parameters: {
      type: 'object',
      properties: {
        characterId: {
          type: 'number',
          description:
            'Filter by character ID (victim or attacker). Use lookup_location first if you only have the name.',
        },
        corporationId: {
          type: 'number',
          description:
            'Filter by corporation ID (victim corp or attacker corp).',
        },
        allianceId: {
          type: 'number',
          description:
            'Filter by alliance ID (victim alliance or attacker alliance).',
        },
        shipTypeId: {
          type: 'number',
          description:
            'Filter by ship type ID (e.g., specific ship class). Use lookup_item first if you only have ship name.',
        },
        solarSystemId: {
          type: 'number',
          description:
            'Filter by solar system ID. Use lookup_location to get ID from system name.',
        },
        solarSystemName: {
          type: 'string',
          description:
            'Filter by solar system name (e.g., "Jita"). Tool will look up ID automatically.',
        },
        regionId: {
          type: 'number',
          description:
            'Filter by region ID. Use lookup_location to get ID from region name.',
        },
        regionName: {
          type: 'string',
          description:
            'Filter by region name (e.g., "The Forge"). Tool will look up ID automatically.',
        },
        minValue: {
          type: 'number',
          description:
            'Minimum killmail value in billions (e.g., 10 = 10B ISK). Filters out lower-value kills.',
        },
        maxValue: {
          type: 'number',
          description:
            'Maximum killmail value in billions. Useful for filtering out super expensive outliers.',
        },
        timeframe: {
          type: 'string',
          enum: ['1h', '6h', '24h', '7d', '30d', '90d', '180d'],
          description:
            'Time window to search. Defaults to "24h". Longer periods return historical data.',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (up to 50). Defaults to 20.',
        },
        sortBy: {
          type: 'string',
          enum: ['time', 'value'],
          description:
            'Sort order: "time" (newest first, default) or "value" (most expensive first).',
        },
      },
    },
  },
};

function parseTimeframe(timeframe: string = '24h'): string {
  const map: Record<string, string> = {
    '1h': "NOW() - INTERVAL '1 hour'",
    '6h': "NOW() - INTERVAL '6 hours'",
    '24h': "NOW() - INTERVAL '1 day'",
    '7d': "NOW() - INTERVAL '7 days'",
    '30d': "NOW() - INTERVAL '30 days'",
    '90d': "NOW() - INTERVAL '90 days'",
    '180d': "NOW() - INTERVAL '180 days'",
  };

  return map[timeframe] || map['24h'];
}

export async function execute(
  args: any,
  context: AIToolContext
): Promise<AIToolResult> {
  const { database } = context;
  const sql = database.sql;

  const limit = Math.min(args.limit || 10, 50);
  const sortBy = args.sortBy || 'time';

  // If system/region names are provided, look them up
  if (args.solarSystemName && !args.solarSystemId) {
    const systems = await sql`
      SELECT "solarSystemId" FROM solarsystems
      WHERE LOWER(name) = LOWER(${args.solarSystemName})
      LIMIT 1
    `;
    if (systems.length > 0) {
      args.solarSystemId = systems[0].solarSystemId;
    }
  }

  if (args.regionName && !args.regionId) {
    const regions = await sql`
      SELECT "regionId" FROM regions
      WHERE LOWER(name) = LOWER(${args.regionName})
      LIMIT 1
    `;
    if (regions.length > 0) {
      args.regionId = regions[0].regionId;
    }
  }

  // Build WHERE clause parts as strings
  const whereClauses = [`k."killmailTime" > ${parseTimeframe(args.timeframe)}`];

  if (args.characterId) {
    whereClauses.push(`(k."victimCharacterId" = ${args.characterId} OR EXISTS (
      SELECT 1 FROM attackers a 
      WHERE a."killmailId" = k."killmailId" AND a."characterId" = ${args.characterId}
    ))`);
  }

  if (args.corporationId) {
    whereClauses.push(`(k."victimCorporationId" = ${args.corporationId} OR EXISTS (
      SELECT 1 FROM attackers a 
      WHERE a."killmailId" = k."killmailId" AND a."corporationId" = ${args.corporationId}
    ))`);
  }

  if (args.allianceId) {
    whereClauses.push(`(k."victimAllianceId" = ${args.allianceId} OR EXISTS (
      SELECT 1 FROM attackers a 
      WHERE a."killmailId" = k."killmailId" AND a."allianceId" = ${args.allianceId}
    ))`);
  }

  if (args.shipTypeId) {
    whereClauses.push(`k."victimShipTypeId" = ${args.shipTypeId}`);
  }

  if (args.solarSystemId) {
    whereClauses.push(`k."solarSystemId" = ${args.solarSystemId}`);
  }

  if (args.regionId) {
    whereClauses.push(`k."regionId" = ${args.regionId}`);
  }

  if (args.minValue) {
    const minValueISK = args.minValue * 1_000_000_000;
    whereClauses.push(`k."totalValue" >= ${minValueISK}`);
  }

  if (args.maxValue) {
    const maxValueISK = args.maxValue * 1_000_000_000;
    whereClauses.push(`k."totalValue" <= ${maxValueISK}`);
  }

  const whereClause = whereClauses.join(' AND ');
  const orderBy =
    sortBy === 'value' ? 'k."totalValue" DESC' : 'k."killmailTime" DESC';

  const killmails = await sql.unsafe(`
    SELECT 
      k."killmailId",
      k."killmailTime",
      k."totalValue",
      k."victimShipTypeId",
      k."solarSystemId",
      t.name as "shipName",
      s.name as "systemName",
      s."securityStatus" as "systemSecurity"
    FROM killmails k
    LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"
    LEFT JOIN solarsystems s ON k."solarSystemId" = s."solarSystemId"
    WHERE ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ${limit}
  `);

  const totalValue = killmails.reduce(
    (sum, k) => sum + Number(k.totalValue || 0),
    0
  );
  const avgValue = killmails.length > 0 ? totalValue / killmails.length : 0;

  const filterDesc = [];
  if (args.characterId) filterDesc.push(`Character ${args.characterId}`);
  if (args.corporationId) filterDesc.push(`Corp ${args.corporationId}`);
  if (args.allianceId) filterDesc.push(`Alliance ${args.allianceId}`);
  if (args.shipTypeId) filterDesc.push(`Ship ${args.shipTypeId}`);
  if (args.solarSystemName) filterDesc.push(args.solarSystemName);
  else if (args.solarSystemId) filterDesc.push(`System ${args.solarSystemId}`);
  if (args.regionName) filterDesc.push(args.regionName);
  else if (args.regionId) filterDesc.push(`Region ${args.regionId}`);
  if (args.minValue) filterDesc.push(`Min ${args.minValue}B ISK`);
  if (args.maxValue) filterDesc.push(`Max ${args.maxValue}B ISK`);

  // Build HTML manually
  const killRows = killmails
    .map(
      (k) =>
        `<div style="padding: 12px 16px; border-bottom: 1px solid #2a2a2a; display: flex; justify-content: space-between; align-items: center;"><div style="flex: 1;"><a href="/killmail/${k.killmailId}" style="color: #6eb5ff; text-decoration: none; font-weight: 500;">${k.shipName || 'Unknown Ship'}</a><div style="color: #888; font-size: 13px; margin-top: 4px;">${k.systemName || 'Unknown'} (${k.systemSecurity?.toFixed(1) || '?'}) • ${new Date(k.killmailTime).toLocaleString()}</div></div><div style="text-align: right;"><div style="color: #ff6b6b; font-weight: 600;">${(Number(k.totalValue) / 1_000_000).toFixed(2)}M ISK</div></div></div>`
    )
    .join('');

  const html = `<div style="margin: 16px 0;"><h3 style="color: #fff; margin-bottom: 12px; font-size: 18px;">Filtered Kills: ${filterDesc.join(', ')}</h3><div style="background: #1a1a1a; border-radius: 8px; overflow: hidden;">${killRows || '<div style="padding: 24px; text-align: center; color: #666;">No killmails found</div>'}</div></div>`;

  return {
    html,
    stats: {
      count: killmails.length,
      totalValue,
      totalValueFormatted: `${(totalValue / 1_000_000_000).toFixed(2)}B ISK`,
      avgValue,
      avgValueFormatted: `${(avgValue / 1_000_000_000).toFixed(2)}B ISK`,
      topKill: killmails[0]?.totalValue || 0,
      topKillFormatted: killmails[0]
        ? `${(Number(killmails[0].totalValue) / 1_000_000_000).toFixed(2)}B ISK`
        : '0 ISK',
      topShip: killmails[0]?.shipName || null,
      topSystem: killmails[0]?.systemName || null,
      timeframe: args.timeframe || '24h',
      filters: filterDesc.join(', '),
      sortedBy: sortBy,
    },
  };
}

/**
 * Show Killlist Tool
 * Displays a list of killmails with optional filters
 */

import type { AITool, AIToolResult, AIToolContext } from '../types';

export const definition: AITool['definition'] = {
  type: 'function',
  function: {
    name: 'show_killlist',
    description:
      'Display a simple list of recent killmails with basic info (ship, location, time, value). Use this for "show recent kills" or "list latest killmails" queries without complex filters.',
    parameters: {
      type: 'object',
      properties: {
        timeframe: {
          type: 'string',
          enum: ['1h', '6h', '24h', '7d', '30d', 'all'],
          description:
            'Time period to query. Defaults to "24h". Use shorter timeframes for real-time activity, longer for historical data.',
        },
        limit: {
          type: 'number',
          description:
            'Number of killmails to return (maximum 50). Defaults to 10. Increase for longer lists.',
        },
      },
    },
  },
};

/**
 * Parse timeframe to SQL condition
 */
function parseTimeframe(timeframe: string = '24h'): string {
  const map: Record<string, string> = {
    '1h': "NOW() - INTERVAL '1 hour'",
    '6h': "NOW() - INTERVAL '6 hours'",
    '24h': "NOW() - INTERVAL '1 day'",
    '7d': "NOW() - INTERVAL '7 days'",
    '30d': "NOW() - INTERVAL '30 days'",
    all: "'1970-01-01'",
  };

  return map[timeframe] || map['24h'];
}

export async function execute(
  args: any,
  context: AIToolContext
): Promise<AIToolResult> {
  const { database, render } = context;
  const sql = database.sql;

  const limit = Math.min(args.limit || 10, 50);
  const timeCondition = parseTimeframe(args.timeframe);

  const killmails = await sql`
    SELECT 
      k."killmailId",
      k."killmailTime",
      k."totalValue",
      k."victimShipTypeId",
      k."solarSystemId",
      t."name" as "shipName",
      s."name" as "systemName",
      s."securityStatus" as "systemSecurity"
      , c."characterId" AS "victimCharacterId"
      , c.name AS "victimCharacterName"
      , corp."corporationId" AS "victimCorporationId"
      , corp.name AS "victimCorporationName"
      , alli."allianceId" AS "victimAllianceId"
      , alli.name AS "victimAllianceName"
    FROM killmails k
    LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"
    LEFT JOIN solarsystems s ON k."solarSystemId" = s."solarSystemId"
    LEFT JOIN characters c ON k."victimCharacterId" = c."characterId"
    LEFT JOIN corporations corp ON k."victimCorporationId" = corp."corporationId"
    LEFT JOIN alliances alli ON k."victimAllianceId" = alli."allianceId"
    WHERE k."killmailTime" > ${sql.unsafe(timeCondition)}
    ORDER BY k."killmailTime" DESC
    LIMIT ${limit}
  `;

  const totalValue = killmails.reduce(
    (sum, k) => sum + Number(k.totalValue || 0),
    0
  );
  const mapped = killmails.map((k) => ({
    killmailId: k.killmailId,
    killmailTime: k.killmailTime,
    killmailTimeRelative: formatRelative(k.killmailTime),
    totalValue: Number(k.totalValue || 0),
    isLoss: true,
    victim: {
      ship: {
        typeId: k.victimShipTypeId,
        name: k.shipName || 'Unknown Ship',
      },
      character: {
        id: k.victimCharacterId || null,
        name: k.victimCharacterName || 'Unknown',
      },
      corporation: {
        id: k.victimCorporationId || null,
        name: k.victimCorporationName || null,
      },
      alliance: {
        id: k.victimAllianceId || null,
        name: k.victimAllianceName || null,
      },
    },
    solarSystem: {
      id: k.solarSystemId,
      name: k.systemName || 'Unknown',
    },
  }));

  const listHtml = await render(
    'components/ai-killmail-list.hbs',
    {},
    { killmails: mapped },
    undefined,
    false
  );

  const html = `
    <div class="ai-message__html" style="margin: 12px 0;">
      <div style="color:#fff; font-weight:600; margin-bottom:8px;">Recent Kills (${args.timeframe || '24h'})</div>
      ${listHtml}
    </div>
  `;

  return {
    html,
    stats: {
      count: killmails.length,
      totalValue,
      totalValueFormatted: `${(totalValue / 1_000_000_000).toFixed(2)}B ISK`,
      avgValue: killmails.length > 0 ? totalValue / killmails.length : 0,
      avgValueFormatted:
        killmails.length > 0
          ? `${(totalValue / killmails.length / 1_000_000).toFixed(2)}M ISK`
          : '0 ISK',
      timeframe: args.timeframe || '24h',
      topShip: killmails[0]?.shipName || null,
      topValue: killmails[0]?.totalValue || 0,
      topValueFormatted: killmails[0]
        ? `${(Number(killmails[0].totalValue) / 1_000_000_000).toFixed(2)}B ISK`
        : '0 ISK',
    },
  };
}

function formatRelative(dateValue: string | Date): string {
  const date = new Date(dateValue);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

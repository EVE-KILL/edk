/**
 * Show Expensive Kills Tool
 * Displays the most expensive killmails
 */

import type { AITool, AIToolResult, AIToolContext } from '../types';

export const definition: AITool['definition'] = {
  type: 'function',
  function: {
    name: 'show_expensive_kills',
    description:
      'Display the most expensive killmails sorted by ISK value. Use for "top expensive kills", "biggest losses", "most valuable kills", or "juiciest targets" queries.',
    parameters: {
      type: 'object',
      properties: {
        timeframe: {
          type: 'string',
          enum: ['1h', '6h', '24h', '7d', '30d', 'all'],
          description:
            'Time period to search. Defaults to "24h". Use "all" for all-time records.',
        },
        limit: {
          type: 'number',
          description:
            'Number of killmails to return (maximum 50). Defaults to 10.',
        },
        minValue: {
          type: 'number',
          description:
            'Minimum ISK value threshold in billions (e.g., 1 = 1B ISK). Filter out lower-value kills. Optional.',
        },
        ship_name: {
          type: 'string',
          description:
            'Optional ship name filter (partial match). Use for specific hulls like titans.',
        },
        ship_type_id: {
          type: 'number',
          description:
            'Optional ship type ID filter. Overrides ship_name if provided.',
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
  const minValue = (args.minValue || 0) * 1_000_000_000; // Convert billions to ISK
  let shipTypeId = args.ship_type_id as number | undefined;

  if (!shipTypeId && args.ship_name) {
    const ships = await sql`
      SELECT "typeId"
      FROM types
      WHERE LOWER(name) LIKE LOWER(${`%${args.ship_name}%`})
      ORDER BY "typeId"
      LIMIT 1
    `;
    shipTypeId = ships[0]?.typeId;
  }

  const killmails = await sql`
    SELECT 
      k."killmailId",
      k."killmailTime",
      k."totalValue",
      k."victimShipTypeId",
      k."solarSystemId",
      t.name as "shipName",
      s.name as "systemName",
      s."securityStatus" as "systemSecurity",
      c."characterId" as "victimCharacterId",
      c.name as "victimCharacterName",
      corp."corporationId" as "victimCorporationId",
      corp.name as "victimCorporationName",
      alli."allianceId" as "victimAllianceId",
      alli.name as "victimAllianceName"
    FROM killmails k
    LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"
    LEFT JOIN solarsystems s ON k."solarSystemId" = s."solarSystemId"
    LEFT JOIN characters c ON k."victimCharacterId" = c."characterId"
    LEFT JOIN corporations corp ON k."victimCorporationId" = corp."corporationId"
    LEFT JOIN alliances alli ON k."victimAllianceId" = alli."allianceId"
    WHERE k."killmailTime" > ${sql.unsafe(timeCondition)}
      AND k."totalValue" >= ${minValue}
      ${shipTypeId ? sql`AND k."victimShipTypeId" = ${shipTypeId}` : sql``}
    ORDER BY k."totalValue" DESC
    LIMIT ${limit}
  `;

  const totalValue = killmails.reduce(
    (sum, k) => sum + Number(k.totalValue || 0),
    0
  );
  const avgValue = killmails.length > 0 ? totalValue / killmails.length : 0;

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
      <div style="color:#fff; font-weight:600; margin-bottom:8px;">Most Expensive Kills (${args.timeframe || '24h'})</div>
      ${listHtml}
    </div>
  `;

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
      shipFilter: shipTypeId || null,
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

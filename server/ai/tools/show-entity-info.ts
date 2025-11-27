/**
 * Show Entity Info Tool
 * Displays information about a character, corporation, or alliance
 */

import type { AITool, AIToolResult, AIToolContext } from '../types';
import { convertEveHtml } from '../../helpers/eve-html-parser';
import { searchEntities } from '../../models/search';

export const definition: AITool['definition'] = {
  type: 'function',
  function: {
    name: 'show_entity_info',
    description:
      'Look up and display information about an EVE Online character, corporation, or alliance. Returns name, description (often contains fun bios), member counts, and links. Search by name or ID.',
    parameters: {
      type: 'object',
      properties: {
        entityType: {
          type: 'string',
          enum: ['character', 'corporation', 'alliance'],
          description:
            'Type of entity to look up: "character" for players, "corporation" for corps, "alliance" for alliances.',
        },
        entityId: {
          type: 'number',
          description:
            'Exact entity ID if known. More precise than searching by name.',
        },
        entityName: {
          type: 'string',
          description:
            'Entity name to search for (case-insensitive, partial match). Use if ID is not known.',
        },
      },
      required: ['entityType'],
    },
  },
};

export async function execute(
  args: any,
  context: AIToolContext
): Promise<AIToolResult> {
  const { database } = context;
  const sql = database.sql;

  const { entityType, entityId, entityName } = args;

  // If only name is provided, search for it first
  let id = entityId;
  if (!id && entityName) {
    // Try indexed prefix search first (fast), then fallback to substring
    const searchResults = await searchEntities(entityName, 5);
    const match = searchResults.find((r) => r.type === entityType);

    if (match) {
      id = Number(match.entityId);
    } else {
      const search = `%${entityName}%`;
      let results;

      if (entityType === 'character') {
        results = await sql`
          SELECT "characterId" as id
          FROM characters
          WHERE LOWER("name") LIKE LOWER(${search})
          LIMIT 1
        `;
      } else if (entityType === 'corporation') {
        results = await sql`
          SELECT "corporationId" as id
          FROM corporations
          WHERE LOWER("name") LIKE LOWER(${search})
          LIMIT 1
        `;
      } else {
        results = await sql`
          SELECT "allianceId" as id
          FROM alliances
          WHERE LOWER("name") LIKE LOWER(${search})
          LIMIT 1
        `;
      }

      if (results.length === 0) {
        const suggestions = searchResults.slice(0, 3);
        const suggestionText =
          suggestions.length > 0
            ? ` Did you mean: ${suggestions
                .map((s) => `${s.name} (${s.type})`)
                .join(', ')}?`
            : '';
        return {
          error: `${entityType} "${entityName}" not found.${suggestionText}`,
        };
      }

      id = results[0].id;
    }
  }

  if (!id) {
    return { error: 'Either entityId or entityName must be provided' };
  }

  // Fetch entity data
  let entity;
  let killStats;

  if (entityType === 'character') {
    [entity] = await sql`
      SELECT 
        "characterId",
        name,
        "corporationId",
        "allianceId",
        description,
        birthday,
        "securityStatus",
        gender,
        "raceId",
        "bloodlineId"
      FROM characters
      WHERE "characterId" = ${id}
    `;

    killStats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE a."finalBlow" = true) as kills,
        COUNT(*) as total_kills,
        COUNT(DISTINCT k."killmailId") FILTER (WHERE k."victimCharacterId" = ${id}) as losses
      FROM killmails k
      LEFT JOIN attackers a ON k."killmailId" = a."killmailId" AND a."characterId" = ${id}
      WHERE a."characterId" = ${id} OR k."victimCharacterId" = ${id}
    `;
  } else if (entityType === 'corporation') {
    [entity] = await sql`
      SELECT 
        "corporationId",
        name,
        "allianceId",
        "memberCount",
        ticker,
        description,
        "ceoId",
        "dateFounded",
        "taxRate"
      FROM corporations
      WHERE "corporationId" = ${id}
    `;

    killStats = await sql`
      SELECT 
        COUNT(DISTINCT k."killmailId") FILTER (WHERE a."corporationId" = ${id}) as kills,
        COUNT(DISTINCT k."killmailId") FILTER (WHERE k."victimCorporationId" = ${id}) as losses
      FROM killmails k
      LEFT JOIN attackers a ON k."killmailId" = a."killmailId"
      WHERE a."corporationId" = ${id} OR k."victimCorporationId" = ${id}
    `;
  } else {
    [entity] = await sql`
      SELECT 
        "allianceId",
        name,
        ticker,
        "dateFounded",
        "executorCorporationId"
      FROM alliances
      WHERE "allianceId" = ${id}
    `;

    killStats = await sql`
      SELECT 
        COUNT(DISTINCT k."killmailId") FILTER (WHERE a."allianceId" = ${id}) as kills,
        COUNT(DISTINCT k."killmailId") FILTER (WHERE k."victimAllianceId" = ${id}) as losses
      FROM killmails k
      LEFT JOIN attackers a ON k."killmailId" = a."killmailId"
      WHERE a."allianceId" = ${id} OR k."victimAllianceId" = ${id}
    `;
  }

  if (!entity) {
    return { error: `${entityType} with ID ${id} not found` };
  }

  // Build HTML manually with images and rich info
  const stats = killStats[0] || {};
  const displayName = entity.name || 'Unknown';
  const kills = stats.kills || 0;
  const losses = stats.losses || 0;

  // EVE Image Server URLs
  let imageUrl = '';
  const imageSize = 128;
  if (entityType === 'character') {
    imageUrl = `https://images.evetech.net/characters/${id}/portrait?size=${imageSize}`;
  } else if (entityType === 'corporation') {
    imageUrl = `https://images.evetech.net/corporations/${id}/logo?size=${imageSize}`;
  } else {
    imageUrl = `https://images.evetech.net/alliances/${id}/logo?size=${imageSize}`;
  }

  // Additional info based on type
  let additionalInfo = '';
  if (entityType === 'character') {
    additionalInfo = `
      ${entity.description ? `<div style="color: #aaa; margin: 12px 0; padding: 12px; background: #0a0a0a; border-radius: 4px; font-style: italic; line-height: 1.5;">${convertEveHtml(entity.description, { convertFontSize: false, convertFontColor: false })}</div>` : ''}
      ${entity.securityStatus !== null ? `<div style="color: #888; margin: 8px 0;"><strong>Security Status:</strong> ${Number(entity.securityStatus).toFixed(2)}</div>` : ''}
      ${entity.birthday ? `<div style="color: #888; margin: 8px 0;"><strong>Birthday:</strong> ${new Date(entity.birthday).toLocaleDateString()}</div>` : ''}
      ${entity.gender ? `<div style="color: #888; margin: 8px 0;"><strong>Gender:</strong> ${entity.gender}</div>` : ''}
    `;
  } else if (entityType === 'corporation') {
    additionalInfo = `
      ${entity.ticker ? `<div style="color: #888; margin: 8px 0;"><strong>Ticker:</strong> [${entity.ticker}]</div>` : ''}
      ${entity.memberCount ? `<div style="color: #888; margin: 8px 0;"><strong>Members:</strong> ${entity.memberCount.toLocaleString()}</div>` : ''}
      ${entity.dateFounded ? `<div style="color: #888; margin: 8px 0;"><strong>Founded:</strong> ${new Date(entity.dateFounded).toLocaleDateString()}</div>` : ''}
      ${entity.taxRate !== null ? `<div style="color: #888; margin: 8px 0;"><strong>Tax Rate:</strong> ${(entity.taxRate * 100).toFixed(1)}%</div>` : ''}
      ${entity.description ? `<div style="color: #aaa; margin: 12px 0; padding: 12px; background: #0a0a0a; border-radius: 4px; line-height: 1.5;">${convertEveHtml(entity.description, { convertFontSize: false, convertFontColor: false })}</div>` : ''}
    `;
  } else {
    additionalInfo = `
      ${entity.ticker ? `<div style="color: #888; margin: 8px 0;"><strong>Ticker:</strong> <${entity.ticker}></div>` : ''}
      ${entity.dateFounded ? `<div style="color: #888; margin: 8px 0;"><strong>Founded:</strong> ${new Date(entity.dateFounded).toLocaleDateString()}</div>` : ''}
    `;
  }

  const html = `<div style="margin: 16px 0;"><div style="background: #1a1a1a; border-radius: 8px; padding: 24px;"><div style="display: flex; gap: 20px; align-items: start;"><img src="${imageUrl}" alt="${displayName}" style="width: ${imageSize}px; height: ${imageSize}px; border-radius: 8px; border: 2px solid #333;" onerror="this.style.display='none'"><div style="flex: 1;"><h3 style="color: #fff; margin-bottom: 8px; font-size: 24px;">${displayName}</h3><div style="color: #0066cc; margin-bottom: 16px; text-transform: capitalize; font-weight: 600;">${entityType}</div>${additionalInfo}<div style="display: flex; gap: 24px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #333;"><div style="flex: 1;"><div style="color: #999; font-size: 13px; margin-bottom: 6px;">Total Kills</div><div style="color: #4caf50; font-size: 28px; font-weight: 700;">${kills.toLocaleString()}</div></div><div style="flex: 1;"><div style="color: #999; font-size: 13px; margin-bottom: 6px;">Total Losses</div><div style="color: #ff6b6b; font-size: 28px; font-weight: 700;">${losses.toLocaleString()}</div></div>${kills + losses > 0 ? `<div style="flex: 1;"><div style="color: #999; font-size: 13px; margin-bottom: 6px;">Efficiency</div><div style="color: #ffa726; font-size: 28px; font-weight: 700;">${((kills / (kills + losses)) * 100).toFixed(1)}%</div></div>` : ''}</div></div></div></div></div>`;

  return {
    html,
    stats: {
      entityType,
      name: entity.name,
      kills: killStats[0]?.kills || 0,
      losses: killStats[0]?.losses || 0,
      efficiency:
        kills + losses > 0
          ? ((kills / (kills + losses)) * 100).toFixed(1) + '%'
          : 'N/A',
      description: entity.description || null,
      ticker: entity.ticker || null,
      memberCount: entity.memberCount || null,
      securityStatus: entity.securityStatus || null,
      founded: entity.dateFounded || entity.birthday || null,
    },
  };
}

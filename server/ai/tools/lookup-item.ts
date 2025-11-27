import type { AIToolDefinition, AIToolResult, AIToolContext } from '../types';
import { TypeQueries } from '../../models/types';
import { getGroup } from '../../models/groups';
import { getCategory } from '../../models/categories';
import { database } from '../../helpers/database';

export const definition: AIToolDefinition = {
  type: 'function',
  function: {
    name: 'lookup_item',
    description:
      'Look up EVE Online items, ships, modules, or structures by name or ID. Returns detailed information including image, category, group, technical specs (mass, volume, capacity), and description. Use for "what is X ship", "show me Y module", or "tell me about Z item".',
    parameters: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description:
            'Item name to search for (e.g., "Raven", "Drake Navy Issue", "Large Shield Extender"). Partial matches supported.',
        },
        type_id: {
          type: 'number',
          description: 'Exact type ID if known. More precise than name search.',
        },
        limit: {
          type: 'number',
          description:
            'Maximum search results when searching by name (10-20). Defaults to 10. Single results show full details.',
          default: 10,
        },
      },
      required: [],
    },
  },
};

export async function execute(
  params: {
    search?: string;
    type_id?: number;
    limit?: number;
  },
  _context: AIToolContext
): Promise<AIToolResult> {
  try {
    const limit = Math.min(params.limit || 10, 20);

    // Direct lookup by ID
    if (params.type_id) {
      const item = await TypeQueries.getType(params.type_id);
      if (!item) {
        return {
          html: '',
          stats: { found: false },
        };
      }

      const group = item.groupId ? await getGroup(item.groupId) : null;
      const category = group?.categoryId
        ? await getCategory(group.categoryId)
        : null;
      const race = item.raceId
        ? await database.findOne<{ name: string }>(
            'SELECT name FROM races WHERE "raceId" = :raceId LIMIT 1',
            { raceId: item.raceId }
          )
        : null;

      return {
        html: renderItemCard(item, group, category),
        stats: {
          found: true,
          item_name: item.name,
          item_id: item.typeId,
          group: group?.name,
          category: category?.name,
          description: item.description || null,
          race: race?.name || null,
        },
      };
    }

    // Search by name
    if (params.search) {
      const items = await TypeQueries.searchTypes(params.search, limit);

      if (items.length === 0) {
        return {
          html: `<div style="color: #999;">No items found for "${params.search}"</div>`,
          stats: { found: false, query: params.search },
        };
      }

      // Prefer exact case-insensitive match; otherwise take the first result
      const exact =
        items.find(
          (i: any) =>
            i.name && i.name.toLowerCase() === params.search!.toLowerCase()
        ) || items[0];

      const item = exact;
      const group = item.groupId ? await getGroup(item.groupId) : null;
      const category = group?.categoryId
        ? await getCategory(group.categoryId)
        : null;
      const race = item.raceId
        ? await database.findOne<{ name: string }>(
            'SELECT name FROM races WHERE "raceId" = :raceId LIMIT 1',
            { raceId: item.raceId }
          )
        : null;

      return {
        html: renderItemCard(item, group, category),
        stats: {
          found: true,
          item_name: item.name,
          item_id: item.typeId,
          group: group?.name,
          category: category?.name,
          matches: items.length,
          description: item.description || null,
          race: race?.name || null,
        },
      };
    }

    return {
      html: '<div style="color: #999;">Please provide either search term or type_id</div>',
      stats: { error: 'No search criteria provided' },
    };
  } catch (error: any) {
    return {
      html: `<div style="color: #f44;">Error looking up item: ${error.message}</div>`,
      stats: { error: error.message },
    };
  }
}

function renderItemCard(item: any, group: any, category: any): string {
  const imageUrl = `https://images.evetech.net/types/${item.typeId}/icon?size=128`;

  return `
    <div style="
      margin: 16px 0;
      background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%);
      border: 1px solid #333;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    ">
      <div style="display: flex; gap: 20px; align-items: start;">
        <!-- Item Image -->
        <div style="flex-shrink: 0;">
          <img 
            src="${imageUrl}" 
            alt="${item.name}"
            style="
              width: 128px;
              height: 128px;
              border-radius: 8px;
              background: #000;
              border: 2px solid #444;
            "
          />
        </div>

        <!-- Item Info -->
        <div style="flex: 1; min-width: 0;">
          <h3 style="
            color: #fff;
            margin: 0 0 8px 0;
            font-size: 24px;
            font-weight: 700;
          ">
            ${item.name}
          </h3>

          ${
            category || group
              ? `
            <div style="
              display: flex;
              gap: 8px;
              margin-bottom: 12px;
              flex-wrap: wrap;
            ">
              ${
                category
                  ? `
                <span style="
                  background: #333;
                  color: #0af;
                  padding: 4px 12px;
                  border-radius: 12px;
                  font-size: 12px;
                  font-weight: 600;
                ">
                  ${category.name}
                </span>
              `
                  : ''
              }
              ${
                group
                  ? `
                <span style="
                  background: #222;
                  color: #888;
                  padding: 4px 12px;
                  border-radius: 12px;
                  font-size: 12px;
                ">
                  ${group.name}
                </span>
              `
                  : ''
              }
            </div>
          `
              : ''
          }

          ${
            item.description
              ? `
            <div style="
              color: #999;
              font-size: 14px;
              line-height: 1.5;
              margin-top: 12px;
              max-height: 120px;
              overflow-y: auto;
            ">
              ${item.description.substring(0, 300)}${item.description.length > 300 ? '...' : ''}
            </div>
          `
              : ''
          }

          <!-- Technical Info -->
          <div style="
            margin-top: 16px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 12px;
            padding-top: 12px;
            border-top: 1px solid #333;
          ">
            ${
              item.mass
                ? `
              <div>
                <div style="color: #666; font-size: 11px; text-transform: uppercase;">Mass</div>
                <div style="color: #ccc; font-size: 14px; font-weight: 600;">
                  ${Number(item.mass).toLocaleString()} kg
                </div>
              </div>
            `
                : ''
            }
            ${
              item.volume
                ? `
              <div>
                <div style="color: #666; font-size: 11px; text-transform: uppercase;">Volume</div>
                <div style="color: #ccc; font-size: 14px; font-weight: 600;">
                  ${Number(item.volume).toLocaleString()} m³
                </div>
              </div>
            `
                : ''
            }
            ${
              item.capacity
                ? `
              <div>
                <div style="color: #666; font-size: 11px; text-transform: uppercase;">Capacity</div>
                <div style="color: #ccc; font-size: 14px; font-weight: 600;">
                  ${Number(item.capacity).toLocaleString()} m³
                </div>
              </div>
            `
                : ''
            }
            ${
              item.portionSize && item.portionSize > 1
                ? `
              <div>
                <div style="color: #666; font-size: 11px; text-transform: uppercase;">Portion Size</div>
                <div style="color: #ccc; font-size: 14px; font-weight: 600;">
                  ${Number(item.portionSize).toLocaleString()}
                </div>
              </div>
            `
                : ''
            }
          </div>

          <!-- Type ID -->
          <div style="margin-top: 12px; color: #666; font-size: 12px;">
            Type ID: ${item.typeId}
          </div>
        </div>
      </div>
    </div>
  `;
}

function _renderItemList(items: any[], query?: string): string {
  return `
    <div style="margin: 16px 0;">
      <h3 style="color: #fff; margin-bottom: 12px; font-size: 18px;">
        🔍 Found ${items.length} items${query ? ` matching "${query}"` : ''}
      </h3>
      <div style="display: grid; gap: 8px;">
        ${items
          .map(
            (item: any) => `
          <div style="
            display: flex;
            align-items: center;
            gap: 12px;
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 12px;
            transition: background 0.2s;
          " onmouseover="this.style.background='#222'" onmouseout="this.style.background='#1a1a1a'">
            <img 
              src="https://images.evetech.net/types/${item.typeId}/icon?size=64" 
              alt="${item.name}"
              style="
                width: 48px;
                height: 48px;
                border-radius: 6px;
                background: #000;
                border: 1px solid #444;
              "
            />
            <div style="flex: 1;">
              <div style="color: #fff; font-weight: 600; font-size: 15px;">${item.name}</div>
              <div style="color: #666; font-size: 12px;">Type ID: ${item.typeId}</div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

import type { AIToolDefinition, AIToolResult, AIToolContext } from '../types';
import {
  parseEFT,
  parseSimpleItem,
  isEFTFormat,
} from '../../helpers/eft-parser';
import { priceFitting, priceItem } from '../../helpers/fitting-pricer';

export const definition: AIToolDefinition = {
  type: 'function',
  function: {
    name: 'price_fitting',
    description:
      'Calculate the ISK value of ship fittings or individual items using current market prices. Supports EFT format fittings (e.g., "[Raven, Fit Name]\\nModules...") or simple item names (e.g., "Raven", "PLEX"). Returns total value, item breakdown, and formatted price card. Use when users ask "how much is X worth?", "price this fit", or "what\'s the value of Y?"',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description:
            'Either an EFT format fitting (starting with [ShipType, FitName]) or a simple item/ship name',
        },
        region_id: {
          type: 'number',
          description:
            'Market region ID for pricing (default: 10000002 = The Forge/Jita)',
          default: 10000002,
        },
      },
      required: ['text'],
    },
  },
};

export async function execute(
  params: {
    text: string;
    region_id?: number;
  },
  context: AIToolContext
): Promise<AIToolResult> {
  try {
    const regionId = params.region_id || 10000002;

    if (!params.text || typeof params.text !== 'string') {
      return {
        html: '<div style="color: #f44;">Error: Missing or invalid text parameter</div>',
        stats: { error: 'Invalid input' },
      };
    }

    // Detect format and parse
    if (isEFTFormat(params.text)) {
      // EFT format fitting
      const parsed = parseEFT(params.text);
      if (!parsed) {
        return {
          html: '<div style="color: #f44;">Error: Invalid EFT format</div>',
          stats: { error: 'Invalid EFT format' },
        };
      }

      const priced = await priceFitting(parsed, regionId);

      return {
        html: renderFittingCard(priced),
        stats: {
          type: 'fitting',
          ship: priced.shipType,
          fit_name: priced.fitName,
          total_value: priced.totalValue,
          items_found: priced.itemsFound,
          items_not_found: priced.itemsNotFound,
          region_id: priced.regionId,
        },
      };
    } else {
      // Simple item name
      const parsed = parseSimpleItem(params.text);
      if (!parsed) {
        return {
          html: '<div style="color: #f44;">Error: Could not parse item name</div>',
          stats: { error: 'Invalid item name' },
        };
      }

      const priced = await priceItem(parsed.name, parsed.quantity, regionId);

      return {
        html: renderItemCard(priced),
        stats: {
          type: 'item',
          item: priced.name,
          type_id: priced.typeId,
          total_value: priced.totalPrice,
          found: priced.found,
        },
      };
    }
  } catch (error: any) {
    context.logger?.error?.('[price-fitting] Error:', error);
    return {
      html: `<div style="color: #f44;">Error calculating price: ${error.message}</div>`,
      stats: { error: error.message },
    };
  }
}

function renderFittingCard(priced: any): string {
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const slotGroups = {
    low: [] as any[],
    mid: [] as any[],
    high: [] as any[],
    rig: [] as any[],
    drone: [] as any[],
    cargo: [] as any[],
  };

  // Group items by slot
  for (const item of priced.items) {
    const slot = item.slot || 'cargo';
    if (slotGroups[slot as keyof typeof slotGroups]) {
      slotGroups[slot as keyof typeof slotGroups].push(item);
    }
  }

  const renderItemGroup = (title: string, items: any[]) => {
    if (items.length === 0) return '';

    const itemsHTML = items
      .map((item) => {
        const priceColor = item.found ? '#0f0' : '#666';
        const icon = item.found ? '✓' : '✗';
        return `
        <tr>
          <td style="color: #ccc; padding: 4px 8px;">${icon} ${escapeHtml(item.name)} ${item.quantity > 1 ? `x${item.quantity}` : ''}</td>
          <td style="color: ${priceColor}; padding: 4px 8px; text-align: right; font-weight: 600;">${formatter.format(item.totalPrice)} ISK</td>
        </tr>
      `;
      })
      .join('');

    return `
      <tr style="background: #1a1a1a;">
        <td colspan="2" style="padding: 8px; font-weight: 700; color: #0af; text-transform: uppercase; font-size: 12px;">${title}</td>
      </tr>
      ${itemsHTML}
    `;
  };

  return `
    <div style="
      background: linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 100%);
      border: 1px solid #333;
      border-radius: 12px;
      padding: 20px;
      margin: 16px 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    ">
      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 5px 0; color: #fff; font-size: 24px; font-weight: 700;">
          🚀 ${escapeHtml(priced.shipType)}
        </h3>
        <p style="margin: 0; color: #888; font-size: 14px;">${escapeHtml(priced.fitName)}</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
        <tbody>
          ${renderItemGroup('Low Slots', slotGroups.low)}
          ${renderItemGroup('Mid Slots', slotGroups.mid)}
          ${renderItemGroup('High Slots', slotGroups.high)}
          ${renderItemGroup('Rigs', slotGroups.rig)}
          ${renderItemGroup('Drones', slotGroups.drone)}
          ${renderItemGroup('Cargo/Ammo', slotGroups.cargo)}
        </tbody>
      </table>

      <div style="border-top: 2px solid #333; padding-top: 15px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <strong style="font-size: 20px; color: #fff;">Total Value:</strong>
          <strong style="font-size: 20px; color: #0f0;">${formatter.format(priced.totalValue)} ISK</strong>
        </div>
        <div style="font-size: 12px; color: #666;">
          ${priced.itemsFound} items priced, ${priced.itemsNotFound} not found •
          Region: ${priced.regionId === 10000002 ? 'The Forge (Jita)' : priced.regionId}
        </div>
      </div>
    </div>
  `;
}

function renderItemCard(priced: any): string {
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const statusIcon = priced.found ? '✓' : '✗';
  const statusText = priced.found ? 'Price found' : 'Price not available';
  const statusColor = priced.found ? '#0f0' : '#666';
  const imageUrl = priced.typeId
    ? `https://images.eve-kill.com/types/${priced.typeId}/icon?size=128`
    : '';

  return `
    <div style="
      background: linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 100%);
      border: 1px solid #333;
      border-radius: 12px;
      padding: 20px;
      margin: 16px 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    ">
      <div style="display: flex; gap: 20px; align-items: start; margin-bottom: 20px;">
        ${
          imageUrl
            ? `
          <img
            src="${imageUrl}"
            alt="${escapeHtml(priced.name)}"
            style="
              width: 96px;
              height: 96px;
              border-radius: 8px;
              background: #000;
              border: 2px solid #444;
            "
          />
        `
            : ''
        }
        <div style="flex: 1;">
          <h3 style="margin: 0 0 5px 0; color: #fff; font-size: 24px; font-weight: 700;">
            💰 ${escapeHtml(priced.name)}
          </h3>
          <p style="margin: 0; color: ${statusColor}; font-size: 14px;">${statusIcon} ${statusText}</p>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
        <tbody>
          <tr>
            <td style="color: #888; padding: 8px 0;">Quantity:</td>
            <td style="color: #fff; padding: 8px 0; text-align: right; font-weight: 600;">${priced.quantity}</td>
          </tr>
          <tr>
            <td style="color: #888; padding: 8px 0;">Unit Price:</td>
            <td style="color: ${statusColor}; padding: 8px 0; text-align: right; font-weight: 600;">${formatter.format(priced.unitPrice)} ISK</td>
          </tr>
        </tbody>
      </table>

      <div style="border-top: 2px solid #333; padding-top: 15px;">
        <div style="display: flex; justify-content: space-between;">
          <strong style="font-size: 20px; color: #fff;">Total Value:</strong>
          <strong style="font-size: 20px; color: ${statusColor};">${formatter.format(priced.totalPrice)} ISK</strong>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

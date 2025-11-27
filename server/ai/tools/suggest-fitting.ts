import type { AITool, AIToolResult, AIToolContext } from '../types';

const _HIGH_FLAGS = [27, 28, 29, 30, 31, 32, 33, 34];
const _MID_FLAGS = [19, 20, 21, 22, 23, 24, 25, 26];
const _LOW_FLAGS = [11, 12, 13, 14, 15, 16, 17, 18];
const _RIG_FLAGS = [92, 93, 94];

export const definition: AITool['definition'] = {
  type: 'function',
  function: {
    name: 'suggest_fitting',
    description:
      'Suggests a popular PvP fitting for a ship based on killmails from the last 30 days. Returns the most common high/mid/low slot modules across recent losses of that hull.',
    parameters: {
      type: 'object',
      properties: {
        ship_type_id: {
          type: 'number',
          description:
            'Exact ship type ID to analyze. Prefer this when available to avoid name ambiguity.',
        },
        ship_name: {
          type: 'string',
          description:
            'Ship name (e.g., "Raven"). Used to look up the type ID if ship_type_id is not provided.',
        },
        limit_per_slot: {
          type: 'number',
          description:
            'Maximum modules to return per slot group (default 8, max 12).',
        },
      },
      required: [],
    },
  },
};

export async function execute(
  args: any,
  context: AIToolContext
): Promise<AIToolResult> {
  const { database } = context;
  const sql = database.sql;

  let shipTypeId = args.ship_type_id as number | undefined;
  const slotLimit = Math.min(Math.max(args.limit_per_slot || 12, 1), 20);

  // Resolve ship by name if needed
  if (!shipTypeId && args.ship_name) {
    const shipRows = await sql`
      SELECT "typeId", name
      FROM types
      WHERE LOWER(name) = LOWER(${args.ship_name})
      LIMIT 1
    `;

    if (shipRows.length === 0) {
      return { error: `Ship "${args.ship_name}" not found` };
    }

    shipTypeId = shipRows[0].typeId;
  }

  if (!shipTypeId) {
    return {
      error: 'Provide a ship_type_id or ship_name to analyze a fitting.',
    };
  }

  const [shipMeta] = await sql`
    SELECT t.name, t."groupId", g.name AS "groupName", t.mass, t.capacity, t.volume, t.description, t."raceId", r.name AS "raceName"
    FROM types t
    LEFT JOIN groups g ON g."groupId" = t."groupId"
    LEFT JOIN races r ON r."raceId" = t."raceId"
    WHERE t."typeId" = ${shipTypeId}
    LIMIT 1
  `;

  // How many relevant killmails exist in the last 30 days?
  const [{ count: killmailCount }] = await sql`
    SELECT COUNT(*)::INT AS count
    FROM killmails
    WHERE "killmailTime" >= NOW() - INTERVAL '30 days'
      AND "victimShipTypeId" = ${shipTypeId}
  `;

  if (Number(killmailCount) === 0) {
    return {
      html: `<div style="color:#999;">No recent losses for this hull in the last 30 days.</div>`,
      stats: { shipTypeId, killmails_sampled: 0 },
    };
  }

  // Gather most common modules per slot (high/mid/low) from recent victim fits
  const rows = await sql`
    WITH recent AS (
      SELECT "killmailId"
      FROM killmails
      WHERE "killmailTime" >= NOW() - INTERVAL '30 days'
        AND "victimShipTypeId" = ${shipTypeId}
      ORDER BY "killmailTime" DESC
    ),
    slot_items AS (
      SELECT
        CASE
          WHEN i."flag" BETWEEN 27 AND 34 THEN 'high'
          WHEN i."flag" BETWEEN 19 AND 26 THEN 'mid'
          WHEN i."flag" BETWEEN 11 AND 18 THEN 'low'
          WHEN i."flag" BETWEEN 92 AND 94 THEN 'rig'
          ELSE NULL
        END AS slot,
        i."itemTypeId" AS "typeId",
        COUNT(DISTINCT i."killmailId") AS usage_count
      FROM items i
      JOIN recent r ON r."killmailId" = i."killmailId"
      JOIN types t ON t."typeId" = i."itemTypeId"
      JOIN groups g ON g."groupId" = t."groupId"
      WHERE i."itemTypeId" IS NOT NULL
        AND i."flag" BETWEEN 11 AND 94
        AND g."categoryId" != 8 -- exclude charges/ammo so only modules remain
      GROUP BY slot, i."itemTypeId"
    )
    SELECT slot, s."typeId", t.name, g.name AS "groupName", s.usage_count
    FROM (
      SELECT
        slot,
        "typeId",
        usage_count,
        ROW_NUMBER() OVER (
          PARTITION BY slot
          ORDER BY usage_count DESC, "typeId" ASC
        ) AS rn
      FROM slot_items
      WHERE slot IS NOT NULL
    ) s
    JOIN types t ON t."typeId" = s."typeId"
    LEFT JOIN groups g ON g."groupId" = t."groupId"
    WHERE s.rn <= ${slotLimit}
    ORDER BY slot, usage_count DESC, t.name ASC
  `;

  const high: any[] = [];
  const mid: any[] = [];
  const low: any[] = [];
  const rigs: any[] = [];

  for (const row of rows) {
    const slot = String(row.slot);
    const entry = {
      typeId: Number(row.typeId),
      name: row.name as string,
      groupName: row.groupName as string | null,
      usageCount: Number(row.usage_count),
    };

    if (slot === 'high') high.push(entry);
    else if (slot === 'mid') mid.push(entry);
    else if (slot === 'low') low.push(entry);
    else if (slot === 'rig') rigs.push(entry);
  }

  const renderSlot = (title: string, items: any[]) => {
    if (items.length === 0)
      return `<div style="color:#777;">No common ${title.toLowerCase()} modules found.</div>`;

    const list = items
      .map(
        (item) =>
          `<li style="margin:6px 0;"><strong>${item.name}</strong>${item.groupName ? ` <span style="color:#888;">(${item.groupName})</span>` : ''}</li>`
      )
      .join('');

    return `<div style="margin-bottom:10px;"><div style="font-weight:700; color:#4a9eff; margin-bottom:6px;">${title}</div><ul style="margin:0 0 0 16px; padding:0; color:#ccc; font-size:12px;">${list}</ul></div>`;
  };

  const slotStats = await sql`
    WITH recent AS (
      SELECT "killmailId"
      FROM killmails
      WHERE "killmailTime" >= NOW() - INTERVAL '30 days'
        AND "victimShipTypeId" = ${shipTypeId}
    ),
    per_km AS (
      SELECT
        i."killmailId",
        COUNT(DISTINCT CASE WHEN i."flag" BETWEEN 27 AND 34 THEN i."flag" END) AS high_count,
        COUNT(DISTINCT CASE WHEN i."flag" BETWEEN 19 AND 26 THEN i."flag" END) AS mid_count,
        COUNT(DISTINCT CASE WHEN i."flag" BETWEEN 11 AND 18 THEN i."flag" END) AS low_count,
        COUNT(DISTINCT CASE WHEN i."flag" BETWEEN 92 AND 94 THEN i."flag" END) AS rig_count
      FROM items i
      JOIN recent r ON r."killmailId" = i."killmailId"
      JOIN types t ON t."typeId" = i."itemTypeId"
      JOIN groups g ON g."groupId" = t."groupId"
      WHERE i."itemTypeId" IS NOT NULL
        AND i."flag" BETWEEN 11 AND 94
        AND g."categoryId" != 8
      GROUP BY i."killmailId"
    )
    SELECT
      percentile_cont(0.5) WITHIN GROUP (ORDER BY high_count) AS high_median,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY mid_count) AS mid_median,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY low_count) AS low_median,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY rig_count) AS rig_median,
      avg(high_count) AS high_avg,
      avg(mid_count) AS mid_avg,
      avg(low_count) AS low_avg,
      avg(rig_count) AS rig_avg
    FROM per_km
  `;

  const slotSummary = slotStats[0] || {};

  const slotCounts = {
    high: clampCount(
      Math.round(Number(slotSummary.high_median ?? 0)) ||
        Math.round(Number(slotSummary.high_avg ?? 0)),
      0,
      8
    ),
    mid: clampCount(
      Math.round(Number(slotSummary.mid_median ?? 0)) ||
        Math.round(Number(slotSummary.mid_avg ?? 0)),
      0,
      8
    ),
    low: clampCount(
      Math.round(Number(slotSummary.low_median ?? 0)) ||
        Math.round(Number(slotSummary.low_avg ?? 0)),
      0,
      8
    ),
    rig: clampCount(
      Math.round(Number(slotSummary.rig_median ?? 0)) ||
        Math.round(Number(slotSummary.rig_avg ?? 0)),
      0,
      3
    ),
  };

  const topHigh = high.slice(0, slotCounts.high || 1);
  const topMid = mid.slice(0, slotCounts.mid || 1);
  const topLow = low.slice(0, slotCounts.low || 1);
  const topRig = rigs.slice(0, slotCounts.rig || 1);

  const hullMeta = shipMeta
    ? `<div style="margin-bottom:10px; color:#ccc; font-size:12px;">
        <strong>${shipMeta.name || 'This hull'}</strong>${shipMeta.groupName ? ` <span style="color:#888;">(${shipMeta.groupName})</span>` : ''}
        <div style="color:#888;">Mass: ${formatNumber(shipMeta.mass)} kg | Volume: ${formatNumber(shipMeta.volume)} m³ | Capacity: ${formatNumber(shipMeta.capacity)} m³</div>
      </div>`
    : '';

  const html = `
    <div style="margin: 12px 0; padding: 16px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px;">
      <div style="color: #999; font-size: 12px; margin-bottom: 10px;">
        Based on ${killmailCount} losses in the last 30 days (victim fits only).
      </div>
      ${hullMeta}
      ${renderSlot('High Slots', topHigh)}
      ${renderSlot('Mid Slots', topMid)}
      ${renderSlot('Low Slots', topLow)}
      ${renderSlot('Rig Slots', topRig)}
    </div>
  `;

  return {
    html,
    stats: {
      shipTypeId,
      killmails_sampled: Number(killmailCount),
      high: high.length,
      mid: mid.length,
      low: low.length,
      rig: rigs.length,
      slot_summary: {
        high: slotSummary.high_median ?? 0,
        mid: slotSummary.mid_median ?? 0,
        low: slotSummary.low_median ?? 0,
        rig: slotSummary.rig_median ?? 0,
      },
      mass: shipMeta?.mass ?? null,
      capacity: shipMeta?.capacity ?? null,
      volume: shipMeta?.volume ?? null,
      slot_counts_used: slotCounts,
      ship: {
        name: shipMeta?.name || null,
        description: shipMeta?.description || null,
        raceId: shipMeta?.raceId || null,
        raceName: shipMeta?.raceName || null,
      },
    },
  };
}

function formatNumber(value: number | null | undefined): string {
  if (value == null) return 'n/a';
  if (Math.abs(value) >= 1_000_000_000)
    return `${(value / 1_000_000_000).toFixed(2)}b`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}m`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
}

function clampCount(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

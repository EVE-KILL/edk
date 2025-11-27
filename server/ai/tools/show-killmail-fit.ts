import type { AITool, AIToolResult, AIToolContext } from '../types';

const HIGH_SLOT_FLAGS = [27, 28, 29, 30, 31, 32, 33, 34];
const MID_SLOT_FLAGS = [19, 20, 21, 22, 23, 24, 25, 26];
const LOW_SLOT_FLAGS = [11, 12, 13, 14, 15, 16, 17, 18];
const RIG_SLOT_FLAGS = [92, 93, 94];
const SUBSYSTEM_FLAGS = [125, 126, 127, 128];
const AMMO_CATEGORY_ID = 8;

export const definition: AITool['definition'] = {
  type: 'function',
  function: {
    name: 'show_killmail_fit',
    description:
      'Show a killmail with the fitting wheel (same as /killmail page). Provide a killmail_id or a ship name to fetch a recent example.',
    parameters: {
      type: 'object',
      properties: {
        killmail_id: {
          type: 'number',
          description: 'Exact killmail ID to render with fitting wheel.',
        },
        ship_name: {
          type: 'string',
          description:
            'Ship name to find a recent loss (e.g., "Ragnarok", "Erebus"). Used if killmail_id is not provided.',
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
  const { database, render } = context;
  const sql = database.sql;

  let killmailId = args.killmail_id as number | undefined;

  if (!killmailId && args.ship_name) {
    const km = await sql`
      SELECT k."killmailId"
      FROM killmails k
      JOIN types t ON k."victimShipTypeId" = t."typeId"
      WHERE LOWER(t.name) LIKE LOWER(${`%${args.ship_name}%`})
      ORDER BY k."killmailTime" DESC
      LIMIT 1
    `;
    if (km.length === 0) {
      return { error: `No killmail found for ship "${args.ship_name}"` };
    }
    killmailId = km[0].killmailId;
  }

  if (!killmailId) {
    return { error: 'Provide a killmail_id or ship_name to show a fitting.' };
  }

  const [km] = await sql`
    SELECT 
      k."killmailId",
      k."killmailTime",
      k."totalValue",
      k."victimShipTypeId",
      t.name AS "shipName",
      t.description AS "shipDescription",
      t."raceId" AS "shipRaceId",
      r.name AS "shipRaceName",
      s."solarSystemId",
      s.name AS "systemName",
      s."securityStatus" AS "systemSecurity",
      v.name AS "victimName",
      v."characterId" AS "victimId",
      c.name AS "corpName",
      c."corporationId" AS "corpId",
      a.name AS "allianceName",
      a."allianceId" AS "allianceId"
    FROM killmails k
    LEFT JOIN types t ON k."victimShipTypeId" = t."typeId"
    LEFT JOIN races r ON t."raceId" = r."raceId"
    LEFT JOIN solarsystems s ON k."solarSystemId" = s."solarSystemId"
    LEFT JOIN characters v ON k."victimCharacterId" = v."characterId"
    LEFT JOIN corporations c ON k."victimCorporationId" = c."corporationId"
    LEFT JOIN alliances a ON k."victimAllianceId" = a."allianceId"
    WHERE k."killmailId" = ${killmailId}
    LIMIT 1
  `;

  if (!km) {
    return { error: `Killmail ${killmailId} not found` };
  }

  const items = await sql`
    SELECT 
      i."itemTypeId",
      i."quantityDropped",
      i."quantityDestroyed",
      i."flag",
      i."singleton",
      t.name,
      t."groupId",
      t.description,
      t."raceId",
      r.name AS "raceName",
      g."categoryId"
    FROM items i
    JOIN types t ON t."typeId" = i."itemTypeId"
    LEFT JOIN groups g ON g."groupId" = t."groupId"
    LEFT JOIN races r ON r."raceId" = t."raceId"
    WHERE i."killmailId" = ${killmailId}
      AND i."flag" BETWEEN 0 AND 200
  `;

  const fittingWheel = buildFittingWheel(items);

  const body = await render(
    'partials/fitting-wheel.hbs',
    {},
    { victim: buildVictim(km), fittingWheel },
    undefined,
    false
  );

  const summary = `
    <div style="margin-bottom:8px; color:#ccc; font-size:12px;">
      <strong>${km.shipName || 'Unknown Ship'}</strong> lost in 
      <a href="/system/${km.solarSystemId}" style="color:#4a9eff; text-decoration:none;">${km.systemName || 'Unknown'}</a>
      • ${new Date(km.killmailTime).toLocaleString()}
      • Value: ${(Number(km.totalValue) / 1_000_000_000).toFixed(2)}B ISK
    </div>
  `;

  const html = `
    <div style="margin:12px 0; padding:12px; background:#0f0f0f; border:1px solid #2a2a2a; border-radius:8px;">
      ${summary}
      ${body}
    </div>
  `;

  return {
    html,
    stats: {
      killmailId: km.killmailId,
      shipTypeId: km.victimShipTypeId,
      ship: {
        name: km.shipName,
        description: km.shipDescription || null,
        raceId: km.shipRaceId || null,
        raceName: km.shipRaceName || null,
      },
      slot_counts: {
        high: fittingWheel.highSlots.length,
        mid: fittingWheel.medSlots.length,
        low: fittingWheel.lowSlots.length,
        rig: fittingWheel.rigSlots.length,
        sub: fittingWheel.subSlots.length,
      },
    },
  };
}

function buildVictim(km: any) {
  return {
    ship: {
      typeId: km.victimShipTypeId,
      name: km.shipName || 'Unknown',
    },
    character: {
      id: km.victimId || null,
      name: km.victimName || 'Unknown',
    },
    corporation: {
      id: km.corpId || null,
      name: km.corpName || null,
    },
    alliance: {
      id: km.allianceId || null,
      name: km.allianceName || null,
    },
  };
}

function buildFittingWheel(items: any[]) {
  const modulesByFlag = new Map<number, any>();
  const ammoByFlag = new Map<number, any>();

  for (const item of items) {
    if (item.categoryId === AMMO_CATEGORY_ID) {
      if (!ammoByFlag.has(item.flag)) ammoByFlag.set(item.flag, item);
      continue;
    }
    if (!modulesByFlag.has(item.flag)) {
      modulesByFlag.set(item.flag, item);
    }
  }

  const makeSlot = (item: any, flag: number) => {
    const ammoItem = ammoByFlag.get(flag);
    return {
      typeId: item.itemTypeId,
      name: item.name || 'Unknown',
      quantity: item.quantityDropped + item.quantityDestroyed,
      quantityDropped: item.quantityDropped,
      quantityDestroyed: item.quantityDestroyed,
      flag,
      slotName: `Slot ${flag}`,
      isDestroyed: item.quantityDestroyed > 0,
      description: item.description || null,
      raceId: item.raceId || null,
      raceName: item.raceName || null,
      ammo: ammoItem
        ? {
            typeId: ammoItem.itemTypeId,
            name: ammoItem.name || 'Unknown',
            quantity: ammoItem.quantityDropped + ammoItem.quantityDestroyed,
            quantityDropped: ammoItem.quantityDropped,
            quantityDestroyed: ammoItem.quantityDestroyed,
            flag,
            isDestroyed: ammoItem.quantityDestroyed > 0,
            description: ammoItem.description || null,
            raceId: ammoItem.raceId || null,
            raceName: ammoItem.raceName || null,
          }
        : undefined,
    };
  };

  const fittingWheel = {
    highSlots: [] as any[],
    medSlots: [] as any[],
    lowSlots: [] as any[],
    rigSlots: [] as any[],
    subSlots: [] as any[],
  };

  HIGH_SLOT_FLAGS.forEach((flag) => {
    const item = modulesByFlag.get(flag);
    if (item) fittingWheel.highSlots.push(makeSlot(item, flag));
  });
  MID_SLOT_FLAGS.forEach((flag) => {
    const item = modulesByFlag.get(flag);
    if (item) fittingWheel.medSlots.push(makeSlot(item, flag));
  });
  LOW_SLOT_FLAGS.forEach((flag) => {
    const item = modulesByFlag.get(flag);
    if (item) fittingWheel.lowSlots.push(makeSlot(item, flag));
  });
  RIG_SLOT_FLAGS.forEach((flag) => {
    const item = modulesByFlag.get(flag);
    if (item) fittingWheel.rigSlots.push(makeSlot(item, flag));
  });
  SUBSYSTEM_FLAGS.forEach((flag) => {
    const item = modulesByFlag.get(flag);
    if (item) fittingWheel.subSlots.push(makeSlot(item, flag));
  });

  return fittingWheel;
}

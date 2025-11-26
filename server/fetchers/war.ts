import { fetchESI } from '../helpers/esi';
import { logger } from '../helpers/logger';
import { enqueueJobMany, JobPriority, QueueType } from '../helpers/queue';
import { database } from '../helpers/database';
import { fetchAndStoreAlliance } from './alliance';
import { fetchAndStoreCorporation } from './corporation';
import {
  ESIWar,
  ESIWarAlly,
  getExistingWarIds,
  upsertWar,
} from '../models/wars';

export interface WarKillmail {
  killmail_id: number;
  killmail_hash: string;
}

export async function fetchWarIds(page = 1): Promise<number[]> {
  const response = await fetchESI<number[]>(`/wars/?page=${page}`);

  if (!response.ok) {
    logger.warn(
      `[war] Failed to fetch wars page ${page} (status ${response.status})`
    );
    return [];
  }

  return response.data ?? [];
}

export async function fetchWarDetails(warId: number): Promise<ESIWar | null> {
  const response = await fetchESI<ESIWar>(`/wars/${warId}/`);

  if (response.status === 404) {
    logger.warn(`[war] War ${warId} not found (404)`);
    return null;
  }

  if (!response.ok || !response.data) {
    logger.warn(
      `[war] Failed to fetch war ${warId} (status ${response.status})`
    );
    return null;
  }

  return response.data;
}

async function fetchWarKillmailPage(
  warId: number,
  page: number
): Promise<WarKillmail[]> {
  const response = await fetchESI<WarKillmail[]>(
    `/wars/${warId}/killmails/?page=${page}`
  );

  if (response.status === 404) {
    // No killmails for this war
    return [];
  }

  if (!response.ok) {
    logger.warn(
      `[war] Failed to fetch killmails for war ${warId} page ${page} (status ${response.status})`
    );
    return [];
  }

  return response.data ?? [];
}

async function ensureWarEntities(
  war: ESIWar,
  allies: ESIWarAlly[]
): Promise<void> {
  const allianceIds = new Set<number>();
  const corporationIds = new Set<number>();

  if (war.aggressor?.alliance_id) allianceIds.add(war.aggressor.alliance_id);
  if (war.aggressor?.corporation_id)
    corporationIds.add(war.aggressor.corporation_id);
  if (war.defender?.alliance_id) allianceIds.add(war.defender.alliance_id);
  if (war.defender?.corporation_id)
    corporationIds.add(war.defender.corporation_id);

  for (const ally of allies) {
    if (ally.alliance_id) allianceIds.add(ally.alliance_id);
    if (ally.corporation_id) corporationIds.add(ally.corporation_id);
  }

  await Promise.all([
    ...Array.from(allianceIds).map((id) => fetchAndStoreAlliance(id)),
    ...Array.from(corporationIds).map((id) => fetchAndStoreCorporation(id)),
  ]);
}

export async function syncWarKillmailsList(
  warId: number,
  killmails: WarKillmail[]
): Promise<{ queued: number; updated: number }> {
  if (killmails.length === 0) {
    return { queued: 0, updated: 0 };
  }

  const killmailIds = killmails.map((k) => k.killmail_id);
  const existing = await database.find<{
    killmailId: number;
    warId: number | null;
  }>(
    'SELECT "killmailId", "warId" FROM killmails WHERE "killmailId" = ANY(:ids)',
    { ids: killmailIds }
  );

  const existingMap = new Map<number, number | null>();
  for (const row of existing) {
    existingMap.set(row.killmailId, row.warId ?? null);
  }

  const missing: WarKillmail[] = [];
  const needsUpdate: number[] = [];

  for (const killmail of killmails) {
    const current = existingMap.get(killmail.killmail_id);
    if (current === undefined) {
      missing.push(killmail);
    } else if (current === null) {
      needsUpdate.push(killmail.killmail_id);
    }
  }

  let updated = 0;
  if (needsUpdate.length > 0) {
    await database.execute(
      'UPDATE killmails SET "warId" = :warId WHERE "killmailId" = ANY(:ids) AND "warId" IS NULL',
      { warId, ids: needsUpdate }
    );
    updated = needsUpdate.length;
  }

  if (missing.length > 0) {
    await enqueueJobMany(
      QueueType.KILLMAIL,
      missing.map((km) => ({
        killmailId: km.killmail_id,
        hash: km.killmail_hash,
        warId,
      })),
      { priority: JobPriority.NORMAL }
    );
  }

  return { queued: missing.length, updated };
}

async function syncWarKillmails(warId: number): Promise<{
  queued: number;
  updated: number;
}> {
  let page = 1;
  let queued = 0;
  let updated = 0;

  while (true) {
    const killmails = await fetchWarKillmailPage(warId, page);
    if (killmails.length === 0) {
      break;
    }

    const result = await syncWarKillmailsList(warId, killmails);
    queued += result.queued;
    updated += result.updated;

    page++;
  }

  return { queued, updated };
}

export async function ingestWar(warId: number): Promise<{
  queuedKillmails: number;
  updatedKillmails: number;
  alliesCount: number;
}> {
  const war = await fetchWarDetails(warId);

  if (!war) {
    return { queuedKillmails: 0, updatedKillmails: 0, alliesCount: 0 };
  }

  const allies = war.allies ?? [];

  await ensureWarEntities(war, allies);
  await upsertWar(warId, war);

  const { queued, updated } = await syncWarKillmails(warId);

  return {
    queuedKillmails: queued,
    updatedKillmails: updated,
    alliesCount: allies.length,
  };
}

export async function ingestLatestWarsFirstPage(): Promise<void> {
  const warIds = await fetchWarIds(1);
  if (warIds.length === 0) {
    logger.warn('[war] No wars returned on first page');
    return;
  }

  const existing = await getExistingWarIds(warIds);
  const newIds = warIds.filter((id) => !existing.has(id));

  if (newIds.length === 0) {
    logger.info('[war] No new wars found on first page');
    return;
  }

  logger.info(`[war] Found ${newIds.length} new wars on first page`);

  for (const warId of newIds) {
    try {
      const result = await ingestWar(warId);
      logger.success(
        `[war] added ${warId} (allies ${result.alliesCount}, queued ${result.queuedKillmails}, updated ${result.updatedKillmails})`
      );
    } catch (error) {
      logger.error(`[war] Failed to ingest war ${warId}`, {
        error: String(error),
      });
    }
  }
}

import { fetchESI } from '../helpers/esi';
import { logger } from '../helpers/logger';
import { enqueueJobMany, JobPriority, QueueType } from '../helpers/queue';
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

async function queueWarEntities(
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

  // Queue entities for background processing
  if (allianceIds.size > 0) {
    await enqueueJobMany(
      QueueType.ALLIANCE,
      Array.from(allianceIds).map((id) => ({ id })),
      { priority: JobPriority.LOW }
    );
  }

  if (corporationIds.size > 0) {
    await enqueueJobMany(
      QueueType.CORPORATION,
      Array.from(corporationIds).map((id) => ({ id })),
      { priority: JobPriority.LOW }
    );
  }
}

async function queueWarKillmails(warId: number): Promise<number> {
  let page = 1;
  let totalKillmails = 0;

  while (true) {
    const killmails = await fetchWarKillmailPage(warId, page);
    if (killmails.length === 0) {
      break;
    }

    // Queue all killmails without checking if they exist
    // The killmail processor will handle duplicates
    await enqueueJobMany(
      QueueType.KILLMAIL,
      killmails.map((km) => ({
        killmailId: km.killmail_id,
        hash: km.killmail_hash,
        warId,
      })),
      { priority: JobPriority.NORMAL }
    );

    totalKillmails += killmails.length;
    page++;
  }

  return totalKillmails;
}

export async function ingestWar(warId: number): Promise<{
  queuedKillmails: number;
  alliesCount: number;
}> {
  const war = await fetchWarDetails(warId);

  if (!war) {
    return { queuedKillmails: 0, alliesCount: 0 };
  }

  const allies = war.allies ?? [];

  // Insert war data immediately
  await upsertWar(warId, war);

  // Queue entities and killmails for background processing in parallel
  const [, killmailCount] = await Promise.all([
    queueWarEntities(war, allies),
    queueWarKillmails(warId),
  ]);

  return {
    queuedKillmails: killmailCount,
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
        `[war] added ${warId} (allies ${result.alliesCount}, queued ${result.queuedKillmails})`
      );
    } catch (error) {
      logger.error(`[war] Failed to ingest war ${warId}`, {
        error: String(error),
      });
    }
  }
}

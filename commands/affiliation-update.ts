import { logger } from '../server/helpers/logger';
import { database } from '../server/helpers/database';
import { fetchESI } from '../server/helpers/esi';
import {
  enqueueJob,
  QueueType,
  getQueueStats,
  closeAllQueues,
} from '../server/helpers/queue';

interface CharacterAffiliation {
  characterId: number;
  corporationId: number;
  allianceId: number | null;
}

interface ESIAffiliation {
  character_id: number;
  corporation_id: number;
  alliance_id?: number;
}

/**
 * Fetch affiliations from ESI with recursive splitting on errors
 *
 * The affiliation endpoint returns 400 if ANY character in the batch is deleted/invalid.
 * We recursively split the batch in half until we isolate the problematic characters.
 * After 3 attempts, individual characters are queued for processing.
 */
async function fetchAffiliations(
  characterIds: number[],
  attempt: number = 0
): Promise<ESIAffiliation[]> {
  if (characterIds.length === 0) return [];

  try {
    const response = await fetchESI<ESIAffiliation[]>(
      '/characters/affiliation/',
      {
        method: 'POST',
        body: JSON.stringify(characterIds),
      }
    );

    if (!response.ok || !response.data) {
      throw new Error(`ESI error: ${response.status}`);
    }

    return response.data;
  } catch (error) {
    if (attempt >= 3) {
      // After 3 attempts, queue individual characters for processing
      // This handles both deleted characters and other persistent errors
      logger.warn(
        'Failed to fetch affiliations after 3 attempts, queueing individually',
        {
          characterCount: characterIds.length,
          error: String(error),
        }
      );

      for (const characterId of characterIds) {
        await enqueueJob(QueueType.CHARACTER, { id: characterId });
      }

      return [];
    }

    // Split in half and process both halves recursively
    const half = Math.ceil(characterIds.length / 2);
    const firstHalf = characterIds.slice(0, half);
    const secondHalf = characterIds.slice(half);

    logger.debug('Splitting batch due to error', {
      total: characterIds.length,
      firstHalfSize: firstHalf.length,
      secondHalfSize: secondHalf.length,
      attempt,
    });

    // Process both halves and merge results
    const [firstResults, secondResults] = await Promise.all([
      fetchAffiliations(firstHalf, attempt + 1),
      fetchAffiliations(secondHalf, attempt + 1),
    ]);

    return [...firstResults, ...secondResults];
  }
}

/**
 * Process a chunk of characters and queue updates if needed
 */
async function processChunk(
  characters: CharacterAffiliation[]
): Promise<number> {
  if (characters.length === 0) return 0;

  const characterIds = characters.map((c) => c.characterId);
  const affiliations = await fetchAffiliations(characterIds);

  if (affiliations.length === 0) return 0;

  // Build lookup map
  const originalDataLookup = new Map(characters.map((c) => [c.characterId, c]));

  const updates: number[] = [];
  const unchangedCharacterIds: number[] = [];

  for (const affiliation of affiliations) {
    const characterId = affiliation.character_id;
    const originalData = originalDataLookup.get(characterId);

    if (!originalData) continue;

    const originalAllianceId = originalData.allianceId || 0;
    const newAllianceId = affiliation.alliance_id || 0;

    // Check for corp or alliance change
    if (
      affiliation.corporation_id !== originalData.corporationId ||
      originalAllianceId !== newAllianceId
    ) {
      logger.info('Affiliation change detected', {
        characterId,
        oldCorp: originalData.corporationId,
        newCorp: affiliation.corporation_id,
        oldAlliance: originalAllianceId,
        newAlliance: newAllianceId,
      });

      // Queue updates for character, corporation, and alliance (if present)
      await enqueueJob(QueueType.CHARACTER, { id: characterId });
      await enqueueJob(QueueType.CORPORATION, {
        id: affiliation.corporation_id,
      });
      if (affiliation.alliance_id) {
        await enqueueJob(QueueType.ALLIANCE, { id: affiliation.alliance_id });
      }

      updates.push(characterId);
    } else {
      unchangedCharacterIds.push(characterId);
    }
  }

  // Update updatedAt for ALL characters that got a successful affiliation response
  // This prevents them from being rechecked too soon
  const affiliatedCharacterIds = affiliations.map((a) => a.character_id);
  if (affiliatedCharacterIds.length > 0) {
    await database.sql`
      UPDATE characters
      SET "updatedAt" = NOW()
      WHERE "characterId" = ANY(${affiliatedCharacterIds})
    `;
  }

  return updates.length;
}

async function runAffiliationUpdate() {
  logger.info('Starting character affiliation update');

  // Check if queue is busy
  const stats = await getQueueStats(QueueType.CHARACTER);
  if (stats.waiting > 0 || stats.active > 0) {
    logger.info('Character queue is busy, skipping affiliation update', {
      waiting: stats.waiting,
      active: stats.active,
    });
    return;
  }

  const LIMIT = 10000; // Fetch up to 10k characters (will split into chunks of 1000 for ESI)

  /**
   * Priority-based character selection:
   * 1. Active in last 365 days AND not updated in last 1 day
   * 2. Not active in last 365 days AND not updated in last 14 days
   */

  const queries = [
    {
      name: 'Active characters (365 days)',
      query: database.sql<CharacterAffiliation[]>`
        SELECT
          "characterId",
          "corporationId",
          "allianceId"
        FROM characters
        WHERE "lastActive" > NOW() - INTERVAL '365 days'
          AND ("updatedAt" IS NULL OR "updatedAt" < NOW() - INTERVAL '1 day')
          AND (deleted = FALSE OR deleted IS NULL)
        LIMIT ${LIMIT}
      `,
    },
    {
      name: 'Inactive characters (>365 days)',
      query: database.sql<CharacterAffiliation[]>`
        SELECT
          "characterId",
          "corporationId",
          "allianceId"
        FROM characters
        WHERE ("lastActive" IS NULL OR "lastActive" <= NOW() - INTERVAL '365 days')
          AND ("updatedAt" IS NULL OR "updatedAt" < NOW() - INTERVAL '14 days')
          AND (deleted = FALSE OR deleted IS NULL)
        LIMIT ${LIMIT}
      `,
    },
  ];

  const characters: CharacterAffiliation[] = [];

  for (const { name, query } of queries) {
    const startTime = Date.now();
    const result = await query;
    const queryTime = Date.now() - startTime;

    logger.info(`Query executed: ${name}`, {
      queryTime: `${queryTime}ms`,
      found: result.length,
    });

    characters.push(...result);
  }

  if (characters.length === 0) {
    logger.info('No characters need affiliation update');
    return;
  }

  logger.info(`Found ${characters.length} characters to check`);

  // Split into chunks of 1000 (ESI limit for affiliation endpoint)
  const chunks: CharacterAffiliation[][] = [];
  for (let i = 0; i < characters.length; i += 1000) {
    chunks.push(characters.slice(i, i + 1000));
  }

  let totalQueued = 0;
  for (const chunk of chunks) {
    const queued = await processChunk(chunk);
    totalQueued += queued;
  }

  logger.success('Affiliation update complete', {
    checked: characters.length,
    queued: totalQueued,
  });
}

async function action() {
  try {
    await runAffiliationUpdate();
  } catch (error) {
    logger.error('Affiliation update failed:', { error: String(error) });
    process.exit(1);
  } finally {
    await closeAllQueues();
    await database.close();
    process.exit(0);
  }
}

export const description =
  'Update character affiliations and queue entity updates';
export { action };

import { logger } from '../server/helpers/logger';
import { database } from '../server/helpers/database';
import { fetchESI } from '../server/helpers/esi';
import { enqueueJob, QueueType, getQueueStats } from '../server/helpers/queue';

export const name = 'affiliation-update';
export const description =
  'Updates character affiliations and queues entity updates';
export const schedule = '0 */5 * * * *'; // Every 5 minutes

export async function action() {
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
 * Fetch affiliations from ESI in batches of up to 1000 characters
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
      logger.error('Failed to fetch affiliations after 3 attempts', {
        characterCount: characterIds.length,
        error: String(error),
      });
      // Queue individual characters for update
      for (const characterId of characterIds) {
        await enqueueJob(QueueType.CHARACTER, { id: characterId });
      }
      return [];
    }

    // Split and retry
    const half = Math.ceil(characterIds.length / 2);
    const firstHalf = await fetchAffiliations(
      characterIds.slice(0, half),
      attempt + 1
    );
    const secondHalf = await fetchAffiliations(
      characterIds.slice(half),
      attempt + 1
    );
    return [...firstHalf, ...secondHalf];
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

  // Update updatedAt for unchanged characters so they aren't processed again soon
  if (unchangedCharacterIds.length > 0) {
    await database.sql`
      UPDATE characters
      SET "updatedAt" = NOW()
      WHERE "characterId" = ANY(${unchangedCharacterIds})
    `;
  }

  return updates.length;
}

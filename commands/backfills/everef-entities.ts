import { logger } from '../../server/helpers/logger';
import { storeCharactersBulk } from '../../server/models/characters';
import { storeCorporationsBulk } from '../../server/models/corporations';
import { storeAlliancesBulk } from '../../server/models/alliances';
import { enqueueJobMany, JobPriority } from '../../server/helpers/queue';
import { QueueType } from '../../server/helpers/queue';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { unlink, mkdir } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createInterface } from 'readline';

const execAsync = promisify(exec);

export default {
  description:
    'Import characters, corporations, and alliances from everef.net backfill',
  options: [
    {
      flags: '--url <url>',
      description: 'URL to the backfill archive (default: latest backfill)',
      defaultValue:
        'https://data.everef.net/characters-corporations-alliances/backfills/eve-kill-com-karbowiak-2025-03-13.tar.bz2',
    },
    {
      flags: '--temp-dir <path>',
      description:
        'Temporary directory for extraction (default: /tmp/everef-import)',
      defaultValue: '/tmp/everef-import',
    },
    {
      flags: '--batch-size <number>',
      description: 'Batch size for database inserts (default: 1000)',
      defaultValue: '1000',
    },
    {
      flags: '--enqueue-updates',
      description: 'Enqueue background jobs to update entity details from ESI',
    },
  ],
  action: async (options: {
    url?: string;
    tempDir?: string;
    batchSize?: string;
    enqueueUpdates?: boolean;
  }) => {
    const url =
      options.url ||
      'https://data.everef.net/characters-corporations-alliances/backfills/eve-kill-com-karbowiak-2025-03-13.tar.bz2';
    const tempDir = options.tempDir || '/tmp/everef-import';
    const batchSize = options.batchSize
      ? Number.parseInt(options.batchSize)
      : 1000;
    const enqueueUpdates = options.enqueueUpdates || false;

    logger.info('Starting everef.net entities import', {
      url,
      tempDir,
      batchSize,
      enqueueUpdates,
    });

    const startTime = Date.now();

    try {
      // Create temp directory
      await mkdir(tempDir, { recursive: true });

      const archivePath = `${tempDir}/entities.tar.bz2`;

      // Download archive
      logger.info('Downloading archive...', { url });
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to download: ${response.status} ${response.statusText}`
        );
      }

      const fileStream = createWriteStream(archivePath);
      await pipeline(response.body as any, fileStream);
      logger.success('Archive downloaded', { size: fileStream.bytesWritten });

      // Extract archive
      logger.info('Extracting archive...', { archivePath });
      await execAsync(`tar -xjf ${archivePath} -C ${tempDir}`);
      logger.success('Archive extracted');

      // Process files
      const stats = {
        characters: { processed: 0, stored: 0 },
        corporations: { processed: 0, stored: 0 },
        alliances: { processed: 0, stored: 0 },
      };

      // Process characters
      const charactersFile = `${tempDir}/characters.json`;
      try {
        logger.info('Processing characters...');
        const { processed, stored, queuedIds, invalidLines } =
          await processEntityFile({
            filePath: charactersFile,
            batchSize,
            entityName: 'characters',
            enqueueUpdates,
            mapEntity: (char: any) => {
              const characterId = Number(char.character_id);
              const corporationId = Number(char.corporation_id);

              if (
                !Number.isFinite(characterId) ||
                !Number.isFinite(corporationId)
              ) {
                return null;
              }

              return {
                characterId,
                allianceId: char.alliance_id ?? null,
                birthday: parseNullableDate(char.birthday),
                bloodlineId: char.bloodline_id ?? 0,
                corporationId,
                description: char.description ?? '',
                gender: char.gender ?? '',
                name: char.name,
                raceId: char.race_id ?? 0,
                securityStatus: char.security_status ?? 0,
              };
            },
            collectId: (char: any) => Number(char.character_id),
            storeBatch: storeCharactersBulk,
          });

        stats.characters.processed = processed;
        stats.characters.stored = stored;

        if (invalidLines > 0) {
          logger.warn(`Skipped ${invalidLines} malformed character rows`);
        }

        if (enqueueUpdates && queuedIds.length > 0) {
          logger.info('Enqueuing character update jobs...', {
            count: queuedIds.length,
          });
          await enqueueJobMany(
            QueueType.CHARACTER,
            queuedIds.map((id) => ({ id })),
            { priority: JobPriority.LOW, delay: 60000 }
          );
        }
      } catch (error) {
        logger.warn('Failed to process characters', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Process corporations
      const corporationsFile = `${tempDir}/corporations.json`;
      try {
        logger.info('Processing corporations...');
        const { processed, stored, queuedIds, invalidLines } =
          await processEntityFile({
            filePath: corporationsFile,
            batchSize,
            entityName: 'corporations',
            enqueueUpdates,
            mapEntity: (corp: any) => {
              const corporationId = Number(corp.corporation_id);

              if (!Number.isFinite(corporationId)) {
                return null;
              }

              return {
                corporationId,
                allianceId: corp.alliance_id ?? null,
                ceoId: corp.ceo_id ?? 0,
                creatorId: corp.creator_id ?? 0,
                dateFounded: parseNullableDate(corp.date_founded),
                description: corp.description ?? '',
                homeStationId: corp.home_station_id ?? null,
                memberCount: corp.member_count ?? 0,
                name: corp.name,
                shares: corp.shares ?? 0,
                taxRate: corp.tax_rate ?? 0,
                ticker: corp.ticker ?? '',
                url: corp.url ?? '',
              };
            },
            collectId: (corp: any) => Number(corp.corporation_id),
            storeBatch: storeCorporationsBulk,
          });

        stats.corporations.processed = processed;
        stats.corporations.stored = stored;

        if (invalidLines > 0) {
          logger.warn(`Skipped ${invalidLines} malformed corporation rows`);
        }

        if (enqueueUpdates && queuedIds.length > 0) {
          logger.info('Enqueuing corporation update jobs...', {
            count: queuedIds.length,
          });
          await enqueueJobMany(
            QueueType.CORPORATION,
            queuedIds.map((id) => ({ id })),
            { priority: JobPriority.LOW, delay: 60000 }
          );
        }
      } catch (error) {
        logger.warn('Failed to process corporations', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Process alliances
      const alliancesFile = `${tempDir}/alliances.json`;
      try {
        logger.info('Processing alliances...');
        const { processed, stored, queuedIds, invalidLines } =
          await processEntityFile({
            filePath: alliancesFile,
            batchSize,
            entityName: 'alliances',
            enqueueUpdates,
            mapEntity: (alliance: any) => {
              const allianceId = Number(alliance.alliance_id);

              if (!Number.isFinite(allianceId)) {
                return null;
              }

              return {
                allianceId,
                creatorCorporationId: alliance.creator_corporation_id ?? 0,
                creatorId: alliance.creator_id ?? 0,
                dateFounded: parseNullableDate(alliance.date_founded),
                executorCorporationId: alliance.executor_corporation_id ?? 0,
                name: alliance.name,
                ticker: alliance.ticker ?? '',
              };
            },
            collectId: (alliance: any) => Number(alliance.alliance_id),
            storeBatch: storeAlliancesBulk,
          });

        stats.alliances.processed = processed;
        stats.alliances.stored = stored;

        if (invalidLines > 0) {
          logger.warn(`Skipped ${invalidLines} malformed alliance rows`);
        }

        if (enqueueUpdates && queuedIds.length > 0) {
          logger.info('Enqueuing alliance update jobs...', {
            count: queuedIds.length,
          });
          await enqueueJobMany(
            QueueType.ALLIANCE,
            queuedIds.map((id) => ({ id })),
            { priority: JobPriority.LOW, delay: 60000 }
          );
        }
      } catch (error) {
        logger.warn('Failed to process alliances', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Cleanup
      logger.info('Cleaning up temporary files...');
      await unlink(archivePath);
      await unlink(charactersFile).catch(() => {});
      await unlink(corporationsFile).catch(() => {});
      await unlink(alliancesFile).catch(() => {});

      const totalTime = (Date.now() - startTime) / 1000;
      logger.success('Import complete', {
        totalTime: `${totalTime.toFixed(2)}s`,
        characters: stats.characters,
        corporations: stats.corporations,
        alliances: stats.alliances,
      });

      process.exit(0);
    } catch (error) {
      logger.error('Import failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      process.exit(1);
    }
  },
};

function parseNullableDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : value;
}

async function processEntityFile<T>(params: {
  filePath: string;
  batchSize: number;
  entityName: 'characters' | 'corporations' | 'alliances';
  enqueueUpdates: boolean;
  mapEntity: (raw: any) => T | null;
  collectId?: (raw: any) => number;
  storeBatch: (batch: T[]) => Promise<void>;
}): Promise<{
  processed: number;
  stored: number;
  queuedIds: number[];
  invalidLines: number;
}> {
  const rl = createInterface({
    input: createReadStream(params.filePath),
    crlfDelay: Infinity,
  });

  const queuedIds = new Set<number>();
  let processed = 0;
  let stored = 0;
  let invalidLines = 0;
  let batch: T[] = [];

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line || line === '[' || line === ']' || line === ',') {
      continue;
    }

    // Handle JSON arrays written one object per line (strip trailing comma)
    const normalized = line.endsWith(',') ? line.slice(0, -1) : line;

    let parsed: any;
    try {
      parsed = JSON.parse(normalized);
    } catch {
      invalidLines++;
      continue;
    }

    const entity = params.mapEntity(parsed);
    if (!entity) {
      invalidLines++;
      continue;
    }

    processed++;

    if (params.enqueueUpdates && params.collectId) {
      const id = params.collectId(parsed);
      if (Number.isFinite(id)) {
        queuedIds.add(id);
      }
    }

    batch.push(entity);

    if (batch.length >= params.batchSize) {
      await params.storeBatch(batch);
      stored += batch.length;
      batch = [];
      logger.info(
        `Stored ${stored}/${processed} ${params.entityName} (running total)`
      );
    }
  }

  if (batch.length > 0) {
    await params.storeBatch(batch);
    stored += batch.length;
  }

  return {
    processed,
    stored,
    queuedIds: Array.from(queuedIds),
    invalidLines,
  };
}

import logger from '../../server/helpers/logger';

import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';
import {
  getEntityStats,
  type EntityStats,
} from '../../server/models/entityStats';
import {
  getEntityKillmails,
  countEntityKillmails,
} from '../../server/models/killlist';
import {
  getMostValuableKillsByCharacter,
  getMostValuableKillsByCorporation,
  getMostValuableKillsByAlliance,
} from '../../server/models/mostValuableKills';
import { getCharacterWithCorporationAndAlliance } from '../../server/models/characters';
import { getCorporationWithAlliance } from '../../server/models/corporations';
import { getAlliance } from '../../server/models/alliances';

type EntityCategory = 'stats' | 'killmails' | 'mostValuable' | 'entityInfo';

interface TaskResultInfo {
  rowCount?: number;
  note?: string;
}

interface PerfTask<T = unknown> {
  key: string;
  label: string;
  category: EntityCategory;
  run: () => Promise<T>;
  collectInfo?: (result: T) => TaskResultInfo;
}

interface TaskMeasurement {
  key: string;
  label: string;
  category: EntityCategory;
  durationMs: number;
  rowCount?: number;
  note?: string;
}

interface IterationResult {
  wallTimeMs: number;
  measurements: TaskMeasurement[];
}

interface CommandOptions {
  type?: string;
  id?: string;
  iterations?: string;
  warmup?: string;
  page?: string;
}

export const description =
  'Profile entity page queries (character/corporation/alliance)';

export const options = [
  {
    flags: '--type <type>',
    description:
      'Entity type: character, corporation, or alliance (default: character)',
  },
  {
    flags: '--id <id>',
    description: 'Entity ID to profile (default: 2119234820 for character)',
  },
  {
    flags: '--iterations <count>',
    description: 'Number of measurement iterations to record (default: 3)',
  },
  {
    flags: '--warmup <count>',
    description: 'Warm-up iterations to discard before measuring (default: 1)',
  },
  {
    flags: '--page <number>',
    description: 'Killmail page number to profile (default: 1)',
  },
];

const DEFAULT_ENTITIES = {
  character: 2119234820,
  corporation: 98728601,
  alliance: 99013537,
};

export async function action(options: CommandOptions) {
  const entityType = (options.type?.toLowerCase() || 'character') as
    | 'character'
    | 'corporation'
    | 'alliance';
  if (!['character', 'corporation', 'alliance'].includes(entityType)) {
    throw new Error(`Invalid entity type: ${entityType}`);
  }

  const defaultId = DEFAULT_ENTITIES[entityType];
  const entityId = parsePositive(options.id, defaultId);
  const iterations = parsePositive(options.iterations, 3);
  const warmupIterations = parseNonNegative(options.warmup, 1);
  const page = parsePositive(options.page, 1);

  logger.info('Starting entity page query profiling', {
    entityType,
    entityId,
    iterations,
    warmupIterations,
    page,
  });

  const tasks = createTasks({ entityType, entityId, page });
  const taskStats = new Map<
    string,
    {
      label: string;
      category: EntityCategory;
      durations: number[];
      rowCount?: number;
      note?: string;
    }
  >();
  const categoryStats = new Map<EntityCategory, number[]>();
  const wallTimes: number[] = [];

  try {
    if (warmupIterations > 0) {
      logger.info(
        `Running ${warmupIterations} warm-up iteration${warmupIterations === 1 ? '' : 's'} (results discarded)`
      );
      for (let i = 0; i < warmupIterations; i++) {
        await runIteration(tasks);
      }
    }

    for (let i = 0; i < iterations; i++) {
      const iterationIndex = i + 1;
      logger.info(`Profiling iteration ${iterationIndex}/${iterations}`);
      const iterationResult = await runIteration(tasks);
      wallTimes.push(iterationResult.wallTimeMs);

      const measurementsByDuration = [...iterationResult.measurements].sort(
        (a, b) => b.durationMs - a.durationMs
      );

      logger.info(
        `\nIteration ${iterationIndex} (${formatMs(iterationResult.wallTimeMs)} ms wall time)`
      );
      for (const measurement of measurementsByDuration) {
        const details: string[] = [`${formatMs(measurement.durationMs)} ms`];
        if (measurement.rowCount !== undefined) {
          details.push(`rows=${measurement.rowCount}`);
        }
        if (measurement.note) {
          details.push(measurement.note);
        }
        logger.info(
          `  - ${measurement.label.padEnd(32)} ${details.join(' | ')}`
        );
      }

      const categoryTotals = aggregateByCategory(iterationResult.measurements);
      for (const [category, duration] of categoryTotals.entries()) {
        const list = categoryStats.get(category) ?? [];
        list.push(duration);
        categoryStats.set(category, list);
      }

      for (const measurement of iterationResult.measurements) {
        const stat = taskStats.get(measurement.key) ?? {
          label: measurement.label,
          category: measurement.category,
          durations: [],
        };
        stat.durations.push(measurement.durationMs);
        if (measurement.rowCount !== undefined) {
          stat.rowCount = measurement.rowCount;
        }
        if (measurement.note) {
          stat.note = measurement.note;
        }
        taskStats.set(measurement.key, stat);
      }
    }

    logger.info('\n=== Average duration per task ===');
    printTaskTable(taskStats);

    logger.info('\n=== Average duration by category ===');
    printCategoryTable(categoryStats);

    if (wallTimes.length > 0) {
      const averageWall = average(wallTimes);
      const minWall = Math.min(...wallTimes);
      const maxWall = Math.max(...wallTimes);
      logger.info(
        `\nOverall wall time (parallel fetch): avg=${formatMs(averageWall)} ms | min=${formatMs(minWall)} ms | max=${formatMs(
          maxWall
        )} ms`
      );
    }
  } catch (error) {
    logger.error('Entity page profiling command failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await database.close();
  }
}

function createTasks(params: {
  entityType: 'character' | 'corporation' | 'alliance';
  entityId: number;
  page: number;
}): PerfTask<any>[] {
  const { entityType, entityId, page } = params;
  const perPage = 30;

  const getMostValuable = async () => {
    if (entityType === 'character') {
      return await getMostValuableKillsByCharacter(entityId, 'all');
    } else if (entityType === 'corporation') {
      return await getMostValuableKillsByCorporation(entityId, 'all');
    } else {
      return await getMostValuableKillsByAlliance(entityId, 'all');
    }
  };

  const getEntityInfo = async () => {
    if (entityType === 'character') {
      return await getCharacterWithCorporationAndAlliance(entityId);
    } else if (entityType === 'corporation') {
      return await getCorporationWithAlliance(entityId);
    } else {
      return await getAlliance(entityId);
    }
  };

  return [
    {
      key: 'entity:info',
      label: `${entityType} info (${entityId})`,
      category: 'entityInfo',
      run: getEntityInfo,
      collectInfo: (result) => ({ note: result ? 'found' : 'not found' }),
    },
    {
      key: 'entity:stats',
      label: 'Entity stats (all)',
      category: 'stats',
      run: async () => await getEntityStats(entityId, entityType, 'all'),
      collectInfo: (result: EntityStats | null) => ({
        note: result
          ? `kills=${result.kills}, losses=${result.losses}`
          : 'none',
      }),
    },
    {
      key: 'entity:killmails:list',
      label: `Killmails page ${page} (kills+losses)`,
      category: 'killmails',
      run: async () =>
        await getEntityKillmails(entityId, entityType, 'all', page, perPage),
      collectInfo: (result) => ({
        rowCount: Array.isArray(result) ? result.length : undefined,
      }),
    },
    {
      key: 'entity:killmails:count',
      label: 'Killmails count (kills+losses)',
      category: 'killmails',
      run: async () => await countEntityKillmails(entityId, entityType, 'all'),
      collectInfo: (result) => ({ note: `count=${result}` }),
    },
    {
      key: 'entity:mostValuable',
      label: 'Most valuable kills (all)',
      category: 'mostValuable',
      run: getMostValuable,
      collectInfo: (result) => ({
        rowCount: Array.isArray(result) ? result.length : undefined,
      }),
    },
  ];
}

async function runIteration(tasks: PerfTask[]): Promise<IterationResult> {
  const start = now();

  const measurements = await Promise.all(
    tasks.map(async (task) => {
      const taskStart = now();
      try {
        const result = await task.run();
        const durationMs = now() - taskStart;
        const info = task.collectInfo
          ? task.collectInfo(result)
          : collectDefaultInfo(result);
        return {
          key: task.key,
          label: task.label,
          category: task.category,
          durationMs,
          rowCount: info.rowCount,
          note: info.note,
        };
      } catch (error) {
        const durationMs = now() - taskStart;
        logger.error(`Task "${task.label}" failed`, {
          durationMs: Number(durationMs.toFixed(2)),
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    })
  );

  const wallTimeMs = now() - start;
  return { wallTimeMs, measurements };
}

function aggregateByCategory(
  measurements: TaskMeasurement[]
): Map<EntityCategory, number> {
  const totals = new Map<EntityCategory, number>();
  for (const measurement of measurements) {
    totals.set(
      measurement.category,
      (totals.get(measurement.category) ?? 0) + measurement.durationMs
    );
  }
  return totals;
}

function printTaskTable(stats: Map<string, any>): void {
  const rows: Array<{
    label: string;
    category: string;
    avg: number;
    min: number;
    max: number;
    count: number;
    notes: string;
  }> = [];

  for (const [, stat] of stats) {
    const durations = stat.durations || [];
    if (durations.length === 0) continue;

    rows.push({
      label: stat.label,
      category: stat.category,
      avg: average(durations),
      min: Math.min(...durations),
      max: Math.max(...durations),
      count: durations.length,
      notes: stat.note
        ? `${stat.rowCount ? `rows=${stat.rowCount} | ` : ''}${stat.note}`
        : stat.rowCount
          ? `rows=${stat.rowCount}`
          : '',
    });
  }

  if (rows.length === 0) {
    logger.info('  (no data)');
    return;
  }

  // Sort by average descending
  rows.sort((a, b) => b.avg - a.avg);

  for (const row of rows) {
    const notes = row.notes ? ` | ${row.notes}` : '';
    logger.info(
      `  ${row.label.padEnd(32)} avg=${formatMs(row.avg)} | min=${formatMs(row.min)} | max=${formatMs(row.max)}${notes}`
    );
  }
}

function printCategoryTable(stats: Map<EntityCategory, number[]>): void {
  const rows: Array<{
    category: string;
    avg: number;
    min: number;
    max: number;
  }> = [];

  for (const [category, durations] of stats) {
    if (durations.length === 0) continue;

    rows.push({
      category,
      avg: average(durations),
      min: Math.min(...durations),
      max: Math.max(...durations),
    });
  }

  if (rows.length === 0) {
    logger.info('  (no data)');
    return;
  }

  // Sort by average descending
  rows.sort((a, b) => b.avg - a.avg);

  for (const row of rows) {
    logger.info(
      `  ${row.category.padEnd(20)} avg=${formatMs(row.avg)} | min=${formatMs(row.min)} | max=${formatMs(row.max)}`
    );
  }
}

// Utility functions

function now(): number {
  return performance.now();
}

function formatMs(ms: number): string {
  if (ms < 0.1) {
    return `${(ms * 1000).toFixed(0)}µs`;
  }
  if (ms < 1) {
    return `${ms.toFixed(2)}ms`;
  }
  return `${ms.toFixed(0)}ms`;
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

function collectDefaultInfo(result: any): TaskResultInfo {
  if (Array.isArray(result)) {
    return { rowCount: result.length };
  }
  return {};
}

function parsePositive(input: string | undefined, fallback: number): number {
  if (!input) return fallback;
  const parsed = parseInt(input, 10);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, got: ${input}`);
  }
  return parsed;
}

function parseNonNegative(input: string | undefined, fallback: number): number {
  if (!input) return fallback;
  const parsed = parseInt(input, 10);
  if (isNaN(parsed) || parsed < 0) {
    throw new Error(`Expected non-negative integer, got: ${input}`);
  }
  return parsed;
}

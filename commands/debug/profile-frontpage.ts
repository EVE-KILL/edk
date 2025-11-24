import logger from '../../server/helpers/logger';

import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';
import {
  countFilteredKills,
  getFilteredKillsWithNames,
} from '../../server/models/killlist';
import { getMostValuableKillsByPeriod } from '../../server/models/mostValuableKills';
import { getTopByKills } from '../../server/models/topBoxes';

type FrontpageCategory = 'killlist' | 'topBoxes' | 'mostValuable';

interface TaskResultInfo {
  rowCount?: number;
  note?: string;
}

interface PerfTask<T = unknown> {
  key: string;
  label: string;
  category: FrontpageCategory;
  run: () => Promise<T>;
  collectInfo?: (result: T) => TaskResultInfo;
}

interface TaskMeasurement {
  key: string;
  label: string;
  category: FrontpageCategory;
  durationMs: number;
  rowCount?: number;
  note?: string;
}

interface IterationResult {
  wallTimeMs: number;
  measurements: TaskMeasurement[];
}

interface CommandOptions {
  iterations?: string;
  warmup?: string;
  perPage?: string;
  page?: string;
}

export const description =
  'Profile frontpage data queries (killlist, top boxes, most valuable kills)';

export const options = [
  {
    flags: '--iterations <count>',
    description: 'Number of measurement iterations to record (default: 3)',
  },
  {
    flags: '--warmup <count>',
    description: 'Warm-up iterations to discard before measuring (default: 1)',
  },
  {
    flags: '--per-page <count>',
    description: 'Number of killmails to fetch per page (default: 30)',
  },
  {
    flags: '--page <number>',
    description: 'Killlist page number to profile (default: 1)',
  },
];

export async function action(options: CommandOptions) {
  const iterations = parsePositive(options.iterations, 3);
  const warmupIterations = parseNonNegative(options.warmup, 1);
  const perPage = parsePositive(options.perPage, 30);
  const page = parsePositive(options.page, 1);

  logger.info('Starting frontpage query profiling', {
    iterations,
    warmupIterations,
    perPage,
    page,
  });

  const tasks = createTasks({ page, perPage });
  const taskStats = new Map<
    string,
    {
      label: string;
      category: FrontpageCategory;
      durations: number[];
      rowCount?: number;
      note?: string;
    }
  >();
  const categoryStats = new Map<FrontpageCategory, number[]>();
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
    logger.error('Frontpage profiling command failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await database.close();
  }
}

function createTasks(params: { page: number; perPage: number }): PerfTask[] {
  const { page, perPage } = params;
  const topBoxEntityTypes: Array<
    [
      'character' | 'corporation' | 'alliance' | 'ship' | 'system' | 'region',
      string,
    ]
  > = [
    ['character', 'Top boxes (characters)'],
    ['corporation', 'Top boxes (corporations)'],
    ['alliance', 'Top boxes (alliances)'],
    ['system', 'Top boxes (systems)'],
    ['region', 'Top boxes (regions)'],
  ];

  return [
    {
      key: 'killlist:list',
      label: `Killlist page ${page}`,
      category: 'killlist',
      run: async () => await getFilteredKillsWithNames({}, page, perPage),
      collectInfo: (result) => ({
        rowCount: Array.isArray(result) ? result.length : undefined,
      }),
    },
    {
      key: 'killlist:count',
      label: 'Killlist count',
      category: 'killlist',
      run: async () => await countFilteredKills({}),
      collectInfo: (result) => ({ note: `count=${result}` }),
    },
    ...topBoxEntityTypes.map<PerfTask>(([entityType, label]) => ({
      key: `top:${entityType}`,
      label,
      category: 'topBoxes',
      run: async () => await getTopByKills('week', entityType, 10),
      collectInfo: (result) => ({
        rowCount: Array.isArray(result) ? result.length : undefined,
      }),
    })),
    {
      key: 'mostValuable:week',
      label: 'Most valuable kills (week)',
      category: 'mostValuable',
      run: async () => await getMostValuableKillsByPeriod('week', 6),
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
): Map<FrontpageCategory, number> {
  const totals = new Map<FrontpageCategory, number>();
  for (const measurement of measurements) {
    totals.set(
      measurement.category,
      (totals.get(measurement.category) ?? 0) + measurement.durationMs
    );
  }
  return totals;
}

function collectDefaultInfo(result: unknown): TaskResultInfo {
  if (Array.isArray(result)) {
    return { rowCount: result.length };
  }

  if (typeof result === 'number') {
    return { note: `value=${result}` };
  }

  return {};
}

function printTaskTable(
  stats: Map<
    string,
    {
      label: string;
      category: FrontpageCategory;
      durations: number[];
      rowCount?: number;
      note?: string;
    }
  >
): void {
  if (stats.size === 0) {
    logger.info('No task measurements recorded.');
    return;
  }

  const rows = [...stats.entries()]
    .map(([key, value]) => ({
      key,
      label: value.label,
      category: value.category,
      averageMs: average(value.durations),
      minMs: Math.min(...value.durations),
      maxMs: Math.max(...value.durations),
      rowCount: value.rowCount,
      note: value.note,
    }))
    .sort((a, b) => b.averageMs - a.averageMs);

  const header =
    'Task'.padEnd(32) +
    'Category'.padEnd(14) +
    'Avg (ms)'.padStart(10) +
    'Min'.padStart(10) +
    'Max'.padStart(10) +
    'Rows'.padStart(8) +
    ' Note';
  logger.info(header);
  logger.info('-'.repeat(header.length));

  for (const row of rows) {
    const parts = [
      row.label.padEnd(32),
      row.category.padEnd(14),
      formatMs(row.averageMs).padStart(10),
      formatMs(row.minMs).padStart(10),
      formatMs(row.maxMs).padStart(10),
      (row.rowCount !== undefined ? String(row.rowCount) : '-').padStart(8),
      row.note ? ` ${row.note}` : '',
    ];
    logger.info(parts.join(''));
  }
}

function printCategoryTable(
  categoryStats: Map<FrontpageCategory, number[]>
): void {
  if (categoryStats.size === 0) {
    logger.info('No category measurements recorded.');
    return;
  }

  const rows = [...categoryStats.entries()]
    .map(([category, durations]) => ({
      category,
      averageMs: average(durations),
      minMs: Math.min(...durations),
      maxMs: Math.max(...durations),
    }))
    .sort((a, b) => b.averageMs - a.averageMs);

  const header =
    'Category'.padEnd(14) +
    'Avg (ms)'.padStart(10) +
    'Min'.padStart(10) +
    'Max'.padStart(10);
  logger.info(header);
  logger.info('-'.repeat(header.length));

  for (const row of rows) {
    const parts = [
      row.category.padEnd(14),
      formatMs(row.averageMs).padStart(10),
      formatMs(row.minMs).padStart(10),
      formatMs(row.maxMs).padStart(10),
    ];
    logger.info(parts.join(''));
  }
}

function parsePositive(value: string | undefined, fallback: number): number {
  const parsed = value ? Number.parseInt(value, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

function parseNonNegative(value: string | undefined, fallback: number): number {
  const parsed = value ? Number.parseInt(value, 10) : NaN;
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return fallback;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

function now(): number {
  if (
    typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
  ) {
    return performance.now();
  }
  const [seconds, nanoseconds] = process.hrtime();
  return seconds * 1000 + nanoseconds / 1_000_000;
}

function formatMs(ms: number): string {
  return ms.toFixed(2);
}

import { mkdir, writeFile, rm } from 'fs/promises';
import { dirname, join } from 'path';
import { logger } from '../../server/helpers/logger';
import { upsertWar, clearWars, type ESIWar } from '../../server/models/wars';
import { WarKillmail } from '../../server/fetchers/war';
import {
  enqueueJobMany,
  JobPriority,
  QueueType,
} from '../../server/helpers/queue';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const DEFAULT_BASE_URL = 'https://data.everef.net/wars/history/';
const DEFAULT_TEMP_DIR = '/tmp/everef-wars';

export default {
  description:
    'Import wars from everef.net history archives (without ESI load)',
  options: [
    {
      flags: '--base-url <url>',
      description: 'Root URL to crawl for war archives',
      defaultValue: DEFAULT_BASE_URL,
    },
    {
      flags: '--temp-dir <path>',
      description: 'Temporary directory for downloads/decompression',
      defaultValue: DEFAULT_TEMP_DIR,
    },
    {
      flags: '--max-depth <number>',
      description: 'Maximum directory depth to crawl (default: 3)',
      defaultValue: '3',
    },
    {
      flags: '--limit-files <number>',
      description: 'Process only the first N discovered files',
    },
    {
      flags: '--skip-killmails',
      description: 'Do not queue/attach killmails even if present in archives',
    },
    {
      flags: '--max-wars <number>',
      description: 'Stop after importing this many wars (default: unlimited)',
    },
    {
      flags: '--log-every <number>',
      description:
        'Log every N wars (default: 0 = no per-war logs, 1 = log all)',
      defaultValue: '0',
    },
    {
      flags: '--reset',
      description: 'Truncate wars and warAllies before importing',
    },
  ],
  action: async (options: {
    baseUrl?: string;
    tempDir?: string;
    maxDepth?: string;
    limitFiles?: string;
    skipKillmails?: boolean;
    maxWars?: string;
    logEvery?: string;
    reset?: boolean;
  }) => {
    const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    const tempDir = options.tempDir || DEFAULT_TEMP_DIR;
    const maxDepth = options.maxDepth
      ? Number.parseInt(options.maxDepth, 10)
      : 3;
    const limitFiles = options.limitFiles
      ? Number.parseInt(options.limitFiles, 10)
      : undefined;
    const skipKillmails = options.skipKillmails === true;
    const maxWars = options.maxWars
      ? Number.parseInt(options.maxWars, 10)
      : Infinity;
    const logEvery =
      options.logEvery !== undefined
        ? Number.parseInt(options.logEvery, 10)
        : 0;
    const reset = options.reset === true;

    await mkdir(tempDir, { recursive: true });

    if (reset) {
      await clearWars();
      logger.warn(
        '[everef-wars] Reset wars and warAllies tables before import'
      );
    }

    logger.info('Starting Everef wars import', {
      baseUrl,
      tempDir,
      maxDepth,
      limitFiles,
      skipKillmails,
      maxWars: Number.isFinite(maxWars) ? maxWars : 'unlimited',
      logEvery,
      reset,
    });

    const files = await crawlListing(baseUrl, maxDepth, limitFiles);
    const targetFiles =
      limitFiles && limitFiles > 0 ? files.slice(0, limitFiles) : files;

    logger.info(
      `Discovered ${files.length} archive(s); processing ${targetFiles.length}`
    );

    const stats = {
      filesProcessed: 0,
      warsProcessed: 0,
      killmailsQueued: 0,
      killmailsUpdated: 0,
      filesTotal: targetFiles.length,
    };

    for (const [index, url] of targetFiles.entries()) {
      stats.filesProcessed++;
      try {
        const result = await processArchive(
          url,
          baseUrl,
          tempDir,
          skipKillmails,
          maxWars - stats.warsProcessed,
          logEvery
        );
        stats.warsProcessed += result.warsProcessed;
        stats.killmailsQueued += result.killmailsQueued;
        stats.killmailsUpdated += result.killmailsUpdated;

        const rel = url.replace(baseUrl, '').replace(/^\/+/, '');
        logger.info(
          `[everef-wars] File ${stats.filesProcessed}/${stats.filesTotal} (${rel}) wars +${result.warsProcessed} km queued +${result.killmailsQueued} km linked +${result.killmailsUpdated} totals: wars ${stats.warsProcessed} kmQ ${stats.killmailsQueued} kmLink ${stats.killmailsUpdated}`
        );
      } catch (error) {
        logger.error(`[everef-wars] Failed to process ${url}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if (stats.warsProcessed >= maxWars) {
        logger.info(
          `[everef-wars] Reached max wars limit (${maxWars}), stopping early`
        );
        break;
      }
    }

    logger.success('Everef wars import complete', { ...stats });
  },
};

async function crawlListing(
  base: string,
  maxDepth: number,
  limit?: number
): Promise<string[]> {
  const seen = new Set<string>();
  const result: string[] = [];
  const baseUrl = new URL(base);
  const visitedDirs = new Set<string>();

  async function crawl(url: string, depth: number) {
    if (depth < 0) return;
    if (limit && result.length >= limit) return;
    if (visitedDirs.has(url)) return;
    visitedDirs.add(url);

    logger.info(`[everef-wars] Fetching listing ${url} (depth ${depth})`);

    const res = await fetch(url);
    if (!res.ok) {
      logger.warn(
        `[everef-wars] Unable to fetch listing ${url} (${res.status})`
      );
      return;
    }

    const html = await res.text();
    const hrefs = [
      ...html.matchAll(/href="([^"]+)"/gi),
      ...html.matchAll(/href='([^']+)'/gi),
    ].map((m) => m[1]);

    for (const href of hrefs) {
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('?') ||
        href === '//' ||
        href.startsWith('//')
      )
        continue;

      const child = new URL(href, url);
      // Stay inside the wars/history subtree on the same host
      if (child.origin !== baseUrl.origin) continue;
      if (!child.pathname.startsWith(baseUrl.pathname)) continue;
      const childUrl = child.toString();

      // Avoid traversing parent links
      if (href === '../' || href === './') continue;

      if (childUrl.endsWith('/')) {
        if (depth > 0) {
          await crawl(childUrl, depth - 1);
        }
        continue;
      }

      if (
        childUrl.endsWith('.json') ||
        childUrl.endsWith('.json.bz2') ||
        childUrl.endsWith('.ndjson') ||
        childUrl.endsWith('.ndjson.bz2') ||
        childUrl.endsWith('.tar.bz2')
      ) {
        if (!seen.has(childUrl)) {
          seen.add(childUrl);
          result.push(childUrl);
          // Early exit if we've collected enough (useful with --limit-files)
          if (limit && result.length >= limit) {
            return;
          }
        }
      }
    }
  }

  await crawl(base, maxDepth);
  result.sort();
  return result;
}

async function processArchive(
  url: string,
  baseUrl: string,
  tempDir: string,
  skipKillmails: boolean,
  remainingWarBudget: number,
  logEvery: number
): Promise<{
  warsProcessed: number;
  killmailsQueued: number;
  killmailsUpdated: number;
}> {
  const parsed = new URL(url);
  const relativePath = parsed.pathname.replace(new URL(baseUrl).pathname, '');
  const localPath = join(tempDir, relativePath.replace(/^\//, ''));
  const localDir = dirname(localPath);
  await mkdir(localDir, { recursive: true });

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Download failed: ${resp.status} ${resp.statusText}`);
  }

  await writeFile(localPath, Buffer.from(await resp.arrayBuffer()));

  const isBzip = localPath.endsWith('.bz2');
  const isTar = localPath.endsWith('.tar') || localPath.endsWith('.tar.bz2');
  const decompressedPath = isBzip ? localPath.replace(/\.bz2$/, '') : localPath;

  if (isBzip) {
    await execBunzip(localPath, decompressedPath);
  }

  let records: any[] = [];

  if (isTar) {
    const extractDir = decompressedPath.replace(/\.tar$/, '');
    await mkdir(extractDir, { recursive: true });
    await execAsync(`tar -xf "${decompressedPath}" -C "${extractDir}"`);

    const files = await Array.fromAsync(
      new Bun.Glob('**/*.json').scan({ cwd: extractDir })
    );

    for (const file of files) {
      const content = await Bun.file(join(extractDir, file)).text();
      const rec = parseRecords(content);
      records.push(...rec);
    }

    await safeRemove(extractDir);
  } else {
    const content = await Bun.file(decompressedPath).text();
    records = parseRecords(content);
  }

  let warsProcessed = 0;
  let killmailsQueued = 0;
  const killmailsUpdated = 0;

  const warRecords: any[] = [];
  const killmailMap = new Map<number, Map<number, string>>(); // warId -> (killmailId -> hash)

  for (const record of records) {
    const warId =
      record.war_id ?? record.warId ?? record.id ?? record.war ?? null;

    // Killmail file: has war_id + killmail_id + hash but no aggressor/defender
    const isKillmailRecord =
      record.killmail_id || record.killmailId || record.killmail;

    if (isKillmailRecord && warId) {
      const kmId =
        record.killmail_id ?? record.killmailId ?? record.killmail ?? null;
      const kmHash = record.killmail_hash ?? record.hash ?? null;
      if (kmId && kmHash) {
        if (!killmailMap.has(Number(warId))) {
          killmailMap.set(Number(warId), new Map());
        }
        killmailMap.get(Number(warId))!.set(Number(kmId), kmHash);
      }
      continue;
    }

    // War record
    if (warId) {
      warRecords.push(record);
      // If war record embeds killmails array, collect them too
      if (Array.isArray(record.killmails)) {
        for (const km of record.killmails) {
          const kmId =
            km.killmail_id ?? km.killmailId ?? km.id ?? km.killmail ?? null;
          const kmHash = km.killmail_hash ?? km.hash ?? null;
          if (kmId && kmHash) {
            if (!killmailMap.has(Number(warId))) {
              killmailMap.set(Number(warId), new Map());
            }
            killmailMap.get(Number(warId))!.set(Number(kmId), kmHash);
          }
        }
      }
    }
  }

  for (const record of warRecords) {
    if (warsProcessed >= remainingWarBudget) {
      break;
    }

    const warId =
      record.war_id ?? record.warId ?? record.id ?? record.war ?? null;
    if (!warId) continue;

    const war: ESIWar = {
      aggressor: record.aggressor ?? {},
      defender: record.defender ?? {},
      allies: record.allies ?? [],
      declared:
        record.declared ??
        record.declared_at ??
        record.declaredTime ??
        record.declared_at_utc,
      started:
        record.started ??
        record.started_at ??
        record.start_time ??
        record.started_at_utc,
      retracted: record.retracted ?? record.retracted_at,
      finished:
        record.finished ??
        record.finished_at ??
        record.finish_time ??
        record.finished_at_utc,
      mutual: record.mutual ?? false,
      open_for_allies: record.open_for_allies ?? record.openForAllies ?? false,
    };

    await upsertWar(Number(warId), war);
    warsProcessed++;

    const kmMap = killmailMap.get(Number(warId));
    const killmailList: WarKillmail[] = kmMap
      ? Array.from(kmMap.entries()).map(([id, hash]) => ({
          killmail_id: id,
          killmail_hash: hash,
        }))
      : [];

    if (!skipKillmails && killmailList.length > 0) {
      await enqueueJobMany(
        QueueType.KILLMAIL,
        killmailList.map((km) => ({
          killmailId: km.killmail_id,
          hash: km.killmail_hash,
          warId: Number(warId),
        })),
        { priority: JobPriority.NORMAL }
      );
      killmailsQueued += killmailList.length;
    }

    if (logEvery > 0 && warsProcessed % logEvery === 0) {
      logger.success(
        `${chalk.green('➕')} imported war ${chalk.cyan(
          warId
        )} ${killmailList.length ? chalk.yellow(`(km ${killmailList.length})`) : ''}`
      );
    }
  }

  // Clean up the downloaded/decompressed files
  await safeRemove(localPath);
  if (decompressedPath !== localPath) {
    await safeRemove(decompressedPath);
  }

  return { warsProcessed, killmailsQueued, killmailsUpdated };
}

function parseRecords(content: string): any[] {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.data)) return parsed.data;
    return [parsed];
  } catch {
    // Fallback to NDJSON
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }
}

async function execBunzip(source: string, target: string): Promise<void> {
  await execAsync(`bunzip2 -c "${source}" > "${target}"`);
}

async function safeRemove(path: string): Promise<void> {
  try {
    await rm(path, { force: true, recursive: true });
  } catch {
    // ignore cleanup errors
  }
}

import { logger } from "../server/helpers/logger";
import { database } from "../server/helpers/database";
import { enqueueJobMany } from "../server/helpers/queue";
import { QueueType } from "../server/helpers/queue";

export default {
  description: "Backfill killmails from zKillboard history API",
  options: [
    {
      flags: "--delay <ms>",
      description: "Initial delay between API fetches in milliseconds (default: 1000)",
      defaultValue: "1000",
    },
    {
        flags: "--start-date <YYYY-MM-DD>",
        description: "Date to start backfill from (default: today)",
    }
  ],
  action: async (options: {
    delay?: string;
    startDate?: string;
  }) => {
    let delay = Number.parseInt(options.delay ?? '1000');

    const userStartDate = options.startDate ? new Date(options.startDate) : new Date();

    logger.info(`Starting zKillboard backfill, starting from ${options.startDate || 'today'}...`);

    logger.info("Fetching history totals from zKillboard...");
    const historyResponse = await fetch("https://zkillboard.com/api/history/totals.json");
    if (!historyResponse.ok) {
        logger.error(`Failed to fetch history totals from zKillboard. Status: ${historyResponse.status}`);
        return;
    }

    const dateCounts: Record<string, number> = await historyResponse.json();
    const dateEntries = Object.entries(dateCounts)
        .map(([dateStr, count]) => {
            // Parse YYYYMMDD format from zkillboard
            const year = dateStr.slice(0, 4);
            const month = dateStr.slice(4, 6);
            const day = dateStr.slice(6, 8);
            const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
            return { date, count };
        })
        .filter(({ date }) => date <= userStartDate)
        .sort((a, b) => b.date.getTime() - a.date.getTime());

    if (dateEntries.length === 0) {
        logger.warn("No dates found to process based on the start date.");
        return;
    }

    const totalKillmails = dateEntries.reduce((sum, entry) => sum + entry.count, 0);
    let processedCount = 0;
    const startTime = Date.now();

    logger.info(`Found ${dateEntries.length} days to process, with a total of ${totalKillmails} killmails.`);

    for (const { date, count } of dateEntries) {
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

        let success = false;
        while (!success) {
            const url = `https://zkillboard.com/api/history/${dateStr}.json`;
            const response = await fetch(url);

            if (response.ok) {
                const killmails: Record<string, string> = await response.json();
                const killmailData = Object.entries(killmails).map(([id, hash]) => ({
                    killmailId: parseInt(id),
                    hash,
                }));

                processedCount += killmailData.length;

                if (killmailData.length > 0) {
                    const killmailIds = killmailData.map(k => k.killmailId);
                    const existingIdsResult = await database.sql<{ killmailId: number }[]>`SELECT "killmailId" FROM killmails WHERE "killmailId" = ANY(${killmailIds})`;
                    const existingIds = new Set(existingIdsResult.map(row => row.killmailId));

                    const newKillmails = killmailData.filter(k => !existingIds.has(k.killmailId));

                    if (newKillmails.length > 0) {
                        await enqueueJobMany(
                           QueueType.KILLMAIL,
                           newKillmails.map(km => ({ killmailId: km.killmailId, hash: km.hash }))
                       );
                       logger.info(`Enqueued ${newKillmails.length} new killmails for ${dateStr}.`);
                    } else {
                        logger.info(`No new killmails to enqueue for ${dateStr}.`);
                    }
                } else {
                    logger.info(`No killmails found for ${dateStr}.`);
                }

                success = true;
            } else if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                const backoff = retryAfter ? parseInt(retryAfter) * 1000 : delay * 2;
                delay = Math.max(backoff, delay); // Use the larger of Retry-After or our doubled delay
                logger.warn(`Rate limited. Increasing delay to ${delay}ms and retrying...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                logger.error(`Failed to fetch killmails for ${dateStr}. Status: ${response.status}. Skipping this date.`);
                break;
            }
        }

        const elapsedTime = Date.now() - startTime;
        const killmailsPerMs = processedCount / elapsedTime;
        const remainingKillmails = totalKillmails - processedCount;
        const etaMs = remainingKillmails / killmailsPerMs;
        const etaSeconds = Math.round(etaMs / 1000);
        const progress = (processedCount / totalKillmails * 100).toFixed(2);

        logger.info(`Progress: ${progress}%, ETA: ${etaSeconds}s`);

        logger.info(`Waiting ${delay}ms before fetching next day.`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    logger.success("zKillboard backfill complete.");
  },
};

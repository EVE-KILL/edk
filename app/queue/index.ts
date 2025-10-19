import { queueDb } from "../db";
import { JobDispatcher } from "./job-dispatcher";
import { QueueManager } from "./queue-manager";
import { KillmailProcessor, ESIFetcher } from "./workers";

/**
 * Queue System Public API
 *
 * Provides a simple interface to enqueue jobs and manage the queue.
 */

// Singleton instances (use queueDb to avoid spammy query logs)
export const queue = new JobDispatcher(queueDb);
export const queueManager = new QueueManager(queueDb);

// Register default workers
queueManager.registerWorker(new KillmailProcessor());
queueManager.registerWorker(new ESIFetcher());

// Export classes for custom workers
export { JobDispatcher } from "./job-dispatcher";
export { QueueManager } from "./queue-manager";
export { BaseWorker, KillmailProcessor, ESIFetcher } from "./workers";

// Export types
export type { Job, NewJob } from "./schema/jobs";

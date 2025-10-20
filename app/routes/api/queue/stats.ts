import { ApiController } from "../../../../src/controllers/api-controller";
import { queue } from "../../../../src/queue/job-dispatcher";
import { queueManager } from "../../../queue/queue-manager";

/**
 * Queue Stats API Endpoint
 *
 * GET /api/queue/stats
 *
 * Returns statistics about all queues:
 * - Overall job counts by status
 * - Per-queue job counts
 * - Queue manager status
 */
export class Controller extends ApiController {
  // Cache stats for 5 seconds (they change frequently)
  static cacheConfig = {
    ttl: 5,
  };

  override async handle(): Promise<Response> {
    // Get overall stats
    const overall = await queue.getStats();

    // Get stats by queue
    const byQueue = await queue.getStatsByQueue();

    // Get queue manager status
    const managerStatus = queueManager.getStatus();

    // Get total job count
    const total = await queue.count();

    return this.json({
      overall,
      byQueue,
      manager: managerStatus,
      total,
    });
  }
}

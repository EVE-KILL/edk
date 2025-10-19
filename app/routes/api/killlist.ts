import { ApiController } from "../../utils/api-controller";
import { generateKilllist } from "../../generators/killlist";

/**
 * GET /api/killlist
 *
 * Returns a paginated list of killmails
 *
 * Query parameters:
 * - limit: Number of killmails to return (default: 20, max: 100)
 * - before: ISO timestamp to fetch killmails before (for pagination)
 */
export class Controller extends ApiController {
  override async handle(): Promise<Response> {
    try {
      // Get query parameters
      const url = new URL(this.request.url);
      const limitParam = url.searchParams.get("limit");
      const beforeParam = url.searchParams.get("before");

      // Parse and validate limit
      let limit = 20;
      if (limitParam) {
        const parsedLimit = parseInt(limitParam, 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100) {
          limit = parsedLimit;
        }
      }

      // Parse before timestamp
      let before: Date | undefined;
      if (beforeParam) {
        const timestamp = new Date(beforeParam);
        if (!isNaN(timestamp.getTime())) {
          before = timestamp;
        }
      }

      // Fetch killmails
      const killmails = await generateKilllist(limit, before);

      // Get the last killmail's timestamp for pagination
      const lastKillmail = killmails[killmails.length - 1];
      const nextBefore = lastKillmail?.killmail_time;

      // Return response with pagination metadata
      return this.json({
        data: killmails,
        pagination: {
          limit,
          count: killmails.length,
          hasMore: killmails.length === limit,
          nextBefore: nextBefore?.toISOString(),
        },
      });
    } catch (error) {
      console.error("Error fetching killlist:", error);
      return this.error("Failed to fetch killmails", 500);
    }
  }
}

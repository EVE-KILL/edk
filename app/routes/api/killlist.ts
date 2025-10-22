import { ApiController } from "../../../src/controllers/api-controller";
import { generateKilllist } from "../../generators/killlist";

/**
 * GET /api/killlist
 *
 * Returns a paginated list of killmails
 *
 * Query parameters:
 * - limit: Number of killmails to return (default: 20, max: 100)
 * - page: Page number (default: 1)
 * - before: ISO timestamp to fetch killmails before (for backward compatibility)
 * - characterId: Filter by character ID (can be comma-separated)
 * - corporationId: Filter by corporation ID (can be comma-separated)
 * - allianceId: Filter by alliance ID (can be comma-separated)
 * - killsOnly: Only show kills (true/false)
 * - lossesOnly: Only show losses (true/false)
 */
export class Controller extends ApiController {
  static cacheConfig = {
    ttl: 30,                     // Fresh for 30 seconds
    staleWhileRevalidate: 60,    // Serve stale for 60 more seconds while refreshing
    vary: ["limit", "page", "before", "characterId", "corporationId", "allianceId", "killsOnly", "lossesOnly"],
  };

  override async handle(): Promise<Response> {
    try {
      // Get query parameters
      const url = new URL(this.request.url);
      const limitParam = url.searchParams.get("limit");
      const pageParam = url.searchParams.get("page");
      const beforeParam = url.searchParams.get("before");
      const characterIdParam = url.searchParams.get("characterId");
      const corporationIdParam = url.searchParams.get("corporationId");
      const allianceIdParam = url.searchParams.get("allianceId");
      const killsOnlyParam = url.searchParams.get("killsOnly");
      const lossesOnlyParam = url.searchParams.get("lossesOnly");

      // Parse and validate limit
      let limit = 20;
      if (limitParam) {
        const parsedLimit = parseInt(limitParam, 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100) {
          limit = parsedLimit;
        }
      }

      // Parse page number for offset-based pagination
      let offset = 0;
      let currentPage = 1;
      if (pageParam) {
        const parsedPage = parseInt(pageParam, 10);
        if (!isNaN(parsedPage) && parsedPage > 0) {
          currentPage = parsedPage;
          offset = (currentPage - 1) * limit;
        }
      }

      // Parse before timestamp (backward compatibility)
      let before: Date | undefined;
      if (beforeParam) {
        const timestamp = new Date(beforeParam);
        if (!isNaN(timestamp.getTime())) {
          before = timestamp;
        }
      }

      // Parse entity filters
      const characterIds = characterIdParam
        ? characterIdParam.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
        : undefined;

      const corporationIds = corporationIdParam
        ? corporationIdParam.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
        : undefined;

      const allianceIds = allianceIdParam
        ? allianceIdParam.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
        : undefined;

      const killsOnly = killsOnlyParam === 'true';
      const lossesOnly = lossesOnlyParam === 'true';

      // Fetch killmails with limit+1 to detect if there are more
      const killmails = await generateKilllist(limit + 1, {
        before,
        offset,
        characterIds,
        corporationIds,
        allianceIds,
        killsOnly,
        lossesOnly,
      });

      // Check if there are more results
      const hasMore = killmails.length > limit;
      if (hasMore) {
        killmails.pop(); // Remove the extra item
      }

      // Get the last killmail's timestamp for backward compatibility
      const lastKillmail = killmails[killmails.length - 1];
      const nextBefore = lastKillmail?.killmail_time;

      // Return response with pagination metadata
      return this.json({
        data: killmails,
        pagination: {
          limit,
          page: currentPage,
          count: killmails.length,
          hasMore,
          nextPage: hasMore ? currentPage + 1 : null,
          nextBefore: nextBefore?.toISOString(), // Backward compatibility
        },
      });
    } catch (error) {
      console.error("Error fetching killlist:", error);
      return this.error("Failed to fetch killmails", 500);
    }
  }
}

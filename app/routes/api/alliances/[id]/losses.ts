import { ApiController } from "../../../../../src/controllers/api-controller";
import { generateKilllist } from "../../../../generators/killlist";
import { generateAllianceDetail } from "../../../../generators/alliance";

/**
 * GET /api/alliances/:id/losses
 *
 * Returns alliance losses with pagination
 *
 * Query parameters:
 * - limit: Number of killmails to return (default: 20, max: 100)
 * - page: Page number (default: 1)
 */
export class Controller extends ApiController {
  static cacheConfig = {
    ttl: 60,
    vary: ["id", "limit", "page"],
  };

  override async handle(): Promise<Response> {
    const allianceIdStr = this.getParam("id");

    if (!allianceIdStr) {
      return this.error("Alliance ID is required", 400);
    }

    const allianceId = parseInt(allianceIdStr, 10);
    if (isNaN(allianceId)) {
      return this.error("Invalid alliance ID", 400);
    }

    try {
      // Get query parameters
      const url = new URL(this.request.url);
      const limitParam = url.searchParams.get("limit");
      const pageParam = url.searchParams.get("page");

      // Parse and validate limit
      let limit = 20;
      if (limitParam) {
        const parsedLimit = parseInt(limitParam, 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100) {
          limit = parsedLimit;
        }
      }

      // Parse page number
      let currentPage = 1;
      if (pageParam) {
        const parsedPage = parseInt(pageParam, 10);
        if (!isNaN(parsedPage) && parsedPage > 0) {
          currentPage = parsedPage;
        }
      }

      const offset = (currentPage - 1) * limit;

      // Fetch alliance details for stats
      const allianceDetail = await generateAllianceDetail(allianceId);
      if (!allianceDetail) {
        return this.error("Alliance not found", 404);
      }

      // Fetch losses with limit+1 to detect if there are more
      const killmails = await generateKilllist(limit + 1, {
        allianceIds: [allianceId],
        lossesOnly: true,
        offset,
      });

      // Check if there are more results
      const hasMore = killmails.length > limit;
      if (hasMore) {
        killmails.pop();
      }

      return this.json({
        alliance: allianceDetail.alliance,
        stats: allianceDetail.stats,
        data: killmails,
        pagination: {
          limit,
          page: currentPage,
          count: killmails.length,
          hasMore,
          nextPage: hasMore ? currentPage + 1 : null,
        },
      });
    } catch (error) {
      console.error(`Error fetching losses for alliance ${allianceId}:`, error);
      return this.error("Failed to fetch alliance losses", 500);
    }
  }
}

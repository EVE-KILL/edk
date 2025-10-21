import { ApiController } from "../../../../../src/controllers/api-controller";
import { generateKilllist } from "../../../../generators/killlist";
import { generateCorporationDetail } from "../../../../generators/corporation";

/**
 * GET /api/corporations/:id/losses
 *
 * Returns corporation losses with pagination
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
    const corporationIdStr = this.getParam("id");

    if (!corporationIdStr) {
      return this.error("Corporation ID is required", 400);
    }

    const corporationId = parseInt(corporationIdStr, 10);
    if (isNaN(corporationId)) {
      return this.error("Invalid corporation ID", 400);
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

      // Fetch corporation details for stats
      const corporationDetail = await generateCorporationDetail(corporationId);
      if (!corporationDetail) {
        return this.error("Corporation not found", 404);
      }

      // Fetch losses with limit+1 to detect if there are more
      const killmails = await generateKilllist(limit + 1, {
        corporationIds: [corporationId],
        lossesOnly: true,
        offset,
      });

      // Check if there are more results
      const hasMore = killmails.length > limit;
      if (hasMore) {
        killmails.pop();
      }

      return this.json({
        corporation: corporationDetail.corporation,
        stats: corporationDetail.stats,
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
      console.error(`Error fetching losses for corporation ${corporationId}:`, error);
      return this.error("Failed to fetch corporation losses", 500);
    }
  }
}
